<script setup lang="ts">
import ProxyConfigEditor from '~/components/ProxyConfigEditor.vue'
import { useProviderSubscriptionEditor } from '~/composables/useProviderSubscriptionEditor'

const { t } = useI18n()
const providerName = ref('')
const subscriptionUrl = ref('')
const editor = useProviderSubscriptionEditor(
  () => subscriptionUrl.value,
  () => providerName.value,
)
const configEditor = ref<InstanceType<typeof ProxyConfigEditor>>()

async function open(provider: { name: string; url: string }) {
  if (!provider.url.trim()) return
  providerName.value = provider.name
  subscriptionUrl.value = provider.url
  await configEditor.value?.open()
}

defineExpose({ open })
</script>

<template>
  <ProxyConfigEditor
    ref="configEditor"
    :editor="editor"
    :title="t('providerSubscriptionEditorTitle', { name: providerName })"
    :hint="t('providerSubscriptionEditorHint', { name: providerName })"
    :nodes-title="t('providerSubscriptionNodes')"
    :saved-message="t('providerSubscriptionExported')"
    nodes-only
    allow-rename
    retry-on-error
  />
</template>
