# Fork subscription isolation implementation plan

> Execution: implement in the current `main_custom` checkout, preserving the user's uncommitted AGENTS.md. Use existing behavior tests before and after extraction, then review the complete working diff.

**Goal:** Isolate custom subscription UI and editing while preserving the current fork's behavior and reducing changes to upstream files.

**Architecture:** Extract the provider title and URL dialog into subscription components. Keep the page's existing provider-title call sites and use a small forwarding component to supply shared subscription state and actions. Reuse the existing proxy editor through a generic session and presentation contract; a subscription wrapper owns provider names, URLs and subscription-specific options. Restore the upstream subscription information component by moving its compact variant into a separate component.

**Tech stack:** Vue, Nuxt, TypeScript, Vitest and Playwright; no new dependencies.

**Requirements:** The user's refactoring request and root AGENTS.md. Preserve cache identity, tab refresh timing, collapsed previews, latency actions, URL persistence, editor cancellation/retry, node rename/export and normal profile editing. Preserve the current replacement of the provider refresh action and the lack of fallback to core subscription information.

## Tasks

- [x] Establish existing unit-test baseline; add a test proving a supplied editor session bypasses active-profile loading.
- [x] Extract `ProviderSubscriptionSettings.vue`, `ProviderSubscriptionTitle.vue` and `ProviderSubscriptionInfo.vue`; retain one subscription state instance per page and wire existing title call sites through a small adapter.
- [x] Add generic editor session/presentation types, `useProviderSubscriptionEditor.ts` and `ProviderSubscriptionEditor.vue`; remove provider-specific branches from shared editor files. Keep shared loading safeguards and form behavior.
- [x] Verify unit tests, changed-file lint/formatting, type checking and browser interaction checks; compare modified upstream files to `main` and request independent review.

## Review focus

- Switching provider or closing during download must cancel/ignore stale results.
- Canceling URL configuration must not persist a draft; saving must refresh the same shared state used by provider titles.
- Provider title actions must stop collapse propagation and preserve loading/disabled state.
- Subscription nodes remain renameable and export only nodes; active-profile nodes retain locked identities and profile saving.
- All three provider layouts share the extracted title and the page's subscription state; compact usage and expiry retain their existing formatting.

## Verification results

- Baseline: 60 unit-test files, 663 tests passed. After refactoring: 60 files, 664 tests passed.
- Injected-session test failed first because the old editor loaded the active profile; it passes through the generic session interface.
- Changed-file ESLint, Prettier and Vue type checking passed. Installed TypeScript 7.0.2 is incompatible with the existing ESLint/vue-tsc tooling; validation used temporary TypeScript 6.0.3 without changing repository dependencies or lockfiles.
- Browser verification at 1500px and 390px passed for both providers: URL save/cancel, shared usage cache, latency actions, no collapse propagation, node rename/export and retry after HTTP failure. Subscription responses were intercepted with synthetic data. No browser runtime errors were observed.
- Independent read-only review found no regressions or architectural issues. Console-only export, replaced refresh action and cache-only usage remain intentional existing behavior.
- Compared with main, original functional-file churn fell from 303 additions / 87 deletions to 97 additions / 135 deletions (390 to 232 lines). SubscriptionInfo.vue matches main exactly. Extraction relocates the provider title, so deletions increased while custom additions inside upstream files fell substantially.
- Implementation choice: keep the shared component's prop declaration inline, matching the repository's pattern; importing its root Props type required compiler APIs unavailable in the installed TypeScript 7 environment.
