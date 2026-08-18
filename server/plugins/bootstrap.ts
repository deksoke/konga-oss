import { prisma } from '../utils/prisma'
import { DEFAULT_SETTINGS } from '../utils/settings'
import { takeKongSnapshot } from '../utils/snapshots'
import { kongRequest } from '../utils/kong'
import { notifyAdmins, notifyUpstreamHealth } from '../utils/notify'

/** Match classic 5-field cron: minute hour dayOfMonth month dayOfWeek */
function cronMatches(cron: string, date = new Date()): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return false
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const vals = [
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    date.getDay()
  ]
  const fields = [minute, hour, dayOfMonth, month, dayOfWeek]

  return fields.every((field, i) => {
    if (field === '*') return true
    const value = vals[i]
    return field.split(',').some((token) => {
      if (token.includes('/')) {
        const [base, stepStr] = token.split('/')
        const step = Number(stepStr)
        if (!step) return false
        if (base === '*') return value % step === 0
        return value >= Number(base) && (value - Number(base)) % step === 0
      }
      if (token.includes('-')) {
        const [a, b] = token.split('-').map(Number)
        return value >= a && value <= b
      }
      return Number(token) === value
    })
  })
}

async function runDueSchedules() {
  const due = await prisma.snapshotSchedule.findMany({
    where: { active: true },
    include: { connection: true }
  })
  const now = new Date()
  for (const schedule of due) {
    if (!cronMatches(schedule.cron, now)) continue
    if (schedule.lastRunAt) {
      const diff = now.getTime() - schedule.lastRunAt.getTime()
      if (diff < 50_000) continue
    }
    try {
      const snap = await takeKongSnapshot(
        schedule.connection,
        `scheduled@${schedule.connection.name}@${Date.now()}`
      )
      await prisma.snapshot.create({
        data: {
          name: snap.name,
          kongNodeName: snap.kongNodeName,
          kongNodeUrl: snap.kongNodeUrl,
          kongVersion: snap.kongVersion,
          data: snap.data
        }
      })
      await prisma.snapshotSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now }
      })
    } catch (err) {
      console.error('[snapshot-scheduler] failed', schedule.id, err)
    }
  }
}

async function runNodeHealthChecks() {
  const nodes = await prisma.kongNode.findMany({ where: { healthChecks: true } })
  for (const node of nodes) {
    const details = (node.healthCheckDetails || {}) as Record<string, unknown>
    const now = new Date().toISOString()
    try {
      await kongRequest(node, 'GET', 'status')
      await prisma.kongNode.update({
        where: { id: node.id },
        data: {
          healthCheckDetails: {
            ...details,
            last_checked: now,
            last_success: now,
            first_failed: null
          }
        }
      })
    } catch {
      const firstFailed = (details.first_failed as string) || now
      await prisma.kongNode.update({
        where: { id: node.id },
        data: {
          healthCheckDetails: {
            ...details,
            last_checked: now,
            last_failed: now,
            first_failed: firstFailed
          }
        }
      })
      await notifyAdmins(
        'node_down',
        `Connection "${node.name}" (${node.kongAdminUrl}) is down or unresponsive.`
      )
    }
  }
}

async function runUpstreamAlerts() {
  const alerts = await prisma.upstreamAlert.findMany({
    where: { active: true },
    include: { connection: true }
  })
  for (const alert of alerts) {
    try {
      const health = (await kongRequest(
        alert.connection,
        'GET',
        `upstreams/${alert.upstreamId}/health`
      )) as { data?: Array<{ health?: string; target?: string }> }
      const bad = (health.data || []).filter((t) =>
        ['UNHEALTHY', 'DNS_ERROR'].includes(String(t.health || '').toUpperCase())
      )
      const prev = (alert.data || {}) as { last_bad?: string[] }
      const badKeys = bad.map((t) => `${t.target}:${t.health}`)
      const prevBad = prev.last_bad || []
      const newlyBad = badKeys.filter((k) => !prevBad.includes(k))
      await prisma.upstreamAlert.update({
        where: { id: alert.id },
        data: { data: { ...(alert.data as object), last_bad: badKeys, checked_at: new Date().toISOString() } }
      })
      if (newlyBad.length) {
        const unhealthyTargets = bad.map((t) => ({
          target: t.target,
          health: t.health
        }))
        await notifyUpstreamHealth({
          slack: alert.slack !== false,
          discord: alert.discord !== false,
          email: Boolean(alert.email),
          connectionName: alert.connection.name,
          upstreamId: alert.upstreamId,
          unhealthyTargets
        })
      }
    } catch (err) {
      console.error('[upstream-alert]', alert.id, err)
    }
  }
}

export default defineNitroPlugin(async () => {
  const existing = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  if (!existing) {
    await prisma.appSettings.create({
      data: { id: 'default', data: DEFAULT_SETTINGS }
    })
  }

  try {
    await ensureInitialAdmin()
  } catch (err) {
    console.error('[konga] Failed to seed initial admin', err)
  }

  if (process.env.DISABLE_SNAPSHOT_SCHEDULER === 'true') return

  setInterval(() => {
    runDueSchedules().catch((err) => console.error('[snapshot-scheduler]', err))
  }, 60_000)

  setInterval(() => {
    runNodeHealthChecks().catch((err) => console.error('[node-health]', err))
    runUpstreamAlerts().catch((err) => console.error('[upstream-alerts]', err))
  }, 30_000)
})
