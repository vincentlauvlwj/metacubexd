<script setup lang="ts">
import type { Proxy, ProxyProvider } from '~/types'
import { IconChevronRight } from '@tabler/icons-vue'
import ProxyMasterDetail from '~/components/ProxyMasterDetail.vue'
import ProxyNodeCard from '~/components/ProxyNodeCard.vue'
import { useForkProxyMasterDetail } from '~/composables/useForkProxyMasterDetail'
import { PROXIES_CARD_SIZE_GAP, PROXIES_CARD_SIZE_MIN_WIDTH } from '~/constants'
import { formatProxyType } from '~/utils'

const props = defineProps<{
  groups?: Proxy[]
  providers?: ProxyProvider[]
  sortedNamesByGroup: Record<string, string[]>
}>()
const emit = defineEmits<{ scroll: [event: Event] }>()
const proxiesStore = useProxiesStore()
const configStore = useConfigStore()
const { t } = useI18n()
const { groups, providerByName, selectNode } = useForkProxyMasterDetail(
  props,
  (group, name) => proxiesStore.selectProxyInGroup(group, name),
)
const nodeGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${PROXIES_CARD_SIZE_MIN_WIDTH[configStore.proxiesCardSize]}px), 1fr))`,
  gap: `${PROXIES_CARD_SIZE_GAP[configStore.proxiesCardSize]}px`,
}))
const detail = ref<InstanceType<typeof ProxyMasterDetail>>()
defineExpose({
  scrollToTop: (behavior?: ScrollBehavior) =>
    detail.value?.scrollToTop(behavior),
})
</script>

<template>
  <ProxyMasterDetail
    ref="detail"
    :groups="groups"
    :sorted-names-by-group="sortedNamesByGroup"
    node-list-class="grid content-start"
    :node-list-style="nodeGridStyle"
    @scroll="emit('scroll', $event)"
  >
    <template #navigation-info="{ group }">
      <slot name="navigation-info" :provider-name="group.name" />
      <span
        v-if="!providers"
        class="hidden min-w-0 items-center gap-1 text-xs text-base-content/45 sm:flex"
        :title="`${formatProxyType(group.type, t)}${group.now ? ` > ${group.now}` : ''}`"
      >
        <span class="shrink-0">{{ formatProxyType(group.type, t) }}</span>
        <template v-if="group.now">
          <IconChevronRight :size="12" class="shrink-0" aria-hidden="true" />
          <span class="truncate">{{ group.now }}</span>
        </template>
      </span>
    </template>
    <template v-if="providers" #title="{ group, nodes }">
      <slot
        name="provider-title"
        :provider="providerByName.get(group.name)!"
        :sorted-proxy-names="nodes"
      />
    </template>
    <template #nodes="{ group, nodes }">
      <ProxyNodeCard
        v-for="name in nodes"
        :key="name"
        :proxy-name="name"
        :group-name="providers ? undefined : group.name"
        :provider-name="providers ? group.name : undefined"
        :test-url="group.testUrl || null"
        :timeout="group.timeout ?? null"
        :is-selected="group.now === name"
        :data-selected="group.now === name ? 'true' : undefined"
        @click="selectNode(group, name)"
      />
      <div
        v-if="nodes.length === 0"
        class="col-span-full py-8 text-center text-sm text-base-content/40"
      >
        {{ t('noData') }}
      </div>
    </template>
  </ProxyMasterDetail>
</template>
