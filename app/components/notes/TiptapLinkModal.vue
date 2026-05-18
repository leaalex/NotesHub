<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const { open, urlDraft, confirm, cancel } = useTiptapLinkModal()

const urlInput = ref<HTMLInputElement | null>(null)

watch(open, async (isOpen) => {
  if (!isOpen)
    return
  await nextTick()
  urlInput.value?.focus()
  urlInput.value?.select()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tiptap-link-dialog-title"
      @click.self="cancel"
      @keydown.escape.prevent="cancel"
    >
      <UCard
        class="w-full max-w-md overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/95 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl"
        @keydown.escape.prevent="cancel"
      >
        <template #header>
          <span id="tiptap-link-dialog-title" class="font-semibold tracking-tight text-zinc-900">
            Link
          </span>
        </template>

        <div class="space-y-2">
          <label class="block text-xs font-medium text-zinc-500" for="tiptap-link-url">
            URL
          </label>
          <input
            id="tiptap-link-url"
            ref="urlInput"
            v-model="urlDraft"
            type="url"
            name="tiptap-link-url"
            autocomplete="url"
            placeholder="https://…"
            class="block w-full rounded-[var(--ui-control-radius)] border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-950/10 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2"
            @keydown.enter.prevent="confirm"
            @keydown.escape.stop.prevent="cancel"
          >
          <p class="text-xs leading-relaxed text-zinc-500">
            Leave blank and save to remove the link.
          </p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              class="rounded-[var(--ui-control-radius)]"
              @click="cancel"
            >
              Cancel
            </UButton>
            <UButton
              class="rounded-[var(--ui-control-radius)]"
              icon="i-lucide-check"
              @click="confirm"
            >
              Save
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </Teleport>
</template>
