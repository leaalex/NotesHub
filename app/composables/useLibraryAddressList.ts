export type LibraryAddressRow = {
  id: string
  label: string
  line1: string
  city: string
  countryCode: string
  updatedAt: string | Date | number
}

export function useLibraryAddressList() {
  const route = useRoute()
  const toast = useToast()
  const apiFetch = useRequestFetch()
  const listVersion = useState<number>('addresses:listVersion', () => 0)

  const selectedAddressId = useState<string | null>('library:address:selectedId', () => null)
  const showNewAddress = useState<boolean>('library:address:showNew', () => false)

  const addressList = useState<LibraryAddressRow[]>('library-address-list', () => [])
  const addressesLoading = useState<boolean>('library-address-loading', () => false)
  const addressSearch = useState<string>('library-address-search', () => '')

  async function loadAddresses() {
    addressesLoading.value = true
    try {
      addressList.value = await apiFetch<LibraryAddressRow[]>('/api/addresses', { query: {} })
    }
    catch (e) {
      console.error(e)
      toast.add({ title: 'Could not load addresses', color: 'error' })
    }
    finally {
      addressesLoading.value = false
    }
  }

  const filteredAddresses = computed(() => {
    const q = addressSearch.value.trim().toLowerCase()
    if (!q)
      return addressList.value
    return addressList.value.filter((a) => {
      const label = (a.label ?? '').toLowerCase()
      const line1 = (a.line1 ?? '').toLowerCase()
      const city = (a.city ?? '').toLowerCase()
      return label.includes(q) || line1.includes(q) || city.includes(q)
    })
  })

  watch(
    () => ({ on: route.path.startsWith('/library/addresses'), v: listVersion.value }),
    () => {
      if (route.path.startsWith('/library/addresses'))
        void loadAddresses()
    },
    { immediate: true },
  )

  watch(
    () => route.path,
    (p) => {
      if (!p.startsWith('/library/addresses')) {
        selectedAddressId.value = null
        showNewAddress.value = false
      }
    },
    { immediate: false },
  )

  function selectAddress(id: string) {
    selectedAddressId.value = id
    showNewAddress.value = false
  }

  function openNewAddress() {
    showNewAddress.value = true
    selectedAddressId.value = null
  }

  function clearAddressPanel() {
    selectedAddressId.value = null
    showNewAddress.value = false
  }

  function formatAddressUpdated(ua: string | Date | number) {
    const d = new Date(ua as string)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function lineSummary(a: LibraryAddressRow) {
    const parts = [a.line1, a.city].map(s => (s ?? '').trim()).filter(Boolean)
    return parts.length ? parts.join(' · ') : '—'
  }

  return {
    addressList,
    addressesLoading,
    addressSearch,
    filteredAddresses,
    loadAddresses,
    lineSummary,
    formatAddressUpdated,
    listVersion,
    selectedAddressId,
    showNewAddress,
    selectAddress,
    openNewAddress,
    clearAddressPanel,
  }
}
