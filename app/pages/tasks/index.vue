<template>
  <div class="flex min-h-[min(70vh,28rem)] flex-1 flex-col items-center justify-center px-8 py-16 text-center">
    <UiEmptyState
      title="Select a task"
      description="Pick a task from the list or press New to create one."
      icon="i-lucide-list-checks"
    >
      <template #actions>
        <UButton
          to="/tasks/new"
          color="neutral"
          icon="i-lucide-plus"
          class="rounded-[var(--ui-control-radius)] shadow-md ring-1 ring-zinc-900/10"
        >
          New task
        </UButton>
      </template>
    </UiEmptyState>
  </div>
</template>
