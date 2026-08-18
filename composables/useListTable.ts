export const PAGE_SIZES = [10, 20, 30, 40, 50] as const
export type PageSize = (typeof PAGE_SIZES)[number]

type ListTableOptions<T, K extends string> = {
  key: string
  items: Ref<T[]> | ComputedRef<T[]>
  defaultSortKey: K
  defaultSortDesc?: boolean
  /** Columns that start descending when first selected */
  descKeys?: readonly K[]
  match: (item: T, query: string) => boolean
  sortValue: (item: T, key: K) => string | number
}

export function useListTable<T, K extends string>(opts: ListTableOptions<T, K>) {
  const storagePrefix = `konga:${opts.key}`
  const search = useState(`${opts.key}-list-search`, () => '')
  const sortKey = useState<K>(`${opts.key}-list-sort-key`, () => opts.defaultSortKey)
  const sortDesc = useState(`${opts.key}-list-sort-desc`, () => opts.defaultSortDesc ?? true)
  const pageSize = useState<PageSize>(`${opts.key}-list-page-size`, () => 10)
  const page = useState(`${opts.key}-list-page`, () => 1)
  const descKeys = new Set<string>(opts.descKeys ?? [])

  function persistSearch(q: string) {
    if (!import.meta.client) return
    if (q) sessionStorage.setItem(`${storagePrefix}:search`, q)
    else sessionStorage.removeItem(`${storagePrefix}:search`)
  }

  function persistSort() {
    if (!import.meta.client) return
    sessionStorage.setItem(
      `${storagePrefix}:sort`,
      JSON.stringify({ key: sortKey.value, desc: sortDesc.value })
    )
  }

  function persistPageSize(size: PageSize) {
    if (!import.meta.client) return
    sessionStorage.setItem(`${storagePrefix}:pageSize`, String(size))
  }

  function restore() {
    if (!import.meta.client) return
    if (!search.value) {
      search.value = sessionStorage.getItem(`${storagePrefix}:search`) || ''
    }
    try {
      const raw = sessionStorage.getItem(`${storagePrefix}:sort`)
      if (raw) {
        const parsed = JSON.parse(raw) as { key?: string; desc?: boolean }
        if (parsed.key) sortKey.value = parsed.key as K
        if (typeof parsed.desc === 'boolean') sortDesc.value = parsed.desc
      }
    } catch {
      /* ignore bad stored state */
    }
    const size = Number(sessionStorage.getItem(`${storagePrefix}:pageSize`))
    if (PAGE_SIZES.includes(size as PageSize)) pageSize.value = size as PageSize
  }

  function toggleSort(key: K) {
    if (sortKey.value === key) {
      sortDesc.value = !sortDesc.value
    } else {
      sortKey.value = key
      sortDesc.value = descKeys.has(key)
    }
  }

  function sortArrow(key: K) {
    if (sortKey.value !== key) return ''
    return sortDesc.value ? '↓' : '↑'
  }

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase()
    let list = [...opts.items.value]
    if (q) list = list.filter((item) => opts.match(item, q))
    const key = sortKey.value
    return list.sort((a, b) => {
      const av = opts.sortValue(a, key)
      const bv = opts.sortValue(b, key)
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
      return sortDesc.value ? -cmp : cmp
    })
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))

  const pageRange = computed(() => {
    const total = filtered.value.length
    if (!total) return { from: 0, to: 0 }
    const from = (page.value - 1) * pageSize.value + 1
    const to = Math.min(page.value * pageSize.value, total)
    return { from, to }
  })

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filtered.value.slice(start, start + pageSize.value)
  })

  watch(search, (q) => persistSearch(q))
  watch([sortKey, sortDesc], () => persistSort())
  watch(pageSize, (size) => persistPageSize(size))
  watch([search, sortKey, sortDesc, pageSize], () => {
    page.value = 1
  })
  watch(totalPages, (pages) => {
    if (page.value > pages) page.value = pages
  })

  function goToPage(next: number) {
    page.value = Math.min(Math.max(1, next), totalPages.value)
  }

  function setPageSize(size: PageSize) {
    if (PAGE_SIZES.includes(size)) pageSize.value = size
  }

  return {
    search,
    sortKey,
    sortDesc,
    pageSize,
    page,
    filtered,
    paged,
    totalPages,
    pageRange,
    PAGE_SIZES,
    toggleSort,
    sortArrow,
    goToPage,
    setPageSize,
    restore
  }
}
