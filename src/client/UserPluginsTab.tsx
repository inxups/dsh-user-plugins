/**
 * The user-installed plugins settings tab.
 *
 * Renders the host half's `/dsh-user-plugins/api/list` snapshot, limited to the
 * plugins the **user** installed: harness-shipped packages (`@deepseek-ai/*`)
 * are filtered out entirely rather than toggled, because the shipped Loader
 * inventory next door already covers them in full.
 *
 * Chrome comes from the platform's own primitives (`Button`, `Input`, `Tag`,
 * `StateDot` and the icon set) resolved through the shell's frozen module
 * table, so this panel inherits the real design tokens instead of imitating
 * them. Copy comes from the registration's `t` seat (this namespace is declared
 * on the slot entry), so nothing here is hardcoded prose. The tab adds no
 * third-party runtime dependency.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  IconRefreshOutline16,
  IconSearchOutline16,
  Input,
  StateDot,
  Tag,
  type StateDotState,
  type TagTone,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

/** Route owned by this plugin's host half. */
const LIST_URL = '/dsh-user-plugins/api/list'

/** Extra rules the platform tokens do not express: one keyframe and a hover lift. */
const STYLES = `
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
`

interface PluginRow {
  name: string
  spec: string | null
  shipped: boolean
  source: 'profile' | 'installation'
  version: string | null
  description: string | null
  homepage: string | null
  kind: 'bundle' | 'client' | 'plain'
  patch: string | null
  client: boolean
  bundleEnabled: boolean
  entryId: string | null
  phase: string | null
  enabled: boolean | null
}

interface ProfileRow {
  name: string
  dir: string
  bundles: string[]
  plugins: PluginRow[]
  active: boolean
}

interface Snapshot {
  home: string | null
  profiles: ProfileRow[]
}

/** Live-phase vocabulary → dictionary key. */
const PHASE_KEY: Record<string, string> = {
  pending: 'phasePending',
  loading: 'phaseLoading',
  active: 'phaseActive',
  failed: 'phaseFailed',
  unloading: 'phaseUnloading',
}

/** Live-phase → the platform's state-dot semantics. */
const PHASE_DOT: Record<string, StateDotState> = {
  pending: 'idle',
  loading: 'ongoing',
  active: 'done',
  failed: 'error',
  unloading: 'ongoing',
}

/** Contributed-kind → dictionary key and tag palette. */
const KIND: Record<PluginRow['kind'], { key: string; tone: TagTone }> = {
  bundle: { key: 'kindBundle', tone: 'info' },
  client: { key: 'kindClient', tone: 'neutral' },
  plain: { key: 'kindPlain', tone: 'quiet' },
}

const row = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } as const
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const
const dim = { color: 'var(--dsw-alias-label-tertiary)' } as const
const secondary = { color: 'var(--dsw-alias-label-secondary)' } as const

/** One profile together with the user-installed plugins it contributes. */
export interface ProfileSelection {
  profile: ProfileRow
  shown: PluginRow[]
}

/**
 * Project the snapshot onto what this panel shows: user-installed plugins only
 * — harness-shipped (`@deepseek-ai/*`) and installation-provided rows are
 * dropped outright — narrowed by a case-insensitive search over name, install
 * spec, and description.
 *
 * Kept as a pure export so the filtering rule is testable without a DOM, and
 * free of copy so it never needs the translator.
 *
 * @param snapshot - the host snapshot, or null before the first read.
 * @param query - raw search text; blank keeps everything.
 * @returns one entry per profile that still has a match, in snapshot order.
 */
export function selectUserPlugins(snapshot: Snapshot | null, query: string): ProfileSelection[] {
  if (snapshot === null) return []
  const needle = query.trim().toLowerCase()
  const selected: ProfileSelection[] = []
  for (const profile of snapshot.profiles) {
    const shown = profile.plugins.filter((plugin) => {
      if (plugin.shipped || plugin.source === 'installation') return false
      if (needle === '') return true
      return (
        plugin.name.toLowerCase().includes(needle)
        || (plugin.spec ?? '').toLowerCase().includes(needle)
        || (plugin.description ?? '').toLowerCase().includes(needle)
      )
    })
    if (shown.length > 0) selected.push({ profile, shown })
  }
  return selected
}

