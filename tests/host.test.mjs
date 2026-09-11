/**
 * Host-half tests, driven against a **fixture harness home** rather than the
 * machine's real `~/.dsh`.
 *
 * Hermetic on purpose: an earlier version asserted against whatever profiles
 * happened to exist locally, which passed here only because `$DSH_HOME` was
 * set, and failed on CI where no profiles exist. Fixtures make the scan
 * deterministic and give CI real coverage of the classification rules
 * (shipped vs. installation-provided, bundle/client/plain, phase joining).
 *
 * Live-machine behaviour is covered separately by tests/integration.test.mjs,
 * which skips itself when no profile is installed.
 *
 * Run: node --test tests/host.test.mjs
 */

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply, name } from '../lib/index.js'

const homes = []

/** Write one JSON file, creating parent directories. */
function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Build a temporary harness home.
 *
 * Shape (mirrors the cases the host scan must classify):
 *   profiles/web    a third-party bundle, a link-installed client-only plugin,
 *                   a plain library, a bundle-only package, and a shipped one
 *   profiles/other  a second profile with no matching loader entry
 */
function makeHome() {
  const home = mkdtempSync(join(tmpdir(), 'dsh-user-plugins-'))
  homes.push(home)

  const web = join(home, 'profiles', 'web')
  writeJson(join(web, 'package.json'), {
    name: 'dsh-profile-web',
    private: true,
    dependencies: {
      'third-party-bundle': 'github:someone/third-party-bundle',
      'link-plugin': 'link:/somewhere/link-plugin',
      'plain-lib': '^1.2.3',
    },
    dsh: {
      profile: {
        // `@deepseek-ai/dsh-base` and `bundles-only-pkg` are bundles without a
        // profile-local install; the first is shipped, the second is not.
        bundles: ['@deepseek-ai/dsh-base', 'third-party-bundle', 'bundles-only-pkg'],
      },
    },
  })
  writeJson(join(web, 'node_modules', 'third-party-bundle', 'package.json'), {
    name: 'third-party-bundle',
    version: '2.1.0',
    description: 'A third-party bundle',
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } },
  })
  writeJson(join(web, 'node_modules', 'link-plugin', 'package.json'), {
    name: 'link-plugin',
    version: '0.0.1',
    dsh: { client: { platform: 'web' } },
  })
  writeJson(join(web, 'node_modules', 'plain-lib', 'package.json'), {
    name: 'plain-lib',
    version: '3.4.5',
  })

  writeJson(join(home, 'profiles', 'other', 'package.json'), {
    name: 'dsh-profile-other',
    private: true,
    dependencies: { 'plain-lib': '^1.2.3' },
    dsh: { profile: { bundles: [] } },
  })

  return home
}

/** We do not leave temporary homes behind. */
after(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true })
})

/** A minimal Loader tree: three matches for `web`, plus a structural group row. */
const loaderEntries = [
  { id: 'g', disabled: false, options: { group: true, name: 'group-row' }, fiber: { state: 2 } },
  { id: 'third-party-bundle', disabled: false, options: { name: 'third-party-bundle' }, fiber: { state: 2 } },
  { id: 'link-plugin', disabled: false, options: { name: 'link-plugin' }, fiber: { state: 3 } },
  { id: 'base', disabled: false, options: { name: '@deepseek-ai/dsh-base' }, fiber: { state: 2 } },
]

/**
 * Drive `apply` with a stub context and capture the registered route.
 *
 * @param home - the harness home the host half should scan.
 * @param entries - the Loader rows it should join against.
 */
function harness(home, entries = loaderEntries) {
  let route = null
  const ctx = {
    dshHomePath: () => home,
    loader: { entries: () => entries },
    inject: (_deps, callback) => callback({
      effect: run => run(),
      webServer: { register: (r) => { route = r; return () => {} } },
    }),
  }
  return { ctx, route: () => route }
}

/** Invoke the captured route as the web server would. */
async function get(route, path) {
  let status = 0
  let body = ''
  const res = { writeHead: code => { status = code }, end: text => { body = text } }
  await route.handler({ method: 'GET', url: path }, res)
  return { status, body: body === '' ? null : JSON.parse(body) }
}

/** Apply against a fresh fixture home and return the `/list` snapshot. */
async function snapshot(entries = loaderEntries) {
  const home = makeHome()
  const { ctx, route } = harness(home, entries)
  apply(ctx)
  const { status, body } = await get(route(), '/dsh-user-plugins/api/list')
  assert.equal(status, 200)
  return { home, body }
}

/** Find one plugin row by name in a profile. */
function plugin(body, pluginName, profileName = 'web') {
  const profile = body.profiles.find(candidate => candidate.name === profileName)
  assert.ok(profile, `profile ${profileName} is reported`)
  const row = profile.plugins.find(candidate => candidate.name === pluginName)
  assert.ok(row, `${pluginName} is listed in ${profileName}`)
  return row
}

test('exposes the loader entry name', () => {
  assert.equal(name, 'dsh-user-plugins')
})

test('registers one prefix route and answers /list with every profile', async () => {
  const { home, body } = await snapshot()
  assert.equal(body.home, home)
  assert.deepEqual(body.profiles.map(profile => profile.name).sort(), ['other', 'web'])
})

