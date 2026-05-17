<script setup lang="ts">
interface Props {
  /** Tailwind width class for the cards column */
  cardsWidthClass?: string
  /** Contacts right pane scrolls vertically (reuse prior contacts-right pane styling). */
  rightPaneScrollable?: boolean
  /** Show folders slot even when global folders rail is collapsed (e.g. Library sections). */
  foldersPinned?: boolean
  /** Wide table list occupies full remaining width and hides the right detail pane. */
  viewMode?: 'cards' | 'table'
}

const props = withDefaults(defineProps<Props>(), {
  cardsWidthClass: 'w-[17.5rem]',
  rightPaneScrollable: false,
  foldersPinned: false,
  viewMode: 'cards',
})

const slots = useSlots()

const { open: foldersRailOpen } = useFoldersRail()
const hasFolders = computed(() => typeof slots.folders === 'function')
const hasCards = computed(() => typeof slots.cards === 'function')

const hasSubheader = computed(() => typeof slots.subheader === 'function')

const mainPaneClasses = computed(() =>
  props.rightPaneScrollable
    ? [
        'ui-scrollbar',
        'overflow-y-auto',
        'border-l',
        'border-zinc-100/90',
        'bg-white/25',
        'backdrop-blur-md',
        'supports-[backdrop-filter]:bg-white/20',
      ]
    : ['overflow-hidden'])

const cardsColumnClasses = computed(() => [
  props.viewMode === 'table'
    ? 'min-w-0 flex-1'
    : `${props.cardsWidthClass} shrink-0`,
])

const showMainPane = computed(() => props.viewMode === 'cards')
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(24,24,27,0.06),transparent)]" />

    <div
      v-if="hasSubheader"
      class="relative z-20 flex shrink-0 items-center gap-3 border-b border-white/60 bg-white/55 px-4 py-2 backdrop-blur-xl ring-1 ring-zinc-950/[0.04] supports-[backdrop-filter]:bg-white/45"
    >
      <slot name="subheader" />
    </div>

    <div class="relative z-10 flex min-h-0 flex-1 overflow-hidden">
      <aside
        v-if="hasFolders && (foldersPinned || foldersRailOpen)"
        class="ui-scrollbar relative z-10 flex min-h-0 w-[13.5rem] shrink-0 flex-col overflow-y-auto border-r border-white/60 bg-white/45 backdrop-blur-xl supports-[backdrop-filter]:bg-white/35"
      >
        <slot name="folders" />
      </aside>

      <section
        v-if="hasCards"
        class="relative z-10 flex min-h-0 flex-col overflow-hidden border-r border-white/50 bg-white/30 backdrop-blur-md supports-[backdrop-filter]:bg-white/25"
        :class="cardsColumnClasses"
      >
        <slot name="cards" />
      </section>

      <div v-if="showMainPane" class="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col" :class="mainPaneClasses">
        <slot />
      </div>
    </div>
  </div>
</template>
