import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, Teleport } from 'vue'
import {
  modalToastTarget,
  registerToastModal,
  unregisterToastModal,
} from '../modalToastTarget'

const dialogs: HTMLDialogElement[] = []
let cleanup: (() => void) | undefined

function openDialog() {
  const dialog = document.createElement('dialog')
  document.body.append(dialog)
  dialogs.push(dialog)
  registerToastModal(dialog)
  return dialog
}

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  for (const dialog of dialogs.splice(0)) {
    unregisterToastModal(dialog)
    dialog.remove()
  }
})

describe('modal toast target', () => {
  it('keeps the same notification inside the top modal, then restores it on close', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const app = createApp({
      render: () =>
        h(Teleport, { to: modalToastTarget.value }, [
          h('div', { role: 'alert' }, 'Save failed'),
        ]),
    })
    app.mount(root)
    cleanup = () => {
      app.unmount()
      root.remove()
    }
    const notification = document.querySelector('[role="alert"]')!
    expect(notification.parentElement).toBe(document.body)

    const editor = openDialog()
    await nextTick()
    expect(notification.parentElement).toBe(editor)

    const nested = openDialog()
    await nextTick()
    expect(notification.parentElement).toBe(nested)

    unregisterToastModal(nested)
    // Unmount can remove the target before Vue flushes the Teleport update.
    nested.remove()
    await nextTick()
    expect(notification.parentElement).toBe(editor)

    unregisterToastModal(editor)
    await nextTick()
    expect(notification.parentElement).toBe(document.body)
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
  })

  it('does not move notifications when an already open lower modal opens again', () => {
    const editor = openDialog()
    const nested = openDialog()
    registerToastModal(editor)
    expect(modalToastTarget.value).toBe(nested)
    unregisterToastModal(nested)
    expect(modalToastTarget.value).toBe(editor)
    unregisterToastModal(editor)
    expect(modalToastTarget.value).toBe('body')
  })

  it('keeps the active target when a lower modal unmounts', () => {
    const editor = openDialog()
    const nested = openDialog()
    unregisterToastModal(editor)
    unregisterToastModal(editor)
    expect(modalToastTarget.value).toBe(nested)
    unregisterToastModal(nested)
    expect(modalToastTarget.value).toBe('body')
  })
})