/** One plugin card. */
function PluginCard({ plugin, t }: { plugin: PluginRow; t: Translate }) {
  const phase = plugin.phase
  const live = phase !== null
  const kind = KIND[plugin.kind]
  return (
    <div className="dsh-up-card" style={{ borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={row}>
        <span style={{ ...mono, fontWeight: 600, fontSize: 13, color: 'var(--dsw-alias-label-primary)' }}>
          {plugin.name}
        </span>
        {plugin.version !== null && <Tag tone="neutral">v{plugin.version}</Tag>}
        <Tag tone={kind.tone}>{t(kind.key)}</Tag>
        {plugin.client && plugin.kind !== 'client' && <Tag tone="outline">{t('shipsClient')}</Tag>}
        <span style={{ ...row, gap: 5, marginLeft: 'auto' }}>
          <StateDot state={live ? (PHASE_DOT[phase] ?? 'idle') : 'idle'} size={8} />
          <span style={{ fontSize: 11, ...secondary }}>
            {live ? t(PHASE_KEY[phase] ?? phase) : t('phaseAbsent')}
            {plugin.enabled === false && ` ${t('disabledSuffix')}`}
          </span>
        </span>
      </div>

      <div style={{ ...mono, fontSize: 11, ...dim, wordBreak: 'break-all' }}>
        {plugin.spec ?? t('providedByInstallation')}
      </div>

      {plugin.description !== null && (
        <div style={{ fontSize: 12, ...secondary, lineHeight: 1.55 }}>{plugin.description}</div>
      )}

      <div style={{ ...row, gap: 14, fontSize: 11, ...dim }}>
        <span>{t('entryLabel', { id: plugin.entryId ?? '—' })}</span>
        <span>{t('bundleList', { state: t(plugin.bundleEnabled ? 'bundleListOn' : 'bundleListOff') })}</span>
      </div>
    </div>
  )
}

/** One profile section: heading, counts, then its plugin cards. */
function ProfileSection({ profile, shown, t }: { profile: ProfileRow; shown: PluginRow[]; t: Translate }) {
  const running = shown.filter(plugin => plugin.phase === 'active').length
  const failed = shown.filter(plugin => plugin.phase === 'failed').length
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={row}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--dsw-alias-label-primary)' }}>
          {t('profileLabel', { name: profile.name })}
        </span>
        {profile.active && <Tag tone="success">{t('activeProfile')}</Tag>}
        <Tag tone="neutral">{t('pluginCount', { count: shown.length })}</Tag>
        {running > 0 && <span style={{ fontSize: 11, ...dim }}>{t('runningCount', { count: running })}</span>}
        {failed > 0 && (
          <span style={{ fontSize: 11, color: 'var(--dsw-alias-state-error-primary)' }}>
            {t('failedCount', { count: failed })}
          </span>
        )}
      </div>
      <div style={{ ...mono, fontSize: 11, ...dim }}>{profile.dir}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.map(plugin => <PluginCard key={plugin.name} plugin={plugin} t={t} />)}
      </div>
    </section>
  )
}

/**
 * The tab body. Reads the snapshot on first mount and on demand; shipped
 * harness packages never reach the view.
 *
 * `t` arrives from the framework because the registration declares this
 * plugin's locale namespace.
 */
export function UserPluginsTab({ t }: { t: Translate }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(LIST_URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setSnapshot((await response.json()) as Snapshot)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // User-installed only, then the search filter. Both are pure projections of
  // the snapshot, so a refresh never has to reconcile view state by hand.
  const profiles = useMemo(() => selectUserPlugins(snapshot, query), [snapshot, query])

  const total = profiles.reduce((sum, entry) => sum + entry.shown.length, 0)

  if (loading && snapshot === null) {
    return (
      <div style={{ padding: 16, fontSize: 13, ...dim }}>
        <style>{STYLES}</style>
        {t('loading')}
      </div>
    )
  }

  if (error !== null && snapshot === null) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <style>{STYLES}</style>
        <div style={{ fontSize: 13, color: 'var(--dsw-alias-state-error-primary)' }}>
          {t('error', { message: error })}
        </div>
        <Button variant="outline" size="sm" icon={<IconRefreshOutline16 />} onClick={() => void load()}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 0' }}>
      <style>{STYLES}</style>

      <div style={{ ...row, gap: 10 }}>
        <div style={{ flex: '1 1 220px', minWidth: 170 }}>
          <Input
            type="search"
            value={query}
            placeholder={t('search')}
            icon={<IconSearchOutline16 />}
            onChange={event => setQuery((event.target as HTMLInputElement).value)}
          />
        </div>
        <span style={{ fontSize: 12, ...dim, whiteSpace: 'nowrap' }}>
          {t('installedCount', { count: total })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
          icon={
            <span className={loading ? 'dsh-up-spin' : undefined} style={{ display: 'inline-flex' }}>
              <IconRefreshOutline16 />
            </span>
          }
        >
          {t('refresh')}
        </Button>
      </div>

      {error !== null && (
        <div style={{ fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' }}>
          {t('refreshFailed', { message: error })}
        </div>
      )}

      {total === 0 ? (
        <div style={{ padding: '18px 4px', fontSize: 13, ...dim, lineHeight: 1.7 }}>
          {snapshot !== null && snapshot.profiles.length === 0
            ? t('emptyNoProfiles')
            : query.trim() !== ''
              ? t('emptySearch', { query: query.trim() })
              : t('emptyNone')}
          <div style={{ marginTop: 6, ...mono, fontSize: 11 }}>
            dsh plugin --profile &lt;name&gt; add &lt;package&gt;
          </div>
        </div>
      ) : (
        profiles.map(entry => (
          <ProfileSection key={entry.profile.name} profile={entry.profile} shown={entry.shown} t={t} />
        ))
      )}

      {snapshot?.home != null && (
        <div style={{ fontSize: 11, ...dim, borderTop: '1px solid var(--dsw-alias-border-l3)', paddingTop: 9 }}>
          {t('homeLabel')}: <span style={mono}>{snapshot.home}</span>
        </div>
      )}
    </div>
  )
}
