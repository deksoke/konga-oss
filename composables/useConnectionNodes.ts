export type ConnectionNodeOption = {
  id: string
  name: string
  kongAdminUrl: string
}

export function useConnectionNodes() {
  const nodes = useState<ConnectionNodeOption[]>('connection-nodes', () => [])

  async function refreshConnectionNodes() {
    const res = await $fetch<{ data: ConnectionNodeOption[] }>('/api/nodes')
    nodes.value = res.data || []
  }

  return {
    nodes,
    refreshConnectionNodes
  }
}
