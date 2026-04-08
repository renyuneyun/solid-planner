<template>
  <div class="user-section">
    <!-- When user is logged in -->
    <div v-if="sessionStore.isLoggedIn" class="user-info">
      <div class="user-details">
        <Avatar :label="userInitials" class="user-avatar" shape="circle" />
        <div class="user-text">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-webid">{{ sessionStore.webid }}</span>
        </div>
      </div>
      <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="showLogoutDialog = true"
        v-tooltip.bottom="'Logout'" class="logout-btn" />
    </div>

    <!-- When user is not logged in -->
    <div v-else class="login-section">
      <Button label="Login" icon="pi pi-sign-in" @click="handleLoginClick" class="login-btn" />
    </div>

    <!-- Login Dialog -->
    <LoginDialog v-model:visible="showLoginDialog" />

    <!-- Logout Confirmation Dialog -->
    <Dialog v-model:visible="showLogoutDialog" header="Log Out" :modal="true" :closable="true"
      :style="{ width: '28rem' }" @hide="cancelCountdown">
      <p class="logout-dialog-message">
        What should happen to your local data on this device?
      </p>
      <ul class="logout-dialog-hints">
        <li>
          <strong>Clear:</strong> removes tasks from this device.
          Your data remains safe in your Solid Pod and will re-sync on next login.
          Recommended on shared or public devices.
        </li>
        <li>
          <strong>Keep:</strong> retains tasks locally, allowing offline viewing and editing even while logged out.
          Changes will sync back to your Pod on next login.
          Recommended on personal devices.
        </li>
      </ul>
      <template #footer>
        <Button :label="`Clear &amp; Log Out (${countdown}s)`" icon="pi pi-trash" severity="danger"
          @click="handleLogout(true)" autofocus />
        <Button label="Keep &amp; Log Out" icon="pi pi-sign-out" @click="handleLogout(false)" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSessionStore } from 'solid-helper-vue'
import { useToast } from 'primevue/usetoast'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import LoginDialog from './LoginDialog.vue'
import { getIndexedDBStorage } from '@/storage/local/indexeddb-storage'
import { useTaskStore } from '@/stores/tasks'

const sessionStore = useSessionStore()
const toast = useToast()
const taskStore = useTaskStore()

// Local state
const showLoginDialog = ref(false)
const showLogoutDialog = ref(false)

// Countdown for auto-logout (keep local data)
const COUNTDOWN_SECONDS = 30
const countdown = ref(COUNTDOWN_SECONDS)
let countdownTimer: ReturnType<typeof setInterval> | null = null

function cancelCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = COUNTDOWN_SECONDS
}

watch(showLogoutDialog, visible => {
  if (visible) {
    countdown.value = COUNTDOWN_SECONDS
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        cancelCountdown()
        handleLogout(true)
      }
    }, 1000)
  } else {
    cancelCountdown()
  }
})

onUnmounted(cancelCountdown)

// User display information
const displayName = computed(() => {
  if (!sessionStore.webid) return ''

  // Extract a readable name from WebID
  try {
    const url = new URL(sessionStore.webid)
    const pathname = url.pathname
    const username = pathname.split('/').find(segment => segment && segment !== 'profile') || 'User'
    return username.charAt(0).toUpperCase() + username.slice(1)
  } catch {
    return 'User'
  }
})

const userInitials = computed(() => {
  if (!displayName.value) return 'U'
  return displayName.value.slice(0, 2).toUpperCase()
})

// Methods
const handleLoginClick = () => {
  showLoginDialog.value = true
}

const handleLogout = async (clearLocalData: boolean) => {
  showLogoutDialog.value = false
  try {
    if (clearLocalData) {
      await getIndexedDBStorage().clearAllTasks()
      taskStore.clearTasks()
    }
    await sessionStore.logout()
    toast.add({
      severity: 'info',
      summary: 'Logged Out',
      detail: clearLocalData
        ? 'You have been logged out and local data has been cleared.'
        : 'You have been logged out successfully.',
      life: 3000
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Logout Failed',
      detail: `Logout failed: ${e.message}`,
      life: 5000
    })
  }
}
</script>

<style scoped>
.user-section {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-details {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  background: #007bff;
  color: white;
  font-weight: 600;
}

.user-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.user-name {
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
}

.user-webid {
  font-size: 0.75rem;
  color: #6c757d;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  color: #6c757d;
}

.logout-btn:hover {
  color: #dc3545;
}

.login-btn {
  background: #007bff;
  border-color: #007bff;
}

.login-btn:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.logout-dialog-message {
  margin: 0 0 0.75rem;
  font-weight: 500;
}

.logout-dialog-hints {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
  color: #6c757d;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .user-text {
    display: none;
  }
}
</style>
