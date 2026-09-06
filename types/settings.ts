export type SmtpSettings = {
  host: string
  port: string
  auth: { user: string; pass: string }
  secure: boolean
}

export type MailgunSettings = {
  auth: { api_key: string; domain: string }
}

export type Transport = {
  name: 'smtp' | 'sendmail' | 'mailgun'
  description: string
  settings: SmtpSettings | MailgunSettings | { sendmail: boolean }
}

export type OAuthProviderId = 'google' | 'facebook' | 'line' | 'github' | 'gitlab'

export type LineSendMode = 'followers' | 'rooms' | 'users'

export type LineKnownRoom = { id: string; name: string; kind: 'group' | 'room' }
export type LineKnownUser = { id: string; name: string }

export type SettingsIntegration = {
  id: string
  name: string
  image?: string
  config: {
    enabled: boolean
    fields: Array<{ id: string; name: string; type: string; required?: boolean; value: string }>
    slack_webhook_url?: string
    discord_webhook_url?: string
    line_channel_access_token?: string
    line_channel_secret?: string
    line_send_mode?: LineSendMode
    line_selected_room_ids?: string[]
    line_selected_user_ids?: string[]
    line_known_rooms?: LineKnownRoom[]
    line_known_users?: LineKnownUser[]
  }
}

export type Settings = {
  signup_enable: boolean
  signup_require_activation: boolean
  info_polling_interval: number
  baseUrl: string
  email_default_sender_name: string
  email_default_sender: string
  email_notifications: boolean
  default_transport: string | null
  email_transports: Transport[]
  notify_when: Record<string, { title: string; description: string; active: boolean }>
  integrations: SettingsIntegration[]
  user_permissions: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }>
  oauth_providers: Record<
    OAuthProviderId,
    { enabled: boolean; clientId: string; secretConfigured: boolean; issuerBaseUrl?: string }
  >
}

export type SaveSettings = (partial?: Partial<Settings>) => Promise<boolean>
