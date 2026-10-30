import { computed, shallowRef } from 'vue'

const openModals = shallowRef<HTMLDialogElement[]>([])

// A native modal sits in the browser's top layer. Toasts must be descendants
// of the topmost dialog to remain visible and interactive, regardless of z-index.
export const modalToastTarget = computed(
  () => openModals.value.at(-1) ?? 'body',
)

export function registerToastModal(dialog: HTMLDialogElement) {
  if (!openModals.value.includes(dialog)) {
    openModals.value = [...openModals.value, dialog]
  }
}

export function unregisterToastModal(dialog: HTMLDialogElement) {
  openModals.value = openModals.value.filter((entry) => entry !== dialog)
}
