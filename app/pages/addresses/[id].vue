<script setup lang="ts">
import AddressDetailPanel from '~/components/addresses/AddressDetailPanel.vue'

const route = useRoute()
const router = useRouter()

const addressId = computed(() => String(route.params.id ?? ''))
</script>

<template>
  <AddressDetailPanel
    :address-id="addressId"
    @deleted="router.replace('/addresses')"
    @not-found="router.replace('/addresses')"
  />
</template>
