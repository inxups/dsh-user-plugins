window.__ModuleLoader__.load({ id: "dsh-user-plugins", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  UserPluginsTab: () => UserPluginsTab,
  apply: () => apply,
  en: () => en,
  inject: () => inject,
  name: () => name,
  selectUserPlugins: () => selectUserPlugins,
  zh: () => zh
});
module.exports = __toCommonJS(index_exports);

// src/client/UserPluginsTab.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
var LIST_URL = "/dsh-user-plugins/api/list";
var STYLES = `
@keyframes dsh-up-spin { to { transform: rotate(360deg) } }
.dsh-up-spin { animation: dsh-up-spin .8s linear infinite }
.dsh-up-card {
  border: 1px solid var(--dsw-alias-border-l3);
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.dsh-up-card:hover {
  border-color: var(--dsw-alias-border-l2);
  box-shadow: 0 1px 4px rgba(0, 0, 0, .07);
}
`;
var PHASE_KEY = {
  pending: "phasePending",
  loading: "phaseLoading",
  active: "phaseActive",
  failed: "phaseFailed",
  unloading: "phaseUnloading"
};
var PHASE_DOT = {
  pending: "idle",
  loading: "ongoing",
  active: "done",
  failed: "error",
  unloading: "ongoing"
};
var KIND = {
  bundle: { key: "kindBundle", tone: "info" },
  client: { key: "kindClient", tone: "neutral" },
  plain: { key: "kindPlain", tone: "quiet" }
};
var row = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
var mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
var dim = { color: "var(--dsw-alias-label-tertiary)" };
var secondary = { color: "var(--dsw-alias-label-secondary)" };
function selectUserPlugins(snapshot, query) {
  if (snapshot === null) return [];
  const needle = query.trim().toLowerCase();
  const selected = [];
  for (const profile of snapshot.profiles) {
    const shown = profile.plugins.filter((plugin) => {
      if (plugin.shipped || plugin.source === "installation") return false;
      if (needle === "") return true;
      return plugin.name.toLowerCase().includes(needle) || (plugin.spec ?? "").toLowerCase().includes(needle) || (plugin.description ?? "").toLowerCase().includes(needle);
    });
    if (shown.length > 0) selected.push({ profile, shown });
  }
  return selected;
}
function PluginCard({ plugin, t }) {
  const phase = plugin.phase;
  const live = phase !== null;
  const kind = KIND[plugin.kind];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-up-card", style: { borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...mono, fontWeight: 600, fontSize: 13, color: "var(--dsw-alias-label-primary)" }, children: plugin.name }),
      plugin.version !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_dsh_client_ui_primitives.Tag, { tone: "neutral", children: [
        "v",
        plugin.version
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: kind.tone, children: t(kind.key) }),
      plugin.client && plugin.kind !== "client" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "outline", children: t("shipsClient") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { ...row, gap: 5, marginLeft: "auto" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: live ? PHASE_DOT[phase] ?? "idle" : "idle", size: 8 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 11, ...secondary }, children: [
          live ? t(PHASE_KEY[phase] ?? phase) : t("phaseAbsent"),
          plugin.enabled === false && ` ${t("disabledSuffix")}`
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...mono, fontSize: 11, ...dim, wordBreak: "break-all" }, children: plugin.spec ?? t("providedByInstallation") }),
    plugin.description !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, ...secondary, lineHeight: 1.55 }, children: plugin.description }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...row, gap: 14, fontSize: 11, ...dim }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("entryLabel", { id: plugin.entryId ?? "\u2014" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("bundleList", { state: t(plugin.bundleEnabled ? "bundleListOn" : "bundleListOff") }) })
    ] })
  ] });
}
function ProfileSection({ profile, shown, t }) {
  const running = shown.filter((plugin) => plugin.phase === "active").length;
  const failed = shown.filter((plugin) => plugin.phase === "failed").length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { display: "flex", flexDirection: "column", gap: 9 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 13, color: "var(--dsw-alias-label-primary)" }, children: t("profileLabel", { name: profile.name }) }),
      profile.active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "success", children: t("activeProfile") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "neutral", children: t("pluginCount", { count: shown.length }) }),
      running > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, ...dim }, children: t("runningCount", { count: running }) }),
      failed > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: "var(--dsw-alias-state-error-primary)" }, children: t("failedCount", { count: failed }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...mono, fontSize: 11, ...dim }, children: profile.dir }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: shown.map((plugin) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PluginCard, { plugin, t }, plugin.name)) })
  ] });
}
function UserPluginsTab({ t }) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [query, setQuery] = (0, import_react.useState)("");
  const load = (0, import_react.useCallback)(async () => {
    setLoading(true);
    try {
      const response = await fetch(LIST_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSnapshot(await response.json());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  (0, import_react.useEffect)(() => {
    void load();
  }, [load]);
  const profiles = (0, import_react.useMemo)(() => selectUserPlugins(snapshot, query), [snapshot, query]);
  const total = profiles.reduce((sum, entry) => sum + entry.shown.length, 0);
  if (loading && snapshot === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 16, fontSize: 13, ...dim }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLES }),
      t("loading")
    ] });
  }
  if (error !== null && snapshot === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLES }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, color: "var(--dsw-alias-state-error-primary)" }, children: t("error", { message: error }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconRefreshOutline16, {}), onClick: () => void load(), children: t("retry") })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 14, padding: "2px 0" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLES }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...row, gap: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { flex: "1 1 220px", minWidth: 170 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Input,
        {
          type: "search",
          value: query,
          placeholder: t("search"),
          icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconSearchOutline16, {}),
          onChange: (event) => setQuery(event.target.value)
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, ...dim, whiteSpace: "nowrap" }, children: t("installedCount", { count: total }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "outline",
          size: "sm",
          disabled: loading,
          onClick: () => void load(),
          icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: loading ? "dsh-up-spin" : void 0, style: { display: "inline-flex" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconRefreshOutline16, {}) }),
          children: t("refresh")
        }
      )
    ] }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-alias-state-error-primary)" }, children: t("refreshFailed", { message: error }) }),
    total === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "18px 4px", fontSize: 13, ...dim, lineHeight: 1.7 }, children: [
      snapshot !== null && snapshot.profiles.length === 0 ? t("emptyNoProfiles") : query.trim() !== "" ? t("emptySearch", { query: query.trim() }) : t("emptyNone"),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 6, ...mono, fontSize: 11 }, children: "dsh plugin --profile <name> add <package>" })
    ] }) : profiles.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileSection, { profile: entry.profile, shown: entry.shown, t }, entry.profile.name)),
    snapshot?.home != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 11, ...dim, borderTop: "1px solid var(--dsw-alias-border-l3)", paddingTop: 9 }, children: [
      t("homeLabel"),
      ": ",
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: mono, children: snapshot.home })
    ] })
  ] });
}

