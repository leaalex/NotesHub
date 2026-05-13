<script setup lang="ts">
interface Props {
  /** Tailwind width class for the cards column */
  cardsWidthClass?: string
  /** Contacts right pane scrolls vertically (reuse prior contacts-right pane styling). */
  rightPaneScrollable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  cardsWidthClass: 'w-[17.5rem]',
  rightPaneScrollable: false,
})

const slots = useSlots()

const { open: foldersRailOpen } = useFoldersRail()
const hasFolders = computed(() => typeof slots.folders === 'function')
const hasCards = computed(() => typeof slots.cards === 'function')

const mainPaneClasses = computed(() =>
  props.rightPaneScrollable
    ? [
        'notes-scrollbar',
        'overflow-y-auto',
        'border-l',
        'border-zinc-100/90',
        'bg-white/25',
        'backdrop-blur-md',
        'supports-[backdrop-filter]:bg-white/20',
      ]
    : ['overflow-hidden'])
</script>

<template>
  <div class="relative flex h-full min-h-0 overflow-hidden">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(24,24,27,0.06),transparent)]" />

    <aside
      v-if="hasFolders && foldersRailOpen"
      class="relative z-10 flex w-[13.5rem] shrink-0 flex-col border-r border-white/60 bg-white/45 backdrop-blur-xl supports-[backdrop-filter]:bg-white/35"
    >
      <slot name="folders" />
    </aside>

    <section
      v-if="hasCards"
      :class="[
        'relative',
        'z-10',
        'flex',
        'min-h-0',
        'shrink-0',
        'flex-col',
        'border-r',
        'border-white/50',
        'bg-white/30',
        'backdrop-blur-md',
        'supports-[backdrop-filter]:bg-white/25',
        props.cardsWidthClass,
      ]"
    >
      <slot name="cards" />
    </section>

    <div class="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col" :class="mainPaneClasses">
      <slot />
    </div>
  </div>
</template>
