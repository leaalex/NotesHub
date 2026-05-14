<template>
  <div class="flex min-h-[min(70vh,28rem)] flex-1 flex-col items-center justify-center px-8 py-16 text-center">
    <UiEmptyState
      title="Select a contact"
      description="Pick a contact from the list or press New to create one."
      icon="i-lucide-contact"
    >
      <template #actions>
        <UButton
          to="/contacts/new"
          color="neutral"
          icon="i-lucide-plus"
          class="rounded-[var(--ui-control-radius)] shadow-md ring-1 ring-zinc-900/10"
        >
          New contact
        </UButton>
      </template>
    </UiEmptyState>
  </div>
</template>
