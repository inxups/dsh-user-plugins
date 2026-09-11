/**
 * Build the dsh-user-plugins browser bundle.
 *
 * Produces `lib/client.js` in the exact wire format the DSH web shell expects:
 * a CJS factory handed to `window.__ModuleLoader__.load({ id, factory })`,
 * where `id` equals this package's name (the Loader entry name the client
 * registry resolves the bundle by) and platform modules come from the injected
 * `require` — the shell's frozen module table.
 *
 * esbuild is a build-time tool only: the installed package ships the built
 * artifact and has zero runtime dependencies. Resolution order:
 *   1. `$DSH_ESBUILD` — an explicit package.json path.
 *   2. `$DSH_SOURCE`  — a dsh checkout root (its pnpm store or hoisted tree).
 *   3. `~/.dsh/source/current` — the conventional checkout location.
 *
 * Usage:
 *   DSH_SOURCE=/path/to/deepseek-harness node scripts/build.mjs
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Loader entry name — must equal the patch row `name` and the package name. */
const PLUGIN_ID = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name

/**
 * Platform module table (must stay aligned with
 * `packages/client/web/src/platform.ts` PLATFORM_MODULES). Everything here is
 * resolved from the shell's frozen table at runtime and must not be bundled.
 */
const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** The first existing path in `candidates`, or throw with the search list. */
function firstExisting(candidates, what) {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== '' && existsSync(candidate)) return candidate
  }
  throw new Error(`${what} not found; tried:\n  ${candidates.filter(Boolean).join('\n  ')}`)
}

/**
 * Locate esbuild's package.json.
 *
 * Resolution order — the first hit wins:
 *   1. `$DSH_ESBUILD`            an explicit path, for unusual setups.
 *   2. this package's own tree   the pinned devDependency: what CI and
 *                                contributors get from `npm install`.
 *   3. a dsh checkout            `$DSH_SOURCE` or `~/.dsh/source/current`,
 *                                for building without installing anything.
 *
 * The build output is byte-identical across these sources as long as the
 * esbuild version matches, which is what lets CI rebuild and diff `lib/`.
 */
function resolveEsbuild() {
  if (process.env.DSH_ESBUILD !== undefined) {
    return firstExisting([join(process.env.DSH_ESBUILD, 'package.json')], 'esbuild ($DSH_ESBUILD)')
  }

  try {
    return createRequire(import.meta.url).resolve('esbuild/package.json')
  } catch {
    /* No local install: fall back to a dsh checkout. */
  }

  const checkouts = [process.env.DSH_SOURCE, join(homedir(), '.dsh/source/current')].filter(Boolean)
  const candidates = []
  for (const checkout of checkouts) {
    const store = join(checkout, 'node_modules/.pnpm')
    if (existsSync(store)) {
      // Newest installed version wins, so a checkout carrying several builds
      // uses the one its own tooling resolved.
      const versions = readdirSync(store).filter(entry => entry.startsWith('esbuild@')).sort()
      for (let index = versions.length - 1; index >= 0; index -= 1) {
        candidates.push(join(store, versions[index], 'node_modules/esbuild/package.json'))
      }
    }
    candidates.push(join(checkout, 'node_modules/esbuild/package.json'))
  }
  return firstExisting(
    candidates,
    'esbuild — run `npm install`, or set $DSH_ESBUILD / $DSH_SOURCE to a dsh checkout',
  )
}

const esbuild = createRequire(resolveEsbuild())('esbuild')

const banner = [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
].join('\n')
const footer = 'return module.exports; } });'

const result = await esbuild.build({
  entryPoints: [join(ROOT, 'src/client/index.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  external: EXTERNALS,
  banner: { js: banner },
  footer: { js: footer },
  legalComments: 'none',
  logLevel: 'warning',
})

const output = result.outputFiles[0].text
const target = join(ROOT, 'lib/client.js')
writeFileSync(target, output)
console.log(`built ${target} (${output.length} bytes, id=${PLUGIN_ID})`)
