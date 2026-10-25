<script lang="ts">
import type { PropType } from 'vue'
import type { useProxyProviderSubscriptions } from '~/composables/useProxyProviderSubscriptions'
import type { ProxyNodeWithProvider, ProxyProvider } from '~/types'
import { IconBrandSpeedtest, IconReload, IconSettings } from '@tabler/icons-vue'
import dayjs from 'dayjs'
import { computed, defineComponent, h } from 'vue'
import Button from '~/components/Button.vue'
import ProviderSubscriptionInfo from '~/components/ProviderSubscriptionInfo.vue'
import ProxyNodePreview from '~/components/ProxyNodePreview.vue'
import { useProxiesStore } from '~/stores/proxies'
import { formatTimeFromNow } from '~/utils'

export default defineComponent({
  props: {
    subscriptions: {
      type: Object as PropType<
        ReturnType<typeof useProxyProviderSubscriptions>
      >,
      required: true,
    },
    provider: {
      type: Object as () => ProxyProvider & {
        proxies: ProxyNodeWithProvider[]
      },
      required: true,
    },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  emits: ['configure', 'edit'],
  setup(props, { emit }) {
    const { t, locale } = useI18n()
    const proxiesStore = useProxiesStore()
    const subscriptionInfo = computed(() =>
      props.subscriptions.infoByProvider.get(props.provider.name),
    )
    const subscriptionExpiry = computed(() => {
      const expire = subscriptionInfo.value?.Expire
      return expire ? dayjs(expire * 1000).format('YYYY-MM-DD') : t('noExpire')
    })

    return () =>
      h('div', { class: 'flex flex-col gap-3 flex-1 min-w-0' }, [
        h(
          'div',
          {
            class: 'flex items-center justify-between gap-2 w-full flex-nowrap',
          },
          [
            h(
              'div',
              {
                class:
                  'flex flex-wrap items-center gap-x-6 gap-y-2 flex-1 min-w-0',
              },
              [
                h(
                  'div',
                  {
                    class:
                      'flex max-w-full min-w-0 flex-wrap items-center gap-2',
                  },
                  [
                    h(
                      'span',
                      {
                        class:
                          'text-lg font-semibold tracking-tight line-clamp-1 break-all text-base-content',
                      },
                      props.provider.name,
                    ),
                    h(
                      'div',
                      {
                        class:
                          'badge badge-sm text-[0.7rem] font-semibold px-2 py-1 rounded-md bg-primary/12 text-primary border border-primary/20',
                      },
                      props.provider.proxies.length,
                    ),
                    h(
                      'div',
                      {
                        class:
                          'badge badge-sm text-[0.7rem] font-semibold px-2 py-1 rounded-md bg-primary/12 text-primary border border-primary/20',
                      },
                      props.provider.vehicleType,
                    ),
                  ],
                ),
                subscriptionInfo.value &&
                  h('div', { class: 'w-[200px] max-w-full shrink-0' }, [
                    h(ProviderSubscriptionInfo, {
                      subscriptionInfo: subscriptionInfo.value,
                    }),
                  ]),
              ],
            ),
            h('div', { class: 'flex items-center gap-1.5 shrink-0' }, [
              props.subscriptions.hasUrl(props.provider.name) &&
                h(
                  Button,
                  {
                    class:
                      'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 disabled:bg-success/15 disabled:border-success/30 disabled:cursor-not-allowed disabled:opacity-100',
                    title: t('providerSubscriptionEditorTitle', {
                      name: props.provider.name,
                    }),
                    'aria-label': t('providerSubscriptionEditorTitle', {
                      name: props.provider.name,
                    }),
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      emit('edit', {
                        name: props.provider.name,
                        url: props.subscriptions.getUrl(props.provider.name),
                      })
                    },
                  },
                  {
                    default: () =>
                      h(IconReload, {
                        size: 18,
                      }),
                  },
                ),
              h(
                Button,
                {
                  class:
                    'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 disabled:bg-success/15 disabled:border-success/30 disabled:cursor-not-allowed disabled:opacity-100',
                  disabled:
                    proxiesStore.proxyProviderLatencyTestingMap[
                      props.provider.name
                    ],
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    proxiesStore.proxyProviderLatencyTest(props.provider.name)
                  },
                },
                {
                  default: () =>
                    h(IconBrandSpeedtest, {
                      size: 18,
                      class: {
                        'animate-pulse text-success':
                          proxiesStore.proxyProviderLatencyTestingMap[
                            props.provider.name
                          ],
                      },
                    }),
                },
              ),
              h(
                Button,
                {
                  class:
                    'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0',
                  title: t('configureSubscriptionUrl'),
                  'aria-label': t('configureSubscriptionUrl'),
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    emit('configure', props.provider.name)
                  },
                },
                { default: () => h(IconSettings, { size: 18 }) },
              ),
            ]),
          ],
        ),
        h('div', { class: 'flex flex-col gap-2.5 pt-1' }, [
          h(
            'div',
            {
              class:
                'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-base-content/45',
            },
            [
              h(
                'span',
                `${t('updated')} ${formatTimeFromNow(props.provider.updatedAt, locale.value)}`,
              ),
              subscriptionInfo.value &&
                h('span', { 'aria-hidden': 'true' }, '·'),
              subscriptionInfo.value &&
                h('span', `${t('expire')}: ${subscriptionExpiry.value}`),
            ],
          ),
          !proxiesStore.collapsedMap[props.provider.name] &&
            h(ProxyNodePreview, {
              proxyNameList: props.sortedProxyNames,
              testUrl: props.provider.testUrl,
            }),
        ]),
      ])
  },
})
</script>
