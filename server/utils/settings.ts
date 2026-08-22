export type SmtpTransportSettings = {
  host: string
  port: string
  auth: { user: string; pass: string }
  secure: boolean
}

export type MailgunTransportSettings = {
  auth: { api_key: string; domain: string }
}

export type SendmailTransportSettings = {
  sendmail: boolean
}

export type EmailTransportConfig = {
  name: 'smtp' | 'sendmail' | 'mailgun'
  description: string
  settings: SmtpTransportSettings | SendmailTransportSettings | MailgunTransportSettings
}

export type OAuthProviderId = 'google' | 'facebook' | 'line' | 'github' | 'gitlab'

export const DEFAULT_GITLAB_BASE_URL = 'https://gitlab.com'

export type OAuthProviderStored = {
  enabled: boolean
  clientId: string
  clientSecretEnc: string
  issuerBaseUrl: string
}

export type OAuthProviderPublic = {
  enabled: boolean
  clientId: string
  secretConfigured: boolean
  issuerBaseUrl: string
}

export function normalizeIssuerBaseUrl(raw: string | undefined, fallback: string) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '')
  if (!trimmed) return fallback
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback
    return url.origin
  } catch {
    return fallback
  }
}

export type AppSettingsData = {
  signup_enable: boolean
  signup_require_activation: boolean
  info_polling_interval: number
  baseUrl: string
  email_default_sender_name: string
  email_default_sender: string
  email_notifications: boolean
  default_transport: string | null
  email_transports: EmailTransportConfig[]
  notify_when: Record<
    string,
    {
      title: string
      description: string
      active: boolean
    }
  >
  integrations: Array<{
    id: string
    name: string
    image?: string
    config: {
      enabled: boolean
      fields: Array<{
        id: string
        name: string
        type: string
        required?: boolean
        value: string
      }>
      [key: string]: unknown
    }
  }>
  user_permissions: Record<
    string,
    { create: boolean; read: boolean; update: boolean; delete: boolean }
  >
  oauth_providers: Record<OAuthProviderId, OAuthProviderStored>
}

export const OAUTH_PROVIDER_IDS: OAuthProviderId[] = ['google', 'facebook', 'line', 'github', 'gitlab']

export function emptyOAuthProviders(): Record<OAuthProviderId, OAuthProviderStored> {
  return {
    google: { enabled: false, clientId: '', clientSecretEnc: '', issuerBaseUrl: '' },
    facebook: { enabled: false, clientId: '', clientSecretEnc: '', issuerBaseUrl: '' },
    line: { enabled: false, clientId: '', clientSecretEnc: '', issuerBaseUrl: '' },
    github: { enabled: false, clientId: '', clientSecretEnc: '', issuerBaseUrl: '' },
    gitlab: {
      enabled: false,
      clientId: '',
      clientSecretEnc: '',
      issuerBaseUrl: DEFAULT_GITLAB_BASE_URL
    }
  }
}

const PERM = { create: false, read: true, update: false, delete: false }

export const DEFAULT_EMAIL_TRANSPORTS: EmailTransportConfig[] = [
  {
    name: 'smtp',
    description: 'Send emails using the SMTP protocol',
    settings: {
      host: '',
      port: '',
      auth: { user: '', pass: '' },
      secure: false
    }
  },
  {
    name: 'sendmail',
    description: 'Pipe messages to the sendmail command',
    settings: { sendmail: true }
  },
  {
    name: 'mailgun',
    description: "Send emails through Mailgun's Web API",
    settings: {
      auth: { api_key: '', domain: '' }
    }
  }
]

export const DEFAULT_SETTINGS: AppSettingsData = {
  signup_enable: false,
  signup_require_activation: false,
  info_polling_interval: 5000,
  baseUrl: '',
  email_default_sender_name: 'KONGA',
  email_default_sender: 'konga@konga.test',
  email_notifications: false,
  default_transport: 'sendmail',
  email_transports: structuredClone(DEFAULT_EMAIL_TRANSPORTS),
  notify_when: {
    node_down: {
      title: 'A node is down or unresponsive',
      description: 'Health checks must be enabled for the nodes that need to be monitored.',
      active: false
    },
    api_down: {
      title: 'An API is down or unresponsive',
      description: 'Health checks must be enabled for the APIs that need to be monitored.',
      active: false
    }
  },
  integrations: [
    {
      id: 'slack',
      name: 'Slack',
      image: 'slack.svg',
      config: {
        enabled: false,
        fields: [
          {
            id: 'slack_webhook_url',
            name: 'Slack Webhook URL',
            type: 'text',
            required: true,
            value: ''
          }
        ],
        slack_webhook_url: ''
      }
    },
    {
      id: 'discord',
      name: 'Discord',
      image: 'discord.png',
      config: {
        enabled: false,
        fields: [
          {
            id: 'discord_webhook_url',
            name: 'Discord Webhook URL',
            type: 'text',
            required: true,
            value: ''
          }
        ],
        discord_webhook_url: ''
      }
    }
  ],
  user_permissions: {
    services: { ...PERM },
    routes: { ...PERM },
    consumers: { ...PERM },
    plugins: { ...PERM },
    upstreams: { ...PERM },
    certificates: { ...PERM },
    connections: { ...PERM },
    users: { ...PERM }
  },
  oauth_providers: emptyOAuthProviders()
}

