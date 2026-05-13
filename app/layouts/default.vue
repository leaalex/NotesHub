<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100 text-zinc-900 antialiased">
    <LayoutAppHeader />
    <div class="relative min-h-0 flex-1 overflow-y-auto">
      <slot />
    </div>
  </div>
</template>
