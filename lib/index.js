/**
 * dsh-user-plugins — host half.
 *
 * Serves a read-only snapshot of the plugins the **user** installed into their
 * dsh profiles: the packages `dsh plugin --profile <name> add` manages, with
 * their install spec, on-disk version, contributed kind (bundle patch / web
 * client half / plain library), and the live Cordis Loader phase of the entry
 * each one materialized.
 *
 * Why this exists next to the shipped Loader inventory: that one lists every
 * composed Loader entry in load order — shipped and third-party alike — and
 * carries no install spec, no version, and no per-profile attribution, so it
 * cannot answer "what did *I* install". This half answers exactly that, by
 * reading the profile manifests rather than the Loader tree, and treats the
 * Loader only as a source of live status for matched entries.
 *
 * Zero runtime dependencies (node:fs / node:path only). All presentation lives
 * in the browser half; this half owns filesystem facts and live phase.
 *
 * @module dsh-user-plugins/host
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Loader entry name; must equal the `cordis.patch.yml` row `name` exactly. */
export const name = 'dsh-user-plugins'

/** Packages under this scope come from the dsh installation, not the user. */
const SHIPPED_SCOPE = '@deepseek-ai/'

/** Directory under the harness home that holds one directory per profile. */
const PROFILES_DIR = 'profiles'

/**
 * Cordis `FiberState` → public phase vocabulary, mirroring the shipped
 * inventory projection (0 pending, 1 loading, 2 active, 3 failed,
 * 4 disposed → null, 5 unloading).
 */
const FIBER_PHASE = ['pending', 'loading', 'active', 'failed', null, 'unloading']

/** Parse a JSON file, returning null for anything missing or malformed. */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** True when a directory exists and can be listed. */
function isDirectory(path) {
  try {
    return existsSync(path) && readdirSync(path) !== undefined
  } catch {
    return false
  }
}

/**
 * Read the facts an installed package's own manifest carries.
 *
 * Returns null when the dependency is not installed under the profile (a
 * shipped package resolves from the dsh installation instead, so it has no
 * profile-local copy and contributes no facts here).
 *
 * @param profileDir - absolute profile directory.
 * @param dependency - the dependency name exactly as the profile declares it.
 * @returns the manifest facts, or null when unreadable.
 */
function readInstalled(profileDir, dependency) {
  const manifest = readJson(join(profileDir, 'node_modules', dependency, 'package.json'))
  if (manifest === null) return null
  const dsh = manifest.dsh ?? {}
  const patch = dsh.bundle?.patch
  return {
    version: typeof manifest.version === 'string' ? manifest.version : null,
    description: typeof manifest.description === 'string' ? manifest.description : null,
    /** The bundle patch file this package contributes, when it declares one. */
    patch: typeof patch === 'string' ? patch : null,
    /** Whether the package ships a browser half the client registry serves. */
    client: dsh.client?.platform === 'web',
    homepage: typeof manifest.homepage === 'string' ? manifest.homepage : null,
  }
}

/**
 * Project the live Loader tree into the rows this panel matches against.
 *
 * Group rows are structural and carry no plugin of their own, so they are
 * skipped; a throwing Loader read degrades to an empty list rather than
 * failing the whole snapshot.
 *
 * @param ctx - host cordis context.
 * @returns one row per non-group Loader entry.
 */
function loaderRows(ctx) {
  const rows = []
  try {
    for (const entry of ctx.loader.entries()) {
      if (entry.options?.group) continue
      rows.push({
        entryId: entry.id,
        moduleName: entry.options?.name,
        enabled: !entry.disabled,
        phase: entry.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
      })
    }
  } catch {
    /* No live Loader (or an unreadable tree): filesystem facts still answer. */
  }
  return rows
}

/**
 * Read one profile directory into the panel's profile shape.
 *
 * @param dir - the profile directory.
 * @param rows - live Loader rows, for entry matching and liveness.
 * @returns the profile snapshot.
 */