function mergeTransports(raw: unknown): EmailTransportConfig[] {
  const base = structuredClone(DEFAULT_EMAIL_TRANSPORTS)
  if (!Array.isArray(raw) || !raw.length) return base
  return base.map((def) => {
    const found = (raw as EmailTransportConfig[]).find((t) => t.name === def.name)
    if (!found) return def
    if (def.name === 'smtp') {
      const incoming = (found.settings || {}) as Partial<SmtpTransportSettings>
      const defaults = def.settings as SmtpTransportSettings
      return {
        ...def,
        description: found.description || def.description,
        settings: {
          host: incoming.host ?? defaults.host,
          port: incoming.port != null ? String(incoming.port) : defaults.port,
          secure: Boolean(incoming.secure),
          auth: {
            user: incoming.auth?.user ?? defaults.auth.user,
            pass: incoming.auth?.pass ?? defaults.auth.pass
          }
        }
      }
    }
    if (def.name === 'mailgun') {
      const incoming = (found.settings || {}) as Partial<MailgunTransportSettings>
      const defaults = def.settings as MailgunTransportSettings
      return {
        ...def,
        description: found.description || def.description,
        settings: {
          auth: {
            api_key: incoming.auth?.api_key ?? defaults.auth.api_key,
            domain: incoming.auth?.domain ?? defaults.auth.domain
          }
        }
      }
    }
    return {
      ...def,
      description: found.description || def.description,
      settings: { ...(def.settings as object), ...(found.settings as object) } as EmailTransportConfig['settings']
    }
  })
}

function mergeOAuthProviders(raw: unknown): Record<OAuthProviderId, OAuthProviderStored> {
  const base = emptyOAuthProviders()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Record<string, Partial<OAuthProviderStored>>
  for (const id of OAUTH_PROVIDER_IDS) {
    const incoming = data[id]
    if (!incoming || typeof incoming !== 'object') continue
    const issuerFallback = id === 'gitlab' ? DEFAULT_GITLAB_BASE_URL : ''
    base[id] = {
      enabled: Boolean(incoming.enabled),
      clientId: String(incoming.clientId || ''),
      clientSecretEnc: String(incoming.clientSecretEnc || ''),
      issuerBaseUrl: normalizeIssuerBaseUrl(incoming.issuerBaseUrl, issuerFallback)
    }
  }
  return base
}

export function oauthProviderReady(row: OAuthProviderStored) {
  return Boolean(row.enabled && row.clientId.trim() && row.clientSecretEnc)
}

export function sanitizeSettings(settings: AppSettingsData) {
  const oauth_providers = Object.fromEntries(
    OAUTH_PROVIDER_IDS.map((id) => {
      const row = settings.oauth_providers[id]
      return [
        id,
        {
          enabled: row.enabled,
          clientId: row.clientId,
          secretConfigured: Boolean(row.clientSecretEnc),
          issuerBaseUrl:
            id === 'gitlab'
              ? normalizeIssuerBaseUrl(row.issuerBaseUrl, DEFAULT_GITLAB_BASE_URL)
              : row.issuerBaseUrl || ''
        } satisfies OAuthProviderPublic
      ]
    })
  ) as Record<OAuthProviderId, OAuthProviderPublic>
  return { ...settings, oauth_providers }
}

export function applyOAuthProvidersUpdate(
  current: Record<OAuthProviderId, OAuthProviderStored>,
  incoming: unknown,
  encryptSecret: (value: string) => string
): Record<OAuthProviderId, OAuthProviderStored> {
  const next = emptyOAuthProviders()
  const data = incoming && typeof incoming === 'object' ? (incoming as Record<string, any>) : {}
  for (const id of OAUTH_PROVIDER_IDS) {
    const prev = current[id]
    const row = data[id] || {}
    const secret = typeof row.clientSecret === 'string' ? row.clientSecret.trim() : ''
    const issuerFallback = id === 'gitlab' ? DEFAULT_GITLAB_BASE_URL : ''
    next[id] = {
      enabled: typeof row.enabled === 'boolean' ? row.enabled : prev.enabled,
      clientId: typeof row.clientId === 'string' ? row.clientId.trim() : prev.clientId,
      clientSecretEnc: secret ? encryptSecret(secret) : prev.clientSecretEnc,
      issuerBaseUrl:
        typeof row.issuerBaseUrl === 'string'
          ? normalizeIssuerBaseUrl(row.issuerBaseUrl, issuerFallback)
          : normalizeIssuerBaseUrl(prev.issuerBaseUrl, issuerFallback)
    }
  }
  return next
}

function mergeIntegrations(raw: unknown): AppSettingsData['integrations'] {
  const base = structuredClone(DEFAULT_SETTINGS.integrations)
  if (!Array.isArray(raw) || !raw.length) return base
  return base.map((def) => {
    const found = (raw as AppSettingsData['integrations']).find((item) => item.id === def.id)
    if (!found) return def
    const fields = (def.config.fields || []).map((field) => {
      const incoming = found.config?.fields?.find((f) => f.id === field.id)
      const topLevel = found.config?.[field.id]
      const value = String(topLevel ?? incoming?.value ?? field.value ?? '')
      return { ...field, ...incoming, value }
    })
    const config: AppSettingsData['integrations'][number]['config'] = {
      ...def.config,
      enabled: Boolean(found.config?.enabled),
      fields
    }
    for (const field of fields) {
      config[field.id] = field.value
    }
    return {
      ...def,
      name: found.name || def.name,
      image: found.image || def.image,
      config
    }
  })
}

export function mergeSettings(raw: unknown): AppSettingsData {
  const base = structuredClone(DEFAULT_SETTINGS)
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<AppSettingsData>
  return {
    ...base,
    ...data,
    email_transports: mergeTransports(data.email_transports),
    notify_when: { ...base.notify_when, ...(data.notify_when || {}) },
    integrations: mergeIntegrations(data.integrations),
    user_permissions: { ...base.user_permissions, ...(data.user_permissions || {}) },
    oauth_providers: mergeOAuthProviders(data.oauth_providers)
  }
}
