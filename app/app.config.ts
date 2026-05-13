export default defineAppConfig({
  ui: {
    colors: {
      primary: 'neutral',
      success: 'emerald',
    },
  },
  /** SVG mode: Tailwind alone does not emit `span.i-lucide-*` utilities unless an icon CSS plugin is added. */
  icon: {
    mode: 'svg',
  },
})
