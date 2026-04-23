<script setup lang="ts">
import { SessionProvider } from 'solid-helper-vue'
import { DynamicDialog } from 'primevue'
import TopBar from '@/components/TopBar.vue'
import Toast from 'primevue/toast'
import { onMounted } from 'vue'
import { ANIMATIONS } from '@/config/animations'

onMounted(() => {
  document.documentElement.style.setProperty(
    '--completion-animation-duration',
    `${ANIMATIONS.COMPLETION_FADE_DURATION}ms`,
  )
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
