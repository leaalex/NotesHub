<template>
  <div class="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-12 text-center">
    <UiEmptyState
      title="Select an address"
      description="Pick an address from the library or create a new one."
    >
      <template #actions>
        <UButton
          to="/addresses/new"
          color="neutral"
          size="md"
          icon="i-lucide-plus"
          class="rounded-[var(--ui-control-radius)] px-5 ring-1 ring-zinc-200/80"
        >
          New address
        </UButton>
      </template>
    </UiEmptyState>
  </div>
</template>
