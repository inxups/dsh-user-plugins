# dsh-user-plugins

A [dsh](https://github.com/deepseek-ai/deepseek-harness) plugin with both halves — host and browser —
that adds a **My installed plugins** tab to the Web GUI under **Settings → Plugins**. It lists the
packages you installed into your dsh profiles with `dsh plugin --profile <name> add`: install spec,
on-disk version, contributed kind, and each one's live loader phase.

English | [中文](README.md)

## Install

```sh
dsh plugin --profile web add github:inxups/dsh-user-plugins
```

`dsh plugin` forwards to pnpm inside the profile directory and appends this package to
`dsh.profile.bundles` (it declares `dsh.bundle`). **Restart dsh** afterwards so the plugin joins the
composition.

If you run dsh from source, replace `dsh` with `pnpm dsh`.

## How it differs from the built-in "Plugin list"

dsh ships `ui-settings-plugin-inventory` (Settings → Plugins → **Plugin list**). That tab renders the
**loader's entries** — shipped and third-party packages together — with no install spec, no version,
and no per-profile attribution. The two are complementary:

| | Plugin list (built-in) | My installed plugins (this plugin) |
|---|---|---|
| Source | loader entries (runtime) | profile `package.json` deps + bundle list (disk) |
| Scope | everything composed, shipped packages included | **only what you installed**; `@deepseek-ai/*` never shown |
| Install spec | no | yes (`github:` / `link:` / version range) |
| Version | no | yes (read from each package's manifest) |
| Profile attribution | no | yes, with the running one marked |

Shipped packages are filtered out outright — no toggle, no disclosure. Use the tab next door for
those.

## Structure

```
dsh-user-plugins/
├── package.json            # declares dsh.bundle (host row) and dsh.client (browser half)
├── cordis.patch.yml        # bundle layer: inserts the host row into the profile's roster
├── lib/index.js            # host half: profile scan + GET /dsh-user-plugins/api/list
├── lib/client.js           # browser half (build artifact, committed)
├── src/client/
│   ├── index.ts            # Cordis registration: locale namespace + tab
│   ├── UserPluginsTab.tsx  # the panel + the pure selectUserPlugins projection
│   └── locales.ts          # zh / en dictionaries
├── scripts/build.mjs       # esbuild → lib/client.js
├── tests/                  # host, client, and end-to-end node:test layers
└── .github/workflows/ci.yml
```

The host half has **zero runtime dependencies** (`node:fs` / `node:path` only). The browser half uses
**platform modules only** (`react` + `@deepseek-ai/dsh-client-ui-primitives`) and pulls in no
third-party UI library.

## UI

Every control comes from the platform's own UI atoms, so the panel shares the GUI's design tokens and
follows theme and light/dark changes for free:

| Element | From |
|---|---|
| Refresh button | `Button` (`variant="outline"`, `size="sm"`) + `IconRefreshOutline16` |
| Search box | `Input` + `IconSearchOutline16` |
| Version / kind tags | `Tag` (`neutral` / `info` / `outline` / `quiet` palettes) |
| Live status dot | `StateDot` (`done` / `ongoing` / `error` / `idle`; `ongoing` animates) |

While refreshing, the button's icon spins and the button disables, while the label stays put so the
button never changes width. A failed refresh keeps the previous result on screen and reports the
failure above it rather than blanking the panel.

## Data and API

`GET /dsh-user-plugins/api/list` returns a read-only snapshot:

```jsonc
{
  "home": "/Users/you/.dsh",
  "profiles": [{
    "name": "web",
    "dir": "/Users/you/.dsh/profiles/web",
    "bundles": ["@deepseek-ai/dsh-base", "dsh-memory-evolve", "..."],
    "active": true,               // the profile matching the most loader entries
    "plugins": [{
      "name": "dsh-memory-evolve",
      "spec": "github:csyangwen/dsh-memory-evolve",
      "shipped": false,           // whether it is a shipped @deepseek-ai/* package
      "source": "profile",        // profile dependency | installation (provided by dsh)
      "version": "0.1.0",
      "kind": "bundle",           // bundle | client | plain
      "client": true,             // ships a browser half
      "bundleEnabled": true,      // listed in the profile's bundle list
      "entryId": "dsh-memory-evolve",
      "phase": "active",          // pending|loading|active|failed|unloading|null
      "enabled": true
    }]
  }]
}
```

Read-only: it cannot enable, disable, install, or remove anything, matching the built-in inventory.
The endpoint returns the **complete** snapshot (shipped packages and the `shipped` flag included);
filtering happens in the browser, so the data layer stays honest and the view rule lives in one
testable place — `selectUserPlugins()`.

## Known limitations

- `version` / `description` are readable only for packages inside the profile's own `node_modules`.
  Shipped `@deepseek-ai/*` packages resolve from the dsh installation instead, so those fields are
  `null` and `source` reads `installation`. That is intentional: shipped packages are not "yours".
- The running profile is inferred as the one matching the most loader entries, not read from the
  launch arguments.
- The snapshot is read per request with no change subscription; the **Refresh** button re-reads it.
- A plugin's own `description` is package metadata, not dictionary copy, so it may appear in Chinese
  even under an English UI — each plugin author owns their manifest language.
- Only `zh` and `en` dictionaries exist; other GUI locales fall back to English.

## License

MIT
