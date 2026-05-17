<script setup lang="ts">
const router = useRouter()
const listVersion = useState<number>('addresses:listVersion', () => 0)

function onSaved(id: string) {
  listVersion.value++
  void router.replace(`/addresses/${id}`)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col p-6 sm:p-8">
    <AddressCreatePanel @cancel="router.push('/addresses')" @saved="onSaved" />
  </div>
</template>
