<template>
  <div class="top-bar">
    <div class="top-bar-content">
      <BrandLogo />
      <Navigation />
      <div class="top-bar-right">
        <SyncStatus
          v-if="isAuthenticated"
          :status="syncStatus"
          :showSyncButton="true"
          @sync="handleManualSync"
        />
        <UserSection />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BrandLogo from './TopBar/BrandLogo.vue'
import Navigation from './TopBar/Navigation.vue'
import UserSection from './TopBar/UserSection.vue'
import SyncStatus from './SyncStatus.vue'
import { useSolidTasks } from '@/composables/useSolidTasks'

const { syncStatus, isAuthenticated, manualSync } = useSolidTasks()

async function handleManualSync() {
  try {
    await manualSync()
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
