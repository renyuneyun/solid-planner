<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { SessionProvider, useSessionStore } from 'solid-helper-vue'
import { DynamicDialog } from 'primevue'
import TopBar from '@/components/TopBar.vue'
import Toast from 'primevue/toast'

// Restore session with restorePreviousSession enabled
// SessionProvider doesn't pass this parameter by default, so we do it explicitly
onBeforeMount(async () => {
  const sessionStore = useSessionStore()
  // restorePreviousSession: true enables session persistence across page refreshes
  await sessionStore.handleRedirectAfterLogin(window.location.href, true)
})
</script>

<template>
  <SessionProvider>
    <div class="app-layout">
      <TopBar />
      <main class="main-content">
        <RouterView />
      </main>
      <DynamicDialog />
      <Toast />
    </div>
  </SessionProvider>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
}
</style>
