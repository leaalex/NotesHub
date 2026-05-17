<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

useSeoMeta({
  title: `${props.error.statusCode ?? 'Error'} · Archivarius`,
})

function goHome() {
  clearError({ redirect: '/' })
}

const headline = computed(() => {
  const code = props.error.statusCode
  if (code === 404)
    return 'Page not found'
  if (code === 403)
    return 'Forbidden'
  return 'Something went wrong'
})

const detail = computed(() => {
  return props.error.statusMessage || props.error.message || 'An unexpected error occurred.'
})
</script>

<template>
  <div class="relative grid min-h-dvh place-content-center overflow-hidden px-6 py-14 antialiased tracking-wide">
    <div class="pointer-events-none absolute inset-0 bg-slate-100 dark:bg-[#020420]" />

    <div class="relative z-10 mx-auto max-w-[520px] text-center text-[#020420] dark:text-white">
      <p class="text-6xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {{ error.statusCode }}
      </p>
      <h1 class="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {{ headline }}
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {{ detail }}
      </p>

      <div class="mt-8 flex w-full items-center justify-center">
        <a
          href="/"
          class="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700 focus-visible:rounded-[var(--ui-control-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-zinc-50 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-[#020420]"
          @click.prevent="goHome"
        >
          Go back home
        </a>
      </div>
    </div>
  </div>
</template>
