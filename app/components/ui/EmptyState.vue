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
  <UiGlassPanel class="px-10 py-12 text-center">
    <Icon v-if="icon" :name="icon" class="mx-auto size-8 text-zinc-400" aria-hidden="true" />
    <h2 class="mt-4 text-lg font-semibold tracking-tight text-zinc-900">
      {{ title }}
    </h2>
    <p v-if="description" class="mt-2 text-sm leading-relaxed text-zinc-500">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="mt-8 flex justify-center">
      <slot name="actions" />
    </div>
  </UiGlassPanel>
</template>
