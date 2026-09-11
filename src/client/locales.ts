/**
 * Copy dictionaries for the user-installed plugins Settings tab.
 *
 * The Chinese dictionary is the key source of truth; the English one is checked
 * against its key union, so a key added here and forgotten there fails the build
 * of a typechecking consumer. `tests/client.test.mjs` re-checks parity at
 * runtime, because the esbuild step this package ships through does not
 * typecheck.
 *
 * Placeholders use `{name}` and are substituted by the locale service.
 */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '我安装的插件',
  loading: '正在读取已安装插件…',
  error: '读取失败：{message}',
  retry: '重试',
  search: '搜索插件名 / 安装源 / 描述',
  refresh: '刷新',
  refreshFailed: '刷新失败（显示的是上次结果）：{message}',
  installedCount: '{count} 个已安装',
  emptyNoProfiles: '没有找到任何 profile。',
  emptySearch: '没有匹配「{query}」的已安装插件。',
  emptyNone: '还没有安装任何插件。',
  profileLabel: 'profile：{name}',
  activeProfile: '当前运行中',
  pluginCount: '{count} 个插件',
  runningCount: '{count} 运行中',
  failedCount: '{count} 个失败',
  kindBundle: '插件包',
  kindClient: '仅前端',
  kindPlain: '库',
  shipsClient: '含前端',
  providedByInstallation: '由 dsh 安装提供',
  entryLabel: 'entry：{id}',
  bundleList: 'bundle 列表：{state}',
  bundleListOn: '已启用',
  bundleListOff: '未列入',
  phasePending: '待加载',
  phaseLoading: '加载中',
  phaseActive: '运行中',
  phaseFailed: '失败',
  phaseUnloading: '卸载中',
  phaseAbsent: '未在加载器中',
  disabledSuffix: '· 已停用',
  homeLabel: 'dsh home',
} satisfies Record<string, string>

/** Locale key union of this namespace. */
export type UserPluginsLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'My installed plugins',
  loading: 'Reading installed plugins…',
  error: 'Failed to read: {message}',
  retry: 'Retry',
  search: 'Search name, install spec, or description',
  refresh: 'Refresh',
  refreshFailed: 'Refresh failed (showing the previous result): {message}',
  installedCount: '{count} installed',
  emptyNoProfiles: 'No profile was found.',
  emptySearch: 'No installed plugin matches “{query}”.',
  emptyNone: 'No plugin has been installed yet.',
  profileLabel: 'profile: {name}',
  activeProfile: 'Currently running',
  pluginCount: '{count} plugins',
  runningCount: '{count} running',
  failedCount: '{count} failed',
  kindBundle: 'Bundle',
  kindClient: 'Client only',
  kindPlain: 'Library',
  shipsClient: 'Ships client',
  providedByInstallation: 'Provided by the dsh installation',
  entryLabel: 'entry: {id}',
  bundleList: 'Bundle list: {state}',
  bundleListOn: 'Enabled',
  bundleListOff: 'Not listed',
  phasePending: 'Pending',
  phaseLoading: 'Loading',
  phaseActive: 'Running',
  phaseFailed: 'Failed',
  phaseUnloading: 'Unloading',
  phaseAbsent: 'Not in the loader',
  disabledSuffix: '· Disabled',
  homeLabel: 'dsh home',
} satisfies Record<UserPluginsLocaleKey, string>