function readProfile(dir, rows) {
  const manifest = readJson(join(dir, 'package.json')) ?? {}
  const dependencies = manifest.dependencies ?? {}
  const bundles = Array.isArray(manifest.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : []
  const bundleSet = new Set(bundles)

  // A name reaches this profile either as its own npm dependency (what
  // `dsh plugin add` writes, and thus "installed by the user") or purely as a
  // bundle entry resolved from the dsh installation. The union is the roster.
  const names = new Set([...Object.keys(dependencies), ...bundles])

  const plugins = [...names].map((dependency) => {
    const installed = readInstalled(dir, dependency)
    const spec = dependencies[dependency]
    const shipped = dependency.startsWith(SHIPPED_SCOPE)
    // A bundle contributes a Loader row under its own package name; that is the
    // row whose live phase describes this plugin.
    const row = rows.find(candidate => candidate.moduleName === dependency)
    const isBundle = installed?.patch != null || bundleSet.has(dependency)
    return {
      name: dependency,
      spec: typeof spec === 'string' ? spec : null,
      shipped,
      /** npm dependency of the profile vs. resolved from the dsh installation. */
      source: spec === undefined ? 'installation' : 'profile',
      version: installed?.version ?? null,
      description: installed?.description ?? null,
      homepage: installed?.homepage ?? null,
      /** bundle = contributes a Loader patch layer, client = browser half only, plain = library. */
      kind: isBundle ? 'bundle' : installed?.client === true ? 'client' : 'plain',
      patch: installed?.patch ?? null,
      client: installed?.client === true,
      /** Whether the profile's bundle list actually enables this package. */
      bundleEnabled: bundleSet.has(dependency),
      entryId: row?.entryId ?? null,
      phase: row?.phase ?? null,
      enabled: row?.enabled ?? null,
    }
  })

  // Order: user-installed first, then enabled bundles, then by name — so the
  // answer to "what did I install" is the top of the list, never buried.
  plugins.sort((a, b) => {
    if (a.shipped !== b.shipped) return a.shipped ? 1 : -1
    if (a.bundleEnabled !== b.bundleEnabled) return a.bundleEnabled ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const liveMatches = plugins.filter(plugin => plugin.entryId !== null).length
  return {
    name: dir.split('/').pop() ?? dir,
    dir,
    bundles,
    plugins,
    liveMatches,
  }
}

/**
 * Build the full snapshot: every profile under the harness home, each with its
 * installed plugins and the live phase of the entries they materialized.
 *
 * @param ctx - host cordis context.
 * @returns the JSON-serializable snapshot.
 */
function collect(ctx) {
  const rows = loaderRows(ctx)
  const home = typeof ctx.dshHomePath === 'function' ? ctx.dshHomePath() : null
  const profiles = []

  if (home !== null) {
    const profilesDir = join(home, PROFILES_DIR)
    let names = []
    try {
      names = readdirSync(profilesDir)
    } catch {
      /* No profiles directory: report an empty snapshot with the home path. */
    }
    for (const entry of names.sort()) {
      if (entry === 'node_modules') continue
      const dir = join(profilesDir, entry)
      if (!isDirectory(dir)) continue
      if (!existsSync(join(dir, 'package.json'))) continue
      profiles.push(readProfile(dir, rows))
    }
  }

  // The running profile is the one whose installed packages match the most live
  // Loader entries; ties keep the first in sorted order.
  let active = null
  for (const profile of profiles) {
    if (active === null || profile.liveMatches > active.liveMatches) active = profile
  }
  for (const profile of profiles) profile.active = profile === active && profile.liveMatches > 0

  return { home, profiles }
}

/** Write one JSON response. */
function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(text)
}

/**
 * Serve the read-only snapshot over the web server.
 *
 * `webServer` is a web-face-only service, so it is injected dynamically: a
 * module-level `inject` declaration would leave this plugin permanently
 * pending on a non-web face that composes it.
 *
 * @param ctx - host cordis context.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'prefix',
          path: '/dsh-user-plugins/api',
          handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost')
            if (req.method === 'GET' && url.pathname === '/dsh-user-plugins/api/list') {
              try {
                sendJson(res, 200, collect(ctx))
              } catch (error) {
                sendJson(res, 500, { error: String(error?.message ?? error) })
              }
              return
            }
            sendJson(res, 404, { error: 'not found' })
          },
        }),
      'dsh-user-plugins: api route',
    )
  })
}
