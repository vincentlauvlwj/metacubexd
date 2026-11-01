# Fork view isolation

Preserve the current branch's UI and behavior while reducing changes to main's
master-detail view and proxy editor. Execute in the current checkout, as requested.

## Design

- Keep ProxyMasterDetail's required groups interface and original list rendering.
  Add generic navigation/title/node slots and a node-list presentation hook.
  A new ForkProxyMasterDetail wrapper owns provider adaptation, card grid,
  group navigation metadata and provider-only slots. Both page tabs opt into it.
- Keep the editor session contract and existing subscription wrapper. Move the
  resource field layout into an independent ProxyEditorField component selected
  explicitly by the two editor callers. Default field markup remains main's.
- Avoid copying either large upstream component or moving its filtering/forms.
  These alternatives would reduce textual diffs while creating stale duplicates.

## Tasks and verification

1. Record unit-test baseline and inspect existing browser coverage.
2. Add regression coverage for provider adaptation and selection isolation, then
   implement the master-detail wrapper and generic slots; preserve scroll refs,
   filter resets, card attributes, navigation metadata and provider title slots.
3. Extract the field wrapper with identical responsive classes. Keep original
   field controls and handlers; verify renaming, group editing, retry/cancel and
   saving with existing editor tests and browser checks where available.
4. Run unit tests, type checking, changed-file lint/format checks and browser
   regression checks. Review main diff size and perform an independent review.

## Progress

- Initial checkout clean. pnpm launcher cannot write its engine store lock in
  this sandbox; use installed tool entry points without changing dependencies.
- Baseline: 61 unit test files / 696 tests passed. After refactoring: 62 files /
  698 tests passed. The new adapter test failed on the missing module before
  implementation; both adapter tests and the 35 subscription editor tests pass.
- Vue type checking and changed-file ESLint pass using temporary TypeScript
  6.0.3 outside the repository (installed TypeScript 7 lacks APIs required by
  vue-tsc and typescript-eslint). Prettier and git diff whitespace checks pass.
- Independent review found no actionable regressions in slot/ref/event
  forwarding, provider selection, field DOM or scoped CSS compilation.
- Against main, the two original components' combined additions/deletions fell
  from 149 lines to 115. ProxyMasterDetail now only adds generic presentation
  hooks; provider adaptation and card rendering live in new fork files.
- Browser comparison against a temporary HEAD snapshot passed at 1500px and
  390px: identical card geometry and computed field styles; working filters,
  desktop scroll-to-top, provider switching, non-selectable provider cards,
  subscription node rename and mocked upload/processing on save. The comparison
  caught a checkbox alignment value difference; matching the original
  `flex-start` value made both viewport comparisons pass. Real services were
  not contacted for subscription download/upload.
