import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import { lineApiFetch } from './lineApi'
import {
  mergeSettings,
  type AppSettingsData,
  type MailgunTransportSettings,
  type SmtpTransportSettings
} from './settings'
import { isSafeExternalWebhookUrl, isSafeHostname } from './urlSafety'
import {
  LINE_BROADCAST_URL,
  LINE_MULTICAST_URL,
  LINE_PUSH_URL,
  buildBroadcastBody,
  buildMulticastBody,
  buildPushBody,
  chunkIds,
  isValidLineChannelAccessToken,
  lineFieldValue,
  parseLineSendMode,
  resolveLineSendPlan
} from '../../utils/lineMessaging'

export async function loadAppSettings(): Promise<AppSettingsData> {
  const row = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  return mergeSettings(row?.data)
}

export async function saveAppSettings(data: AppSettingsData): Promise<AppSettingsData> {
  const merged = mergeSettings(data)
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', data: merged },
    update: { data: merged }
  })
  return merged
}

export async function patchLineIntegrationConfig(
  patch: (
    config: AppSettingsData['integrations'][number]['config']
  ) => AppSettingsData['integrations'][number]['config']
) {
  const settings = await loadAppSettings()
  const integrations = settings.integrations.map((item) => {
    if (item.id !== 'line') return item
    return { ...item, config: patch(item.config) }
  })
  return saveAppSettings({ ...settings, integrations })
}

function integrationWebhookUrl(settings: AppSettingsData, integrationId: string, fieldId: string) {
  const item = settings.integrations?.find((i) => i.id === integrationId)
  if (!item?.config?.enabled) return null
  const fromField = item.config.fields?.find((f) => f.id === fieldId)?.value
  const url = String(item.config[fieldId] || fromField || '').trim()
  return url || null
}

/**
 * Legacy Konga: Utils.sendSlackNotification — posts plain text to Slack Incoming Webhook
 * when the Slack integration is enabled and a webhook URL is configured.
 */
export async function sendSlackNotification(settings: AppSettingsData, message: string) {
  const url = integrationWebhookUrl(settings, 'slack', 'slack_webhook_url')
  if (!url) {
    console.info('[notify/slack] skipped (disabled or missing webhook URL)')
    return { ok: false as const, reason: 'disabled_or_missing' }
  }
  if (!isSafeExternalWebhookUrl(url, ['hooks.slack.com'])) {
    console.warn('[notify/slack] webhook URL rejected')
    return { ok: false as const, reason: 'invalid_url' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'error',
    body: JSON.stringify({ text: message })
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[notify/slack]', res.status, errText)
    return { ok: false as const, reason: 'http_error', status: res.status }
  }
  return { ok: true as const }
}

/** Posts plain text to a Discord Incoming Webhook when enabled + configured. */
export async function sendDiscordNotification(settings: AppSettingsData, message: string) {
  const url = integrationWebhookUrl(settings, 'discord', 'discord_webhook_url')
  if (!url) {
    console.info('[notify/discord] skipped (disabled or missing webhook URL)')
    return { ok: false as const, reason: 'disabled_or_missing' }
  }
  if (!isSafeExternalWebhookUrl(url, ['discord.com', 'discordapp.com'])) {
    console.warn('[notify/discord] webhook URL rejected')
    return { ok: false as const, reason: 'invalid_url' }
  }

  // Discord webhook `content` max length is 2000 characters.
  const content = message.length > 2000 ? `${message.slice(0, 1997)}...` : message
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'error',
    body: JSON.stringify({ content })
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[notify/discord]', res.status, errText)
    return { ok: false as const, reason: 'http_error', status: res.status }
  }
  return { ok: true as const }
}

export type LineNotifyResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'disabled'
        | 'missing_token'
        | 'invalid_token'
        | 'empty_rooms'
        | 'empty_users'
        | 'invalid_mode'
        | 'http_error'
      status?: number
    }

function lineIntegrationConfig(settings: AppSettingsData) {
  const item = settings.integrations?.find((i) => i.id === 'line')
  return item?.config
}

