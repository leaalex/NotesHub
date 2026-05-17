<script setup lang="ts">
import AddressDetailPanel from '~/components/addresses/AddressDetailPanel.vue'

const route = useRoute()
const router = useRouter()

const addressId = computed(() => String(route.params.id ?? ''))
</script>

<template>
  <main class="flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-6">
    <AddressDetailPanel
      :address-id="addressId"
      @deleted="router.replace('/addresses')"
      @not-found="router.replace('/addresses')"
    />
  </main>
</template>
