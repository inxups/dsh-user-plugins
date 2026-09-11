/**
 * Client-half test: load the built bundle exactly as the shell's module loader
 * does, then assert the Cordis contract, the slot registration, and the
 * shipped-package filtering rule.
 *
 * Run: node --test tests/client.test.mjs   (build first: node scripts/build.mjs)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'

const BUNDLE = new URL('../lib/client.js', import.meta.url)

/** The platform modules the bundle is allowed to require. */
const PLATFORM_IDS = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
])

/** Resolve react from a dsh profile when present, else use a hook-free stub. */
function platformModules() {
  const anchors = [
    `${process.env.HOME}/.dsh/profiles/web/package.json`,
    new URL('../../package.json', import.meta.url).pathname,
  ]
  for (const anchor of anchors) {
    try {
      const require = createRequire(anchor)
      return { react: require('react'), jsx: require('react/jsx-runtime') }
    } catch {
      /* try the next anchor */
    }
  }
  return {
    react: { useState: () => [], useEffect: () => {}, useCallback: fn => fn, useMemo: fn => fn() },
    jsx: { jsx: () => ({}), jsxs: () => ({}), Fragment: Symbol('Fragment') },
  }
}

/** Stand-ins for the platform UI primitives (never rendered in these tests). */
function primitivesStub() {
  const noop = () => null
  return {
    Button: noop,
    Input: noop,
    Tag: noop,
    StateDot: noop,
    IconRefreshOutline16: noop,
    IconSearchOutline16: noop,
  }
}

/** Execute the bundle under a stub module loader and return its registration. */
function loadBundle() {
  assert.ok(existsSync(BUNDLE), 'lib/client.js must exist — run `node scripts/build.mjs` first')
  const source = readFileSync(BUNDLE, 'utf8')
  let registration = null
  const window = { __ModuleLoader__: { load: value => { registration = value } } }
  // The bundle is an IIFE over `window`; running it registers the factory.
  new Function('window', source)(window)
  assert.ok(registration !== null, 'the bundle registers through window.__ModuleLoader__.load')
  const platform = platformModules()
  const exports = registration.factory((id) => {
    if (id === 'react') return platform.react
    if (id === 'react/jsx-runtime') return platform.jsx
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub()
    throw new Error(`bundle required a non-platform module: ${id}`)
  })
  return { registration, exports }
}

test('registers under the package name with the loader wire id', () => {
  const { registration } = loadBundle()
  assert.equal(registration.id, 'dsh-user-plugins')
  assert.equal(typeof registration.factory, 'function')
})

test('exports the Cordis plugin contract', () => {
  const { exports } = loadBundle()
  assert.equal(exports.name, 'dsh-user-plugins')
  assert.deepEqual(exports.inject, ['slots', 'locale'], 'it waits for the locale service')
  assert.equal(exports.NS, 'settings.userPlugins')
  assert.equal(typeof exports.apply, 'function')
  assert.equal(typeof exports.UserPluginsTab, 'function', 'the tab component is exported for tests')
  assert.equal(typeof exports.selectUserPlugins, 'function', 'the projection is exported for tests')
  assert.equal(typeof exports.zh, 'object', 'the dictionaries are exported so parity is testable')
  assert.equal(typeof exports.en, 'object')
})