/** Posts text via LINE Messaging API using the saved Settings integration. Secret is not required to send. */
export async function sendLineNotification(settings: AppSettingsData, message: string): Promise<LineNotifyResult> {
  const config = lineIntegrationConfig(settings)
  if (!config?.enabled) {
    console.info('[notify/line] skipped (disabled)')
    return { ok: false, reason: 'disabled' }
  }

  const token = lineFieldValue(config, 'line_channel_access_token')
  if (!token) {
    console.info('[notify/line] skipped (missing token)')
    return { ok: false, reason: 'missing_token' }
  }
  if (!isValidLineChannelAccessToken(token)) {
    console.warn('[notify/line] token rejected')
    return { ok: false, reason: 'invalid_token' }
  }

  const plan = resolveLineSendPlan(
    parseLineSendMode(config.line_send_mode),
    Array.isArray(config.line_selected_room_ids) ? config.line_selected_room_ids.map(String) : [],
    Array.isArray(config.line_selected_user_ids) ? config.line_selected_user_ids.map(String) : []
  )

  if (plan.kind === 'skip') {
    console.info('[notify/line] skipped', plan.reason)
    return { ok: false, reason: plan.reason }
  }

  const headers = { 'Content-Type': 'application/json' }

  async function post(url: string, body: unknown): Promise<LineNotifyResult> {
    const res = await lineApiFetch(url, token, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      await res.text().catch(() => '')
      console.error('[notify/line]', res.status)
      return { ok: false, reason: 'http_error', status: res.status }
    }
    return { ok: true }
  }

  if (plan.kind === 'broadcast') {
    return post(LINE_BROADCAST_URL, buildBroadcastBody(message))
  }

  if (plan.kind === 'push') {
    for (const id of plan.ids) {
      const result = await post(LINE_PUSH_URL, buildPushBody(id, message))
      if (!result.ok) return result
    }
    return { ok: true }
  }

  for (const ids of chunkIds(plan.ids)) {
    const result = await post(LINE_MULTICAST_URL, buildMulticastBody(ids, message))
    if (!result.ok) return result
  }
  return { ok: true }
}

async function adminEmails() {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', active: true },
    select: { email: true }
  })
  return admins.map((a) => a.email).filter(Boolean)
}

function mailFrom(settings: AppSettingsData) {
  const name = settings.email_default_sender_name || 'KONGA'
  const email = settings.email_default_sender || 'konga@konga.test'
  return `"${name}" <${email}>`
}

async function sendMailgun(settings: AppSettingsData, subject: string, text: string, to: string[]) {
  const transport = settings.email_transports.find((t) => t.name === 'mailgun')
  const cfg = transport?.settings as MailgunTransportSettings | undefined
  const apiKey = cfg?.auth?.api_key
  const domain = cfg?.auth?.domain
  if (!apiKey || !domain) {
    console.warn('[notify/mailgun] missing api_key or domain')
    return
  }
  if (!isSafeHostname(domain)) {
    console.warn('[notify/mailgun] invalid domain')
    return
  }

  const body = new URLSearchParams()
  body.set('from', mailFrom(settings))
  body.set('to', to.join(','))
  body.set('subject', subject)
  body.set('text', text)

  const auth = Buffer.from(`api:${apiKey}`).toString('base64')
  const res = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    redirect: 'error',
    body
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[notify/mailgun]', res.status, errText)
    return
  }
  console.info('[notify/mailgun] sent', { to: to.length, subject })
}

export type SmtpSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; reason: 'missing_config' | 'send_failed'; message: string }

/** Send via SMTP using an explicit config (used by alerts + Settings test). */
export async function sendSmtpMail(opts: {
  settings: AppSettingsData
  smtp: SmtpTransportSettings
  to: string[]
  subject: string
  text: string
}): Promise<SmtpSendResult> {
  const host = opts.smtp.host?.trim()
  const port = Number(opts.smtp.port)
  if (!host || !Number.isFinite(port) || port <= 0) {
    return { ok: false, reason: 'missing_config', message: 'SMTP host and port are required' }
  }
  if (!opts.to.length) {
    return { ok: false, reason: 'missing_config', message: 'No recipient email address' }
  }

  const authUser = opts.smtp.auth?.user?.trim()
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: Boolean(opts.smtp.secure),
    auth: authUser ? { user: authUser, pass: opts.smtp.auth?.pass || '' } : undefined
  })

  try {
    const info = await transporter.sendMail({
      from: mailFrom(opts.settings),
      to: opts.to.join(','),
      subject: opts.subject,
      text: opts.text
    })
    console.info('[notify/smtp] sent', { messageId: info.messageId, to: opts.to.length, subject: opts.subject })
    return { ok: true, messageId: info.messageId }
  } catch (err: any) {
    const message = err?.response || err?.message || 'SMTP send failed'
    console.error('[notify/smtp]', message)
    return { ok: false, reason: 'send_failed', message: String(message) }
  } finally {
    transporter.close()
  }
}

