/**
 * Host-half test: drive `apply` with a stub cordis context, capture the
 * registered route, and assert the snapshot against the real harness home.
 *
 * Run: node --test tests/host.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, name } from '../lib/index.js'

/** Build a stub host context plus a callable `/list` handler. */
function harness(entries = []) {
  let route = null
  const ctx = {
    dshHomePath: () => process.env.DSH_HOME ?? `${process.env.HOME}/.dsh`,
    loader: { entries: () => entries },
    inject: (_deps, callback) => callback({ effect: run => run(), webServer: { register: r => { route = r; return () => {} } } }),
  }
  return { ctx, route: () => route }
}

/** Invoke a captured route as the web server would. */
async function get(route, path) {
  let status = 0
  let body = ''
  const res = {
    writeHead: code => { status = code },
    end: text => { body = text },
  }
  await route.handler({ method: 'GET', url: path }, res)
  return { status, body: body === '' ? null : JSON.parse(body) }
}

const entry = (id, moduleName, state = 2, disabled = false) => ({
  id, disabled, options: { name: moduleName }, fiber: { state },
})

test('exposes the loader entry name', () => {
  assert.equal(name, 'dsh-user-plugins')
})

test('registers one prefix route and answers /list with every profile', async () => {
  const { ctx, route } = harness([entry('dsh-memory-evolve', 'dsh-memory-evolve')])
  apply(ctx)
  const { status, body } = await get(route(), '/dsh-user-plugins/api/list')
  assert.equal(status, 200)
  assert.ok(body.profiles.length >= 1, 'at least one profile is reported')

  const web = body.profiles.find(p => p.name === 'web')
  assert.ok(web, 'the web profile is present')
  assert.ok(web.plugins.length > 0, 'the web profile reports installed plugins')
  assert.equal(web.active, true, 'the profile matching live entries is marked active')
})

test('marks third-party packages shipped:false and joins them to the live phase', async () => {
  const { ctx, route } = harness([entry('dsh-memory-evolve', 'dsh-memory-evolve')])
  apply(ctx)
  const { body } = await get(route(), '/dsh-user-plugins/api/list')
  const memory = body.profiles.find(p => p.name === 'web').plugins.find(p => p.name === 'dsh-memory-evolve')

  assert.ok(memory, 'dsh-memory-evolve is listed')
  assert.equal(memory.shipped, false)
  assert.equal(memory.kind, 'bundle', 'it contributes a bundle patch')
  assert.equal(memory.client, true, 'it ships a browser half')
  assert.equal(memory.bundleEnabled, true, 'the profile enables its bundle')
  assert.equal(memory.entryId, 'dsh-memory-evolve')
  assert.equal(memory.phase, 'active')
  assert.match(memory.spec, /^github:/, 'the install spec survives verbatim')
})

test('classifies shipped packages and sorts user-installed first', async () => {
  const { ctx, route } = harness()
  apply(ctx)
  const { body } = await get(route(), '/dsh-user-plugins/api/list')
  const web = body.profiles.find(p => p.name === 'web')

  const base = web.plugins.find(p => p.name === '@deepseek-ai/dsh-base')
  assert.ok(base, 'shipped bundles are still reported')
  assert.equal(base.shipped, true)

  assert.equal(web.plugins[0].shipped, false, 'a user-installed plugin sorts first')
})

test('unknown paths and non-GET methods answer 404', async () => {
  const { ctx, route } = harness()
  apply(ctx)
  assert.equal((await get(route(), '/dsh-user-plugins/api/nope')).status, 404)
})
