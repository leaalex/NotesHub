<script setup lang="ts">
const props = withDefaults(
  defineProps<{ class?: string, size?: 'default' | 'lg' }>(),
  { class: '', size: 'default' },
)

const isLg = computed(() => props.size === 'lg')
</script>

<template>
  <span
    class="inline-flex min-w-0 shrink-0 items-center"
    :class="[
      isLg ? 'gap-3 sm:gap-4' : 'gap-2.5 sm:gap-3',
      props.class,
    ]"
  >
    <LogoMark
      class="w-auto shrink-0"
      :class="isLg ? 'h-8 sm:h-9' : 'h-6 sm:h-7'"
    />
    <span
      class="w-[1px] shrink-0 bg-zinc-300/95"
      :class="isLg ? 'h-8 sm:h-9' : 'h-6 sm:h-7'"
      aria-hidden="true"
      role="presentation"
    />
    <span
      class="inline-block origin-left -rotate-[5deg] font-normal leading-none tracking-tight"
      :class="isLg
        ? 'mt-1 text-[clamp(24px,2rem,30px)] sm:mt-1.5 sm:text-[clamp(26px,2.25rem,34px)]'
        : 'text-[clamp(19px,1.5rem,22px)] sm:text-[clamp(20px,1.625rem,24px)]'"
      style="font-family: 'Water Brush', cursive;"
    >
      Archivarius
    </span>
  </span>
</template>
