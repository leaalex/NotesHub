<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
}>(), {
  description: '',
  icon: '',
})
</script>

<template>
  <div class="relative max-w-sm -translate-y-8 px-6 py-10 text-center sm:-translate-y-10">
    <Icon v-if="icon" :name="icon" class="mx-auto size-7 text-zinc-300" aria-hidden="true" />
    <h2 class="mt-3 text-[15px] font-medium tracking-tight text-zinc-500">
      {{ title }}
    </h2>
    <p v-if="description" class="mt-2 text-[13px] leading-relaxed text-zinc-400">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="mt-6 flex justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>
