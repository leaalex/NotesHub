<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const props = withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
}>(), {
  description: '',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  loading: false,
})

const emit = defineEmits<{
  confirm: []
}>()

function closeDialog() {
  if (!props.loading)
    open.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      @click.self="closeDialog"
    >
      <UCard class="w-full max-w-md overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/95 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl">
        <template #header>
          <span class="font-semibold tracking-tight text-zinc-900">{{ title }}</span>
        </template>

        <p v-if="description" class="text-sm leading-relaxed text-zinc-600">
          {{ description }}
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              class="rounded-[var(--ui-control-radius)]"
              :disabled="loading"
              @click="closeDialog"
            >
              {{ cancelLabel }}
            </UButton>
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              class="rounded-[var(--ui-control-radius)]"
              :loading="loading"
              @click="emit('confirm')"
            >
              {{ confirmLabel }}
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>
