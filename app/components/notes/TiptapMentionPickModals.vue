<script setup lang="ts">
const {
  contactOpen,
  fileOpen,
  contactQuery,
  fileQuery,
  contacts,
  files,
  uploadInputRef,
  pickContact,
  pickFile,
  cancelContactPicker,
  cancelFilePicker,
  onUploadInputChange,
} = useTiptapMentionPickers()
</script>

<template>
  <div>
    <input
      ref="uploadInputRef"
      type="file"
      class="hidden"
      @change="onUploadInputChange"
    >

    <Teleport to="body">
      <div
        v-if="contactOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiptap-insert-contact-title"
        @click.self="cancelContactPicker"
      >
        <UCard
          class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/95 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl"
          @keydown.escape.prevent="cancelContactPicker"
        >
          <template #header>
            <span id="tiptap-insert-contact-title" class="font-semibold tracking-tight text-zinc-900">
              Insert contact
            </span>
          </template>

          <UInput
            v-model="contactQuery"
            placeholder="Search contacts…"
            icon="i-lucide-search"
            class="rounded-[var(--ui-control-radius)]"
          />
          <ul class="mt-3 space-y-1 overflow-y-auto" style="max-height: min(320px, 50vh)">
            <li v-if="contacts.length === 0" class="px-3 py-6 text-center text-[13px] text-zinc-400">
              No contacts match.
            </li>
            <li v-for="c in contacts" :key="c.id">
              <button
                type="button"
                class="flex w-full items-center rounded-[var(--ui-control-radius)] px-3 py-2.5 text-left text-[13px] hover:bg-zinc-50"
                @click="pickContact(c)"
              >
                <span class="line-clamp-1 font-medium">{{ c.displayName }}</span>
                <span class="ml-auto rounded-[var(--ui-control-radius)] bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">{{ c.type }}</span>
              </button>
            </li>
          </ul>

          <template #footer>
            <div class="flex justify-end">
              <UButton
                variant="ghost"
                color="neutral"
                class="rounded-[var(--ui-control-radius)]"
                @click="cancelContactPicker"
              >
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="fileOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiptap-insert-file-title"
        @click.self="cancelFilePicker"
      >
        <UCard
          class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-[var(--ui-panel-radius)] border border-white/60 bg-white/95 ring-1 ring-zinc-950/[0.06] backdrop-blur-xl"
          @keydown.escape.prevent="cancelFilePicker"
        >
          <template #header>
            <span id="tiptap-insert-file-title" class="font-semibold tracking-tight text-zinc-900">
              Insert file
            </span>
          </template>

          <UInput
            v-model="fileQuery"
            placeholder="Search files…"
            icon="i-lucide-search"
            class="rounded-[var(--ui-control-radius)]"
          />
          <ul class="mt-3 space-y-1 overflow-y-auto" style="max-height: min(320px, 50vh)">
            <li v-if="files.length === 0" class="px-3 py-6 text-center text-[13px] text-zinc-400">
              No files match.
            </li>
            <li v-for="f in files" :key="f.id">
              <button
                type="button"
                class="flex w-full items-center rounded-[var(--ui-control-radius)] px-3 py-2.5 text-left text-[13px] hover:bg-emerald-50/80"
                @click="pickFile(f)"
              >
                <span class="line-clamp-1 font-medium text-emerald-950">{{ (f.title ?? '').trim() || f.originalName }}</span>
              </button>
            </li>
          </ul>

          <template #footer>
            <div class="flex justify-end">
              <UButton
                variant="ghost"
                color="neutral"
                class="rounded-[var(--ui-control-radius)]"
                @click="cancelFilePicker"
              >
                Cancel
              </UButton>
            </div>
          </template>
        </UCard>
      </div>
    </Teleport>
  </div>
</template>
