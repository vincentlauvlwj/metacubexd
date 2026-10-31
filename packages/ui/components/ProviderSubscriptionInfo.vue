<script setup lang="ts">
import type { SubscriptionInfo } from '~/types'
import byteSize from 'byte-size'

interface Props {
  subscriptionInfo?: SubscriptionInfo
  compact?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()

const total = computed(() => {
  if (!props.subscriptionInfo) return '0 B'
  return byteSize(props.subscriptionInfo.Total || 0, {
    units: 'iec',
  }).toString()
})

const used = computed(() => {
  if (!props.subscriptionInfo) return '0 B'
  const { Download = 0, Upload = 0 } = props.subscriptionInfo
  return byteSize(Download + Upload, { units: 'iec' }).toString()
})

const percentage = computed(() => {
  if (!props.subscriptionInfo?.Total) return 0
  const { Download = 0, Upload = 0, Total = 1 } = props.subscriptionInfo
  return Math.min(Number((((Download + Upload) / Total) * 100).toFixed(1)), 999)
})
</script>

<template>
  <div v-if="subscriptionInfo" class="w-full">
    <div
      class="flex items-baseline justify-between gap-2 text-xs leading-4 text-base-content/60 tabular-nums"
    >
      <span class="min-w-0 truncate" :title="`${used} / ${total}`"
        >{{ used }} / {{ total }}</span
      >
      <span v-if="!compact" class="shrink-0 text-base-content/45"
        >{{ percentage }}%</span
      >
    </div>
    <div
      v-if="!compact"
      class="mt-1 h-1 overflow-hidden rounded-full bg-base-content/15"
    >
      <div
        class="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        :style="{ width: `${percentage}%` }"
      />
    </div>
  </div>
  <div
    v-else-if="compact"
    class="w-full truncate text-xs leading-4 text-base-content/45"
    :title="t('noTrafficInfo')"
  >
    {{ t('noTrafficInfo') }}
  </div>
</template>
