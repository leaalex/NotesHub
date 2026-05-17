<script setup lang="ts">
const router = useRouter()
const listVersion = useState<number>('addresses:listVersion', () => 0)

function onSaved(id: string) {
  listVersion.value++
  void router.replace(`/addresses/${id}`)
}
</script>

<template>
  <main class="flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-6">
    <AddressCreatePanel @cancel="router.push('/addresses')" @saved="onSaved" />
  </main>
</template>
