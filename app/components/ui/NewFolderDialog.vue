<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const folderName = defineModel<string>('name', { required: true })

defineProps<{
  creating: boolean
}>()

const emit = defineEmits<{
  submit: []
}>()

function onSubmit() {
  emit('submit')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      @click.self="open = false"
    >
      <UCard class="w-full max-w-md overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/90 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl">
        <template #header>
          <span class="font-semibold tracking-tight text-zinc-900">New folder</span>
        </template>
        <UFormField label="Name">
          <UInput
            v-model="folderName"
            autofocus
            class="rounded-[var(--ui-control-radius)]"
            @keyup.enter="onSubmit"
          />
        </UFormField>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              class="rounded-[var(--ui-control-radius)]"
              @click="open = false"
            >
              Cancel
            </UButton>
            <UButton
              icon="i-lucide-check"
              color="neutral"
              :loading="creating"
              class="rounded-[var(--ui-control-radius)]"
              :on-click="onSubmit"
            >
              Create
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>
