<script setup lang="ts">
import type { LineKnownRoom, LineKnownUser, LineSendMode, SaveSettings, Settings, SettingsIntegration } from '~/types/settings'
import { lineFieldValue, lineWebhookCallbackUrl, parseLineSendMode } from '~/utils/lineMessaging'

const props = defineProps<{
  settings: Settings
  item: SettingsIntegration
  save: SaveSettings
  saving: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const token = ref('')
const secret = ref('')
const sendMode = ref<LineSendMode>('rooms')
const selectedRoomIds = ref<string[]>([])
const selectedUserIds = ref<string[]>([])
const knownRooms = ref<LineKnownRoom[]>([])
const knownUsers = ref<LineKnownUser[]>([])
const fetchedUsers = ref<LineKnownUser[]>([])
const addRoomId = ref('')
const addingRoom = ref(false)
const fetchingFollowers = ref(false)
const error = ref('')

const webhookUrl = computed(() => lineWebhookCallbackUrl(props.settings.baseUrl || ''))

const visibleUsers = computed(() => {
  const map = new Map<string, LineKnownUser>()
  for (const row of knownUsers.value) map.set(row.id, row)
  for (const row of fetchedUsers.value) map.set(row.id, row)
  for (const id of selectedUserIds.value) {
    if (!map.has(id)) map.set(id, { id, name: id })
  }
  return [...map.values()]
})

function loadFromItem(item: SettingsIntegration) {
  token.value = lineFieldValue(item.config, 'line_channel_access_token')
  secret.value = lineFieldValue(item.config, 'line_channel_secret')
  sendMode.value = parseLineSendMode(item.config.line_send_mode)
  selectedRoomIds.value = [...(item.config.line_selected_room_ids || [])]
  selectedUserIds.value = [...(item.config.line_selected_user_ids || [])]
  knownRooms.value = [...(item.config.line_known_rooms || [])]
  knownUsers.value = [...(item.config.line_known_users || [])]
  fetchedUsers.value = []
  addRoomId.value = ''
  error.value = ''
}

loadFromItem(props.item)

function toggleId(list: string[], id: string, checked: boolean) {
  const set = new Set(list)
  if (checked) set.add(id)
  else set.delete(id)
  return [...set]
}

function patchParentKnownRooms(rooms: LineKnownRoom[]) {
  const next = props.settings.integrations.map((row) => {
    if (row.id !== 'line') return row
    return { ...row, config: { ...row.config, line_known_rooms: rooms } }
  })
  props.settings.integrations = next
}

async function addRoom() {
  const id = addRoomId.value.trim()
  if (!id) {
    error.value = 'Enter a LINE Group or Room ID'
    return
  }
  addingRoom.value = true
  error.value = ''
  try {
    const res = await $fetch<{ room: LineKnownRoom }>('/api/settings/integrations/line/rooms', {
      method: 'POST',
      body: { id }
    })
    const room = res.room
    const next = knownRooms.value.filter((row) => row.id !== room.id)
    next.push(room)
    knownRooms.value = next
    if (!selectedRoomIds.value.includes(room.id)) {
      selectedRoomIds.value = [...selectedRoomIds.value, room.id]
    }
    patchParentKnownRooms(next)
    addRoomId.value = ''
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not add that Group/Room ID'
  } finally {
    addingRoom.value = false
  }
}

async function fetchFollowers() {
  fetchingFollowers.value = true
  error.value = ''
  try {
    const res = await $fetch<{ users: LineKnownUser[] }>('/api/settings/integrations/line/followers')
    fetchedUsers.value = res.users || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not fetch LINE followers'
  } finally {
    fetchingFollowers.value = false
  }
}

async function submit() {
  error.value = ''
  if (!token.value.trim()) {
    error.value = 'Channel Access Token is required'
    return
  }
  if (!secret.value.trim()) {
    error.value = 'Channel Secret is required'
    return
  }

  const selectedSet = new Set(selectedUserIds.value)
  const labels = new Map<string, string>()
  for (const row of knownUsers.value) labels.set(row.id, row.name)
  for (const row of fetchedUsers.value) labels.set(row.id, row.name)
  const persistedUsers = [...selectedSet].map((id) => ({ id, name: labels.get(id) || id }))

  const nextIntegrations = props.settings.integrations.map((row) => {
    if (row.id !== 'line') return row
    return {
      ...row,
      config: {
        ...row.config,
        enabled: row.config.enabled,
        line_channel_access_token: token.value.trim(),
        line_channel_secret: secret.value.trim(),
        line_send_mode: sendMode.value,
        line_selected_room_ids: [...selectedRoomIds.value],
        line_selected_user_ids: [...selectedUserIds.value],
        line_known_rooms: [...knownRooms.value],
        line_known_users: persistedUsers,
        fields: (row.config.fields || []).map((field) => {
          if (field.id === 'line_channel_access_token') return { ...field, value: token.value.trim() }
          if (field.id === 'line_channel_secret') return { ...field, value: secret.value.trim() }
          return field
        })
      }
    }
  })
  props.settings.integrations = nextIntegrations
  const ok = await props.save({ integrations: nextIntegrations })
  if (ok) emit('close')
  else error.value = 'Failed to save LINE Official settings'
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-panel" style="width: min(560px, 100%)" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem; text-transform: uppercase">Configure LINE Official</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error" style="margin: 0">{{ error }}</p>
        <p class="help" style="margin: 0">
          Create a Messaging API channel in LINE Developers. Use the Channel Access Token and Channel Secret from that
          channel. This is not LINE Login — do not paste a Login client secret here. For room mode, invite the Official
          Account into the group, then add the Group/Room ID below (or wait for the join webhook).
        </p>

        <div>
          <label class="label">Channel Access Token <span class="error">*</span></label>
          <input v-model="token" class="input" type="password" autocomplete="new-password" />
        </div>
        <div>
          <label class="label">Channel Secret <span class="error">*</span></label>
          <input v-model="secret" class="input" type="password" autocomplete="new-password" />
        </div>

        <fieldset class="mode-set">
          <legend class="label" style="margin: 0">Send to</legend>
          <label class="row" style="gap: 0.45rem">
            <input v-model="sendMode" type="radio" value="followers" />
            <span>All followers (broadcast)</span>
          </label>
          <label class="row" style="gap: 0.45rem">
            <input v-model="sendMode" type="radio" value="rooms" />
            <span>Selected rooms</span>
          </label>
          <label class="row" style="gap: 0.45rem">
            <input v-model="sendMode" type="radio" value="users" />
            <span>Selected users</span>
          </label>
        </fieldset>

        <div v-if="sendMode === 'rooms'" class="stack">
          <p class="help" style="margin: 0">LINE has no list-groups API. Rooms appear after a join webhook, or paste an ID.</p>
          <div>
            <label class="label">Webhook callback URL</label>
            <input class="input" :value="webhookUrl" readonly />
            <p v-if="!webhookUrl" class="help">Set General → Base URL first so LINE can call this webhook.</p>
            <p v-else class="help">Register this URL on the Messaging API channel (use /webhook, not a login callback).</p>
          </div>
          <div class="row" style="gap: 0.45rem; align-items: flex-end">
            <div style="flex: 1">
              <label class="label">Group / Room ID</label>
              <input v-model="addRoomId" class="input" placeholder="Cxxxxxxxx or Rxxxxxxxx" autocomplete="off" />
            </div>
            <button class="btn" type="button" :disabled="addingRoom" @click="addRoom">
              {{ addingRoom ? 'Adding…' : 'Add ID' }}
            </button>
          </div>
          <p v-if="!knownRooms.length" class="help">No known rooms yet.</p>
          <label v-for="room in knownRooms" :key="room.id" class="row" style="gap: 0.45rem">
            <input
              type="checkbox"
              :checked="selectedRoomIds.includes(room.id)"
              @change="selectedRoomIds = toggleId(selectedRoomIds, room.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ room.name }} <span class="help" style="display: inline">({{ room.kind }} · {{ room.id }})</span></span>
          </label>
        </div>

        <div v-if="sendMode === 'users'" class="stack">
          <p class="help" style="margin: 0">Fetch followers, then select who should receive multicast messages.</p>
          <button class="btn" type="button" :disabled="fetchingFollowers" @click="fetchFollowers">
            {{ fetchingFollowers ? 'Fetching…' : 'Fetch followers' }}
          </button>
          <p v-if="!visibleUsers.length" class="help">No users selected or fetched yet.</p>
          <label v-for="user in visibleUsers" :key="user.id" class="row" style="gap: 0.45rem">
            <input
              type="checkbox"
              :checked="selectedUserIds.includes(user.id)"
              @change="selectedUserIds = toggleId(selectedUserIds, user.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ user.name }} <span class="help" style="display: inline">({{ user.id }})</span></span>
          </label>
        </div>

        <button class="btn btn-primary" type="button" style="width: 100%" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : '✓ Submit changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
  display: block;
}
.mode-set {
  border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
</style>
