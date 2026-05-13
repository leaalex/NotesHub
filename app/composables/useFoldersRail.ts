/**
 * Колонка папок (Notes / Contacts). Состояние держим в шапке и страницах с сайдбором через useState.
 */
export function useFoldersRail() {
  const open = useState('foldersRailOpen', () => true)

  function toggle() {
    open.value = !open.value
  }

  return { open, toggle }
}
