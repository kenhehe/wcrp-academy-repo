import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// false during the server render and hydration, true afterwards. For UI that depends on
// the browser (its time zone, its locale) without a hydration mismatch or a setState-in-effect.
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
