<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { SessionProvider } from 'solid-helper-vue'
import { DynamicDialog } from 'primevue'
import TopBar from '@/components/TopBar.vue'
import Toast from 'primevue/toast'
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
