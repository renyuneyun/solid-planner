<template>
  <div class="sync-status" :class="statusClass">
    <i :class="iconClass"></i>
    <span class="status-text">{{ statusText }}</span>
    <Button
      v-if="showSyncButton"
      icon="pi pi-refresh"
      size="small"
      text
      rounded
      @click="onSync"
      :loading="isSyncing"
      :disabled="isOffline"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import type { SyncStatus } from '@/storage/sync/sync-service'

const props = defineProps<{
  status: SyncStatus
  showSyncButton?: boolean
}>()

const emit = defineEmits<{
  sync: []
}>()

const statusClass = computed(() => {
  return `status-${props.status}`
})

const iconClass = computed(() => {
  switch (props.status) {
    case 'syncing':
      return 'pi pi-spin pi-spinner'
    case 'idle':
      return 'pi pi-check-circle'
    case 'error':
      return 'pi pi-exclamation-triangle'
    case 'offline':
      return 'pi pi-wifi-slash'
    default:
      return 'pi pi-circle'
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 'syncing':
      return 'Syncing...'
    case 'idle':
      return 'Synced'
    case 'error':
      return 'Sync error'
    case 'offline':
      return 'Offline'
    default:
      return ''
  }
})

const isSyncing = computed(() => props.status === 'syncing')
const isOffline = computed(() => props.status === 'offline')

function onSync() {
  emit('sync')
}
</script>

<style scoped>
.sync-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.status-idle {
  color: var(--p-green-500);
  background-color: var(--p-green-50);
}

.status-syncing {
  color: var(--p-blue-500);
  background-color: var(--p-blue-50);
}

.status-error {
  color: var(--p-red-500);
  background-color: var(--p-red-50);
}

.status-offline {
  color: var(--p-gray-500);
  background-color: var(--p-gray-50);
}

.status-text {
  font-weight: 500;
}
</style>
