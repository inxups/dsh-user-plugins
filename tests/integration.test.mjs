/**
 * Integration test: the real host snapshot (host half reading this machine's
 * profiles) fed through the real client-side projection shipped in the bundle.
 *
 * This is the end-to-end assertion for the panel's core promise — the view
 * never contains a dsh-shipped package — without a browser.
 *
 * Run: node --test tests/integration.test.mjs   (build first: node scripts/build.mjs)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'

import { apply } from '../lib/index.js'

const BUNDLE = new URL('../lib/client.js', import.meta.url)

/** Load the built client bundle and return its exports. */
function loadClient() {
  const source = readFileSync(BUNDLE, 'utf8')
  let registration = null
  const window = { __ModuleLoader__: { load: value => { registration = value } } }
  new Function('window', source)(window)

  const require = createRequire(`${process.env.HOME}/.dsh/profiles/web/package.json`)
  const react = require('react')
  const jsx = require('react/jsx-runtime')
  const noop = () => null
  return registration.factory((id) => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return jsx
    if (id === '@deepseek-ai/dsh-client-ui-primitives') {
      return { Button: noop, Input: noop, Tag: noop, StateDot: noop, IconRefreshOutline16: noop, IconSearchOutline16: noop }
    }
    throw new Error(`unexpected require: ${id}`)
  })
}

/** Drive the host half's route and return the snapshot it serves. */
async function hostSnapshot() {
  let route = null
  const ctx = {
    dshHomePath: () => `${process.env.HOME}/.dsh`,
    loader: { entries: () => [] },
    inject: (_deps, callback) => callback({
      effect: run => run(),
      webServer: { register: (r) => { route = r; return () => {} } },
    }),
  }
  apply(ctx)
  let body = ''
  await route.handler({ method: 'GET', url: '/dsh-user-plugins/api/list' }, { writeHead() {}, end(t) { body = t } })
  return JSON.parse(body)
}

const profilesExist = existsSync(`${process.env.HOME}/.dsh/profiles/web/package.json`)

test('real snapshot → real projection excludes every shipped package', { skip: !profilesExist && 'no web profile on this machine' }, async () => {
  const client = loadClient()
  const snapshot = await hostSnapshot()
  const selected = client.selectUserPlugins(snapshot, '')
  const names = selected.flatMap(entry => entry.shown.map(plugin => plugin.name))

  assert.ok(names.length > 0, 'the machine reports at least one user plugin')
  assert.ok(
    !names.some(name => name.startsWith('@deepseek-ai/')),
    `no shipped package reached the view, got: ${names.join(', ')}`,
  )

  // The expectation is derived from the snapshot, not hardcoded, so this stays
  // honest as the machine's plugin set changes.
  const expected = snapshot.profiles
    .flatMap(profile => profile.plugins)
    .filter(plugin => !plugin.shipped && plugin.source !== 'installation')
    .map(plugin => plugin.name)
  assert.deepEqual([...names].sort(), [...expected].sort(), 'every user plugin is shown, and only those')

  console.log(`    → ${names.length} user plugins: ${names.join(', ')}`)
})

test('searching the real snapshot narrows without reintroducing shipped packages', { skip: !profilesExist && 'no web profile on this machine' }, async () => {
  const client = loadClient()
  const snapshot = await hostSnapshot()
  const names = client.selectUserPlugins(snapshot, 'dsh-')
    .flatMap(entry => entry.shown.map(plugin => plugin.name))

  for (const name of names) {
    assert.ok(!name.startsWith('@deepseek-ai/'), `${name} must not appear`)
    assert.match(name, /dsh-/i)
  }
})