// src/client/locales.ts
var zh = {
  tab: "\u6211\u5B89\u88C5\u7684\u63D2\u4EF6",
  loading: "\u6B63\u5728\u8BFB\u53D6\u5DF2\u5B89\u88C5\u63D2\u4EF6\u2026",
  error: "\u8BFB\u53D6\u5931\u8D25\uFF1A{message}",
  retry: "\u91CD\u8BD5",
  search: "\u641C\u7D22\u63D2\u4EF6\u540D / \u5B89\u88C5\u6E90 / \u63CF\u8FF0",
  refresh: "\u5237\u65B0",
  refreshFailed: "\u5237\u65B0\u5931\u8D25\uFF08\u663E\u793A\u7684\u662F\u4E0A\u6B21\u7ED3\u679C\uFF09\uFF1A{message}",
  installedCount: "{count} \u4E2A\u5DF2\u5B89\u88C5",
  emptyNoProfiles: "\u6CA1\u6709\u627E\u5230\u4EFB\u4F55 profile\u3002",
  emptySearch: "\u6CA1\u6709\u5339\u914D\u300C{query}\u300D\u7684\u5DF2\u5B89\u88C5\u63D2\u4EF6\u3002",
  emptyNone: "\u8FD8\u6CA1\u6709\u5B89\u88C5\u4EFB\u4F55\u63D2\u4EF6\u3002",
  profileLabel: "profile\uFF1A{name}",
  activeProfile: "\u5F53\u524D\u8FD0\u884C\u4E2D",
  pluginCount: "{count} \u4E2A\u63D2\u4EF6",
  runningCount: "{count} \u8FD0\u884C\u4E2D",
  failedCount: "{count} \u4E2A\u5931\u8D25",
  kindBundle: "\u63D2\u4EF6\u5305",
  kindClient: "\u4EC5\u524D\u7AEF",
  kindPlain: "\u5E93",
  shipsClient: "\u542B\u524D\u7AEF",
  providedByInstallation: "\u7531 dsh \u5B89\u88C5\u63D0\u4F9B",
  entryLabel: "entry\uFF1A{id}",
  bundleList: "bundle \u5217\u8868\uFF1A{state}",
  bundleListOn: "\u5DF2\u542F\u7528",
  bundleListOff: "\u672A\u5217\u5165",
  phasePending: "\u5F85\u52A0\u8F7D",
  phaseLoading: "\u52A0\u8F7D\u4E2D",
  phaseActive: "\u8FD0\u884C\u4E2D",
  phaseFailed: "\u5931\u8D25",
  phaseUnloading: "\u5378\u8F7D\u4E2D",
  phaseAbsent: "\u672A\u5728\u52A0\u8F7D\u5668\u4E2D",
  disabledSuffix: "\xB7 \u5DF2\u505C\u7528",
  homeLabel: "dsh home"
};
var en = {
  tab: "My installed plugins",
  loading: "Reading installed plugins\u2026",
  error: "Failed to read: {message}",
  retry: "Retry",
  search: "Search name, install spec, or description",
  refresh: "Refresh",
  refreshFailed: "Refresh failed (showing the previous result): {message}",
  installedCount: "{count} installed",
  emptyNoProfiles: "No profile was found.",
  emptySearch: "No installed plugin matches \u201C{query}\u201D.",
  emptyNone: "No plugin has been installed yet.",
  profileLabel: "profile: {name}",
  activeProfile: "Currently running",
  pluginCount: "{count} plugins",
  runningCount: "{count} running",
  failedCount: "{count} failed",
  kindBundle: "Bundle",
  kindClient: "Client only",
  kindPlain: "Library",
  shipsClient: "Ships client",
  providedByInstallation: "Provided by the dsh installation",
  entryLabel: "entry: {id}",
  bundleList: "Bundle list: {state}",
  bundleListOn: "Enabled",
  bundleListOff: "Not listed",
  phasePending: "Pending",
  phaseLoading: "Loading",
  phaseActive: "Running",
  phaseFailed: "Failed",
  phaseUnloading: "Unloading",
  phaseAbsent: "Not in the loader",
  disabledSuffix: "\xB7 Disabled",
  homeLabel: "dsh home"
};

// src/client/index.ts
var NS = "settings.userPlugins";
var name = "dsh-user-plugins";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-user-plugins: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject(
    "settings.plugins.tab",
    () => ctx.slots.register(
      {
        name: "settings.plugins.tab",
        id: "user-installed",
        order: 20,
        // A thunk, so the tab title follows the active locale on every read.
        label: () => t("tab"),
        locale: NS
      },
      UserPluginsTab
    )
  );
}
return module.exports; } });
