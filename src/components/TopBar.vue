<template>
  <div class="top-bar">
    <div class="top-bar-content">
      <BrandLogo />
      <Navigation />
      <div class="top-bar-right">
        <SyncStatus
          v-if="syncStatusData && syncStatusData.isAuthenticated"
          :status="syncStatusData.syncStatus"
          :showSyncButton="true"
          @sync="handleManualSync"
        />
        <UserSection />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BrandLogo from './TopBar/BrandLogo.vue'
import Navigation from './TopBar/Navigation.vue'
import UserSection from './TopBar/UserSection.vue'
import SyncStatus from './SyncStatus.vue'
import { useLocalFirstTasks } from '@/composables/useLocalFirstTasks'

const syncStatusData = ref<{
  syncStatus: any
  isAuthenticated: any
  manualSync: () => Promise<void>
} | null>(null)

onMounted(() => {
  const data = useLocalFirstTasks()
  syncStatusData.value = {
    syncStatus: data.syncStatus,
    isAuthenticated: data.isAuthenticated,
    manualSync: data.manualSync,
  }
})

async function handleManualSync() {
  if (!syncStatusData.value) return
  try {
    await syncStatusData.value.manualSync()
  } catch (err) {
    console.error('Manual sync failed:', err)
  }
}
</script>

<style scoped>
.top-bar {
  background: #ffffff;
  border-bottom: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.top-bar-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .top-bar-content {
    padding: 0 0.5rem;
  }

  .top-bar-right {
    gap: 0.5rem;
  }
}
</style>