async function sendSmtp(settings: AppSettingsData, subject: string, text: string, to: string[]) {
  const transport = settings.email_transports.find((t) => t.name === 'smtp')
  const cfg = transport?.settings as SmtpTransportSettings | undefined
  if (!cfg) {
    console.warn('[notify/smtp] missing SMTP transport settings')
    return
  }
  const result = await sendSmtpMail({ settings, smtp: cfg, to, subject, text })
  if (!result.ok) {
    console.warn('[notify/smtp]', result.message)
  }
}

async function sendViaSendmail(settings: AppSettingsData, subject: string, text: string, to: string[]) {
  const transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail'
  })
  try {
    const info = await transporter.sendMail({
      from: mailFrom(settings),
      to: to.join(','),
      subject,
      text
    })
    console.info('[notify/sendmail] sent', { messageId: info.messageId, to: to.length, subject })
  } finally {
    transporter.close()
  }
}

/** Send email to active admins using the configured default transport (legacy Konga). */
async function sendEmailNotification(settings: AppSettingsData, subject: string, message: string) {
  if (!settings.default_transport) {
    console.info('[notify/email] skipped (no default transport selected)')
    return
  }

  const to = await adminEmails()
  if (!to.length) {
    console.warn('[notify/email] skipped (no active admin emails)')
    return
  }

  if (settings.default_transport === 'mailgun') {
    await sendMailgun(settings, subject, message, to)
  } else if (settings.default_transport === 'smtp') {
    await sendSmtp(settings, subject, message, to)
  } else if (settings.default_transport === 'sendmail') {
    await sendViaSendmail(settings, subject, message, to)
  } else {
    console.warn('[notify/email] unknown transport', settings.default_transport)
  }
}

/** Admin notify events (node_down / api_down) — gated by Settings → Notify when. */
export async function notifyAdmins(eventKey: string, message: string) {
  const settings = await loadAppSettings()
  const event = settings.notify_when?.[eventKey]
  if (!event?.active) return

  const stamped = `[ ${formatStamp()} ] ${message}`
  const slackText = `*[Konga]* ${event.title}\n${stamped}`
  const discordText = `**[Konga]** ${event.title}\n${stamped}`
  const lineText = `[Konga] ${event.title}\n${stamped}`

  await Promise.all([
    sendSlackNotification(settings, slackText).catch((err) => console.error('[notify/slack]', err)),
    sendDiscordNotification(settings, discordText).catch((err) => console.error('[notify/discord]', err)),
    sendLineNotification(settings, lineText).catch((err) => console.error('[notify/line]', err)),
    sendEmailNotification(settings, event.title, stamped).catch((err) => console.error('[notify/email]', err))
  ])
}

/**
 * Upstream alert path: Slack/Discord/email follow the per-upstream flags,
 * not the global notify_when toggles.
 */
export async function notifyUpstreamHealth(opts: {
  slack: boolean
  discord: boolean
  email: boolean
  line: boolean
  connectionName: string
  upstreamId: string
  unhealthyTargets: Array<{ target?: string; health?: string }>
}) {
  if (!opts.slack && !opts.discord && !opts.email && !opts.line) return

  const settings = await loadAppSettings()
  const stamped = formatStamp()
  let text = `[ ${stamped} ] Some upstream health checks have failed: `
  for (const target of opts.unhealthyTargets) {
    text +=
      '```Connection: `' +
      opts.connectionName +
      '`, Upstream id: `' +
      opts.upstreamId +
      '`, Target: `' +
      (target.target || 'N/A') +
      '`, Health: `' +
      (target.health || 'N/A') +
      '` ``` '
  }

  const tasks: Promise<unknown>[] = []
  if (opts.slack) {
    tasks.push(sendSlackNotification(settings, text).catch((err) => console.error('[notify/slack]', err)))
  }
  if (opts.discord) {
    tasks.push(sendDiscordNotification(settings, text).catch((err) => console.error('[notify/discord]', err)))
  }
  if (opts.line) {
    tasks.push(sendLineNotification(settings, text).catch((err) => console.error('[notify/line]', err)))
  }
  if (opts.email) {
    tasks.push(
      sendEmailNotification(
        settings,
        'An alert was triggered (Upstream Health)',
        text
      ).catch((err) => console.error('[notify/email]', err))
    )
  }
  await Promise.all(tasks)
}

function formatStamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} @${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