test('joins an installed bundle to its live loader phase', async () => {
  const { body } = await snapshot()
  const row = plugin(body, 'third-party-bundle')

  assert.equal(row.shipped, false)
  assert.equal(row.source, 'profile')
  assert.equal(row.spec, 'github:someone/third-party-bundle', 'the install spec survives verbatim')
  assert.equal(row.version, '2.1.0', 'the version comes from the installed manifest')
  assert.equal(row.description, 'A third-party bundle')
  assert.equal(row.kind, 'bundle')
  assert.equal(row.client, true, 'it ships a browser half')
  assert.equal(row.bundleEnabled, true)
  assert.equal(row.entryId, 'third-party-bundle')
  assert.equal(row.phase, 'active')
})

test('classifies a package the dsh installation provides', async () => {
  const { body } = await snapshot()
  const row = plugin(body, '@deepseek-ai/dsh-base')

  assert.equal(row.shipped, true, 'the @deepseek-ai scope marks it shipped')
  assert.equal(row.source, 'installation', 'it has no profile-local copy')
  assert.equal(row.spec, null)
  assert.equal(row.version, null, 'no local manifest means no version to report')
  assert.equal(row.kind, 'bundle', 'its bundle entry still classifies it')
  assert.equal(row.bundleEnabled, true)
  assert.equal(row.phase, 'active')
})

test('classifies a client-only link install', async () => {
  const { body } = await snapshot()
  const row = plugin(body, 'link-plugin')

  assert.equal(row.spec, 'link:/somewhere/link-plugin')
  assert.equal(row.kind, 'client', 'a browser half without a bundle patch')
  assert.equal(row.client, true)
  assert.equal(row.bundleEnabled, false, 'it is not in the bundle list')
  assert.equal(row.phase, 'failed', 'a failed fiber still reports its entry')
})

test('classifies a plain library', async () => {
  const { body } = await snapshot()
  const row = plugin(body, 'plain-lib')

  assert.equal(row.kind, 'plain')
  assert.equal(row.client, false)
  assert.equal(row.bundleEnabled, false)
  assert.equal(row.entryId, null)
  assert.equal(row.phase, null, 'no entry means no live phase')
  assert.equal(row.enabled, null)
})

test('classifies a bundle-only package as installation-provided', async () => {
  const { body } = await snapshot()
  const row = plugin(body, 'bundles-only-pkg')

  assert.equal(row.source, 'installation', 'listed in bundles but not a dependency')
  assert.equal(row.shipped, false, 'a third-party name is not shipped')
  assert.equal(row.kind, 'bundle')
  assert.equal(row.bundleEnabled, true)
  assert.equal(row.version, null)
})

test('skips structural group rows in the loader tree', async () => {
  const { body } = await snapshot()
  const names = body.profiles.flatMap(profile => profile.plugins.map(row => row.entryId))
  assert.ok(!names.includes('group-row'), 'a group row never becomes a plugin entry')
})

test('sorts user-installed plugins ahead of shipped ones', async () => {
  const { body } = await snapshot()
  const web = body.profiles.find(profile => profile.name === 'web')

  assert.deepEqual(
    web.plugins.map(row => row.name),
    ['bundles-only-pkg', 'third-party-bundle', 'link-plugin', 'plain-lib', '@deepseek-ai/dsh-base'],
  )
  assert.equal(web.plugins.at(-1).shipped, true, 'shipped packages sink to the bottom')
})

test('marks the profile matching the most loader entries as active', async () => {
  const { body } = await snapshot()
  const web = body.profiles.find(profile => profile.name === 'web')
  const other = body.profiles.find(profile => profile.name === 'other')

  assert.equal(web.liveMatches, 3)
  assert.equal(web.active, true)
  assert.equal(other.liveMatches, 0)
  assert.equal(other.active, false)
})

test('a home without a profiles directory yields an empty snapshot', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-user-plugins-empty-'))
  homes.push(home)
  const { ctx, route } = harness(home, [])
  apply(ctx)

  const { status, body } = await get(route(), '/dsh-user-plugins/api/list')
  assert.equal(status, 200)
  assert.deepEqual(body.profiles, [], 'no profiles, no throw')
  assert.equal(body.home, home)
})

test('a malformed profile manifest is skipped rather than fatal', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-user-plugins-bad-'))
  homes.push(home)
  const broken = join(home, 'profiles', 'broken')
  mkdirSync(broken, { recursive: true })
  writeFileSync(join(broken, 'package.json'), '{ not valid json')

  const { ctx, route } = harness(home, [])
  apply(ctx)
  const { status, body } = await get(route(), '/dsh-user-plugins/api/list')

  assert.equal(status, 200)
  assert.deepEqual(body.profiles.map(profile => profile.name), ['broken'])
  assert.deepEqual(body.profiles[0].plugins, [], 'an unreadable manifest degrades to no plugins')
})

test('unknown paths answer 404', async () => {
  const home = makeHome()
  const { ctx, route } = harness(home, [])
  apply(ctx)
  assert.equal((await get(route(), '/dsh-user-plugins/api/nope')).status, 404)
})
