/**
 * dsh-user-plugins — browser entry.
 *
 * Contributes one tab to the Web Plugins settings section (`settings.plugins.tab`,
 * the same list slot the shipped Loader inventory occupies) that answers a
 * question that inventory cannot: which plugins the *user* installed into their
 * profiles, with the install spec and version behind each one.
 *
 * Registration goes through `ctx.slots.inject` so it follows the Plugins
 * section's declaration lifecycle: this plugin never imports the section owner,
 * and activation order does not matter.
 *
 * All copy lives in this plugin's own locale namespace (`settings.userPlugins`)
 * with a Chinese and an English dictionary. Declaring `locale` on the
 * registration puts the framework-synthesized `t` seat on the component props,
 * and the `label` thunk is re-read on every render, so both the tab title and
 * the tab body follow a live language switch without re-registration.
 *
 * @module dsh-user-plugins/client
 */

import { UserPluginsTab } from './UserPluginsTab'
import { en, zh, type UserPluginsLocaleKey } from './locales'

/** The tab component, re-exported so tests can render it without the shell. */
export { UserPluginsTab }
/** The snapshot→view projection, re-exported so its rules are testable. */
export { selectUserPlugins } from './UserPluginsTab'
/** The dictionaries, re-exported so tests can check zh/en parity at runtime. */
export { en, zh }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** User-installed plugins tab copy. */
    'settings.userPlugins': UserPluginsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.userPlugins'

export const name = 'dsh-user-plugins'

/** Services required before `apply` runs. */
export const inject = ['slots', 'locale']

/**
 * Register the dictionaries and the tab.
 *
 * `order: 20` places the tab after the shipped plugin inventory (order 10) so
 * the roster reads official-first, user-installed beside it.
 *
 * @param ctx - browser cordis context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-user-plugins: dictionaries')

  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.plugins.tab', () =>
    ctx.slots.register(
      {
        name: 'settings.plugins.tab',
        id: 'user-installed',
        order: 20,
        // A thunk, so the tab title follows the active locale on every read.
        label: () => t('tab'),
        locale: NS,
      },
      UserPluginsTab,
    ),
  )
}
