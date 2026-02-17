<template>
  <div class="user-section">
    <!-- When user is logged in -->
    <div v-if="sessionStore?.isLoggedIn" class="user-info">
      <div class="user-details">
        <Avatar :label="userInitials" class="user-avatar" shape="circle" />
        <div class="user-text">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-webid">{{ sessionStore?.webid }}</span>
        </div>
      </div>
      <Button
        icon="pi pi-sign-out"
        text
        rounded
        severity="secondary"
        @click="handleLogout"
        v-tooltip.bottom="'Logout'"
        class="logout-btn"
      />
    </div>

    <!-- When user is not logged in -->
    <div v-else class="login-section">
      <Button
        label="Login"
        icon="pi pi-sign-in"
        @click="handleLoginClick"
        class="login-btn"
      />
    </div>

    <!-- Login Dialog -->
    <LoginDialog v-model:visible="showLoginDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSessionStore } from 'solid-helper-vue'
import { useToast } from 'primevue/usetoast'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import LoginDialog from './LoginDialog.vue'

let sessionStore: ReturnType<typeof useSessionStore> | null = null
const toast = useToast()

// Local state
const showLoginDialog = ref(false)

// User display information
const displayName = computed(() => {
  if (!sessionStore?.webid) return ''

  // Extract a readable name from WebID
  try {
    const url = new URL(sessionStore?.webid || '')
    const pathname = url.pathname
    const username =
      pathname.split('/').find(segment => segment && segment !== 'profile') ||
      'User'
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

const handleLogout = async () => {
  try {
    await sessionStore?.logout()
    toast.add({
      severity: 'info',
      summary: 'Logged Out',
      detail: 'You have been logged out successfully',
      life: 3000,
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Logout Failed',
      detail: `Logout failed: ${e.message}`,
      life: 5000,
    })
  }
}

// Initialize store on mount
onMounted(() => {
  sessionStore = useSessionStore()
})
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

/* Responsive design */
@media (max-width: 768px) {
  .user-text {
    display: none;
  }
}
</style>
