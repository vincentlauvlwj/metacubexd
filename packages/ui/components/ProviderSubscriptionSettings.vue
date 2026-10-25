<script setup lang="ts">
import type { useProxyProviderSubscriptions } from '~/composables/useProxyProviderSubscriptions'
import { IconSettings } from '@tabler/icons-vue'
import Button from '~/components/Button.vue'
import Modal from '~/components/Modal.vue'

const props = defineProps<{
  subscriptions: ReturnType<typeof useProxyProviderSubscriptions>
}>()
const { t } = useI18n()
const subscriptionModal = ref<InstanceType<typeof Modal>>()
const subscriptionProviderName = ref('')
const subscriptionUrl = ref('')

function open(providerName: string) {
  subscriptionProviderName.value = providerName
  subscriptionUrl.value = props.subscriptions.getUrl(providerName)
  subscriptionModal.value?.open()
}

function saveSubscriptionUrl() {
  props.subscriptions.saveUrl(
    subscriptionProviderName.value,
    subscriptionUrl.value,
  )
  subscriptionModal.value?.close()
}

defineExpose({ open })
</script>

<template>
  <Modal
    ref="subscriptionModal"
    :title="
      t('configureProviderSubscriptionUrl', {
        name: subscriptionProviderName,
      })
    "
  >
    <template #icon>
      <IconSettings :size="24" />
    </template>

    <form id="provider-subscription-form" @submit.prevent="saveSubscriptionUrl">
      <input
        v-model="subscriptionUrl"
        type="text"
        inputmode="url"
        class="input w-full border-base-content/20 bg-base-100 text-base-content focus:border-primary focus:outline-primary"
        :aria-label="t('profilesUrl')"
        :placeholder="t('profilesUrl')"
        autocomplete="off"
        spellcheck="false"
      />
    </form>

    <template #actions>
      <Button class="btn-ghost" @click="subscriptionModal?.close()">
        {{ t('cancel') }}
      </Button>
      <Button
        type="submit"
        form="provider-subscription-form"
        class="btn-primary"
      >
        {{ t('confirm') }}
      </Button>
    </template>
  </Modal>
</template>
