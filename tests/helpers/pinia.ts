import { setActivePinia, createPinia } from 'pinia'

export function setupPinia() {
  setActivePinia(createPinia())
}
