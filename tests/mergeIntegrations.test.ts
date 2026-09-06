import { mergeSettings } from '../server/utils/settings'

describe('mergeSettings integrations', () => {
  it('adds LINE Official defaults when saved JSON only has slack and discord', () => {
    const merged = mergeSettings({
      integrations: [
        {
          id: 'slack',
          name: 'Slack',
          config: {
            enabled: true,
            fields: [{ id: 'slack_webhook_url', name: 'Slack Webhook URL', type: 'text', value: 'https://hooks.slack.com/x' }],
            slack_webhook_url: 'https://hooks.slack.com/x'
          }
        },
        {
          id: 'discord',
          name: 'Discord',
          config: {
            enabled: false,
            fields: [{ id: 'discord_webhook_url', name: 'Discord Webhook URL', type: 'text', value: '' }],
            discord_webhook_url: ''
          }
        }
      ]
    })

    const line = merged.integrations.find((i) => i.id === 'line')
    expect(line).toBeTruthy()
    expect(line?.name).toBe('LINE Official')
    expect(line?.config.enabled).toBe(false)
    expect(line?.config.line_send_mode).toBe('rooms')
    expect(line?.config.line_selected_room_ids).toEqual([])
    expect(line?.config.line_selected_user_ids).toEqual([])
    expect(line?.config.line_known_rooms).toEqual([])
    expect(line?.config.line_known_users).toEqual([])
    expect(line?.config.line_channel_access_token).toBe('')
    expect(line?.config.line_channel_secret).toBe('')

    const slack = merged.integrations.find((i) => i.id === 'slack')
    expect(slack?.config.enabled).toBe(true)
    expect(slack?.config.slack_webhook_url).toBe('https://hooks.slack.com/x')
  })

  it('round-trips saved LINE extra keys', () => {
    const merged = mergeSettings({
      integrations: [
        {
          id: 'line',
          name: 'LINE Official',
          config: {
            enabled: true,
            fields: [
              {
                id: 'line_channel_access_token',
                name: 'Channel Access Token',
                type: 'password',
                value: 'token-abc'
              },
              {
                id: 'line_channel_secret',
                name: 'Channel Secret',
                type: 'password',
                value: 'secret-xyz'
              }
            ],
            line_send_mode: 'users',
            line_selected_room_ids: ['Croom1', 'Croom1', 'Rroom2'],
            line_selected_user_ids: ['Uaaa', 'Ubbb'],
            line_known_rooms: [{ id: 'Croom1', name: 'Ops', kind: 'group' }],
            line_known_users: [{ id: 'Uaaa', name: 'Ada' }]
          }
        }
      ]
    })

    const line = merged.integrations.find((i) => i.id === 'line')
    expect(line?.config.enabled).toBe(true)
    expect(line?.config.line_channel_access_token).toBe('token-abc')
    expect(line?.config.line_channel_secret).toBe('secret-xyz')
    expect(line?.config.line_send_mode).toBe('users')
    expect(line?.config.line_selected_room_ids).toEqual(['Croom1', 'Rroom2'])
    expect(line?.config.line_selected_user_ids).toEqual(['Uaaa', 'Ubbb'])
    expect(line?.config.line_known_rooms).toEqual([{ id: 'Croom1', name: 'Ops', kind: 'group' }])
    expect(line?.config.line_known_users).toEqual([{ id: 'Uaaa', name: 'Ada' }])
  })
})
