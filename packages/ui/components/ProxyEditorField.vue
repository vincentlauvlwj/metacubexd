<template>
  <label
    class="grid min-h-8 grid-cols-1 items-center gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_minmax(0,1fr)]"
  >
    <slot />
  </label>
</template>

<style scoped>
:slotted(span) {
  min-width: 0;
  overflow-wrap: break-word;
}

:slotted(select),
:slotted(input:not([type='checkbox'])) {
  width: 100%;
  min-width: 0;
}

:slotted(input[type='checkbox']) {
  justify-self: flex-start;
}
</style>