test('requires only platform modules', () => {
  const source = readFileSync(BUNDLE, 'utf8')
  const required = [...source.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
  assert.ok(required.length > 0, 'the bundle does require platform modules')
  for (const id of required) {
    assert.ok(PLATFORM_IDS.has(id), `${id} is not a platform module`)
  }
})

/** A stub locale service: `register` records calls, `bind` resolves against `active`. */
function localeStub(exports, namespace) {
  const registered = []
  const state = { active: 'zh' }
  return {
    registered,
    state,
    service: {
      register: (ns, dicts) => { registered.push({ ns, dicts }); return () => {} },
      bind: ns => (key, params) => {
        const template = (ns === namespace ? state.active : 'zh') === 'en'
          ? exports.en[key]
          : exports.zh[key]
        const text = template ?? key
        if (params === undefined) return text
        return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      },
    },
  }
}

test('apply registers the dictionaries and one tab into settings.plugins.tab', () => {
  const { exports } = loadBundle()
  let registered = null
  let injectedKey = null
  const locale = localeStub(exports, exports.NS)
  const ctx = {
    effect: run => { run(); return () => {} },
    locale: locale.service,
    slots: {
      inject: (key, callback) => { injectedKey = key; callback() },
      register: (options, component) => { registered = { options, component } },
    },
  }
  exports.apply(ctx)

  assert.equal(locale.registered.length, 1, 'exactly one dictionary registration')
  assert.equal(locale.registered[0].ns, exports.NS)
  assert.deepEqual(Object.keys(locale.registered[0].dicts).sort(), ['en', 'zh'])

  assert.equal(injectedKey, 'settings.plugins.tab', 'it defers to the section declaration')
  assert.equal(registered.options.name, 'settings.plugins.tab')
  assert.equal(registered.options.id, 'user-installed')
  assert.equal(registered.options.order, 20, 'it sits after the shipped inventory (order 10)')
  assert.equal(registered.options.locale, exports.NS, 'the t seat is declared for the component')
  assert.equal(registered.component, exports.UserPluginsTab)
})

test('the tab label is a thunk that follows the active locale', () => {
  const { exports } = loadBundle()
  let registered = null
  const locale = localeStub(exports, exports.NS)
  exports.apply({
    effect: run => { run(); return () => {} },
    locale: locale.service,
    slots: {
      inject: (_key, callback) => callback(),
      register: (options, component) => { registered = { options, component } },
    },
  })

  assert.equal(typeof registered.options.label, 'function', 'a thunk, not a frozen string')
  assert.equal(registered.options.label(), '我安装的插件')
  locale.state.active = 'en'
  assert.equal(registered.options.label(), 'My installed plugins', 'the same thunk re-reads the locale')
})

/** A representative snapshot: two shipped packages plus two user plugins. */
const snapshot = {
  home: '/home/u/.dsh',
  profiles: [{
    name: 'web',
    dir: '/home/u/.dsh/profiles/web',
    bundles: [],
    active: true,
    plugins: [
      { name: '@deepseek-ai/dsh-base', spec: null, shipped: true, source: 'installation', version: null, description: null, homepage: null, kind: 'bundle', patch: 'p', client: false, bundleEnabled: true, entryId: 'base', phase: 'active', enabled: true },
      { name: '@deepseek-ai/dsh-web-app', spec: null, shipped: true, source: 'installation', version: null, description: null, homepage: null, kind: 'bundle', patch: 'p', client: false, bundleEnabled: true, entryId: 'app', phase: 'active', enabled: true },
      { name: 'dsh-memory-evolve', spec: 'github:csyangwen/dsh-memory-evolve', shipped: false, source: 'profile', version: '0.1.0', description: '记忆', homepage: null, kind: 'bundle', patch: 'p', client: true, bundleEnabled: true, entryId: 'dsh-memory-evolve', phase: 'active', enabled: true },
      { name: '@liustack/modsearch', spec: '5.10.2', shipped: false, source: 'profile', version: '5.10.2', description: '搜索', homepage: null, kind: 'bundle', patch: 'p', client: true, bundleEnabled: true, entryId: 'modsearch', phase: 'active', enabled: true },
    ],
  }],
}

test('excludes every dsh-shipped package and reports only user plugins', () => {
  const { exports } = loadBundle()
  const selected = exports.selectUserPlugins(snapshot, '')
  const names = selected.flatMap(entry => entry.shown.map(plugin => plugin.name))

  assert.deepEqual(names, ['dsh-memory-evolve', '@liustack/modsearch'])
  assert.ok(!names.some(name => name.startsWith('@deepseek-ai/')), 'no shipped package survives the filter')
})

test('drops a profile whose plugins are all shipped', () => {
  const { exports } = loadBundle()
  const shippedOnly = {
    home: null,
    profiles: [{ ...snapshot.profiles[0], plugins: snapshot.profiles[0].plugins.slice(0, 2) }],
  }
  assert.deepEqual(exports.selectUserPlugins(shippedOnly, ''), [], 'an all-shipped profile renders nothing')
})

test('search matches name, install spec, and description, case-insensitively', () => {
  const { exports } = loadBundle()
  const namesFor = query => exports.selectUserPlugins(snapshot, query)
    .flatMap(entry => entry.shown.map(plugin => plugin.name))

  assert.deepEqual(namesFor('MEMORY'), ['dsh-memory-evolve'], 'name match ignores case')
  assert.deepEqual(namesFor('github:'), ['dsh-memory-evolve'], 'install spec is searchable')
  assert.deepEqual(namesFor('搜索'), ['@liustack/modsearch'], 'description is searchable')
  assert.deepEqual(namesFor('nothing-matches'), [], 'a miss renders nothing')
})

test('a null snapshot yields an empty view', () => {
  const { exports } = loadBundle()
  assert.deepEqual(exports.selectUserPlugins(null, ''), [])
})

/** Placeholder names in a template, so a translation cannot silently drop one. */
const placeholders = template => [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

test('the English dictionary covers exactly the Chinese key set', () => {
  const { exports } = loadBundle()
  const zhKeys = Object.keys(exports.zh).sort()
  const enKeys = Object.keys(exports.en).sort()

  assert.ok(zhKeys.length > 0, 'the dictionary is not empty')
  assert.deepEqual(enKeys, zhKeys, 'a key added to zh must be translated in en')
})

test('no translation is blank and every placeholder matches its Chinese source', () => {
  const { exports } = loadBundle()
  for (const key of Object.keys(exports.zh)) {
    assert.ok(exports.zh[key].trim() !== '', `zh.${key} is blank`)
    assert.ok(exports.en[key].trim() !== '', `en.${key} is blank`)
    assert.deepEqual(
      placeholders(exports.en[key]),
      placeholders(exports.zh[key]),
      `en.${key} must use the same placeholders as zh.${key}`,
    )
  }
})

test('the English tab title is not a copy of the Chinese one', () => {
  const { exports } = loadBundle()
  assert.notEqual(exports.en.tab, exports.zh.tab, 'the English tab is actually translated')
})
