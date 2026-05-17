<template>
  <div class="flex min-h-[min(70vh,28rem)] flex-1 flex-col items-center justify-center px-8 py-16 text-center">
    <UiEmptyState
      title="Select an address"
      description="Pick an address from the library or create a new one."
      icon="i-lucide-map-pin"
    >
      <template #actions>
        <UButton
          to="/addresses/new"
          color="neutral"
          icon="i-lucide-plus"
          class="rounded-[var(--ui-control-radius)] shadow-md ring-1 ring-zinc-900/10"
        >
          New address
        </UButton>
      </template>
    </UiEmptyState>
  </div>
</template>
