export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      success: 'emerald',
    },
    button: {
      slots: {
        base: 'rounded-[var(--ui-control-radius)]',
      },
    },
    input: {
      slots: {
        base: 'rounded-[var(--ui-control-radius)]',
      },
    },
    textarea: {
      slots: {
        base: 'rounded-[var(--ui-control-radius)]',
      },
    },
    card: {
      slots: {
        root: 'rounded-[var(--ui-panel-radius)]',
      },
    },
    alert: {
      slots: {
        root: 'rounded-[var(--ui-control-radius)]',
      },
    },
  },
  /** SVG mode: Tailwind alone does not emit `span.i-lucide-*` utilities unless an icon CSS plugin is added. */
  icon: {
    mode: 'svg',
  },
})
