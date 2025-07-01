<template>
  <div class="top-bar">
    <div class="top-bar-content">
      <!-- Logo/Brand -->
      <div class="brand">
        <RouterLink to="/" class="brand-link">
          <i class="pi pi-calendar" style="font-size: 1.5rem; margin-right: 0.5rem;"></i>
          <span class="brand-text">Solid Planner</span>
        </RouterLink>
      </div>

      <!-- Navigation -->
      <nav class="navigation">
        <RouterLink to="/" class="nav-link">
          <i class="pi pi-home"></i>
          <span>Home</span>
        </RouterLink>
        <RouterLink to="/about" class="nav-link">
          <i class="pi pi-info-circle"></i>
          <span>About</span>
        </RouterLink>
      </nav>

      <!-- User Section -->
      <div class="user-section">
        <!-- When user is logged in -->
        <div v-if="sessionStore.isLoggedIn" class="user-info">
          <div class="user-details">
            <Avatar
              :label="userInitials"
              class="user-avatar"
              shape="circle"
            />
            <div class="user-text">
              <span class="user-name">{{ displayName }}</span>
              <span class="user-webid">{{ sessionStore.webid }}</span>
            </div>
          </div>
          <Button
            icon="pi pi-sign-out"
            text
            rounded
            severity="secondary"
            @click="logout"
            v-tooltip.bottom="'Logout'"
            class="logout-btn"
          />
        </div>

        <!-- When user is not logged in -->
        <div v-else class="login-section">
          <Button
            label="Login"
            icon="pi pi-sign-in"
            @click="showLoginDialog = true"
            class="login-btn"
          />
        </div>
      </div>
    </div>

    <!-- Login Dialog -->
    <Dialog
      v-model:visible="showLoginDialog"
      header="Login to Your Solid Pod"
      :style="{ width: '450px' }"
      modal
      class="login-dialog"
    >
      <div class="login-form">
        <div class="provider-selection">
          <label for="provider" class="field-label">Identity Provider:</label>
          <Dropdown
            id="provider"
            v-model="selectedProvider"
            :options="providerOptions"
            option-label="name"
            option-value="url"
            placeholder="Select your provider"
            class="provider-dropdown"
          />

          <InputText
            v-if="selectedProvider === 'custom'"
            v-model="customProvider"
            placeholder="Enter your Solid Identity Provider URL"
            class="custom-provider-input"
          />
        </div>

        <div class="login-actions">
          <Button
            label="Cancel"
            text
            @click="showLoginDialog = false"
            class="cancel-btn"
          />
          <Button
            label="Login"
            icon="pi pi-sign-in"
            @click="login"
            :loading="isLoading"
            class="confirm-login-btn"
          />
        </div>

        <div v-if="error" class="error-message">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ error }}</span>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSessionStore } from 'solid-helper-vue'
import { useToast } from 'primevue/usetoast'
import { AUTH_CONFIG } from '@/constants/auth'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'

const sessionStore = useSessionStore()
const toast = useToast()

// Login dialog state
const showLoginDialog = ref(false)
const selectedProvider = ref(AUTH_CONFIG.defaultProvider)
const customProvider = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)

// Provider options for dropdown
const providerOptions = [
  ...Object.entries(AUTH_CONFIG.identityProviders).map(([name, url]) => ({
    name,
    url
  })),
  { name: 'Custom Provider', url: 'custom' }
]

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

// Login function
const login = async () => {
  try {
    isLoading.value = true
    error.value = null

    const oidcIssuer = selectedProvider.value === 'custom'
      ? customProvider.value
      : selectedProvider.value

    if (!oidcIssuer) {
      error.value = 'Please provide a valid Identity Provider URL'
      return
    }

    await sessionStore.login(oidcIssuer, AUTH_CONFIG.redirectUrl, AUTH_CONFIG.clientName)

    showLoginDialog.value = false
    toast.add({
      severity: 'success',
      summary: 'Login Successful',
      detail: 'You have been logged in successfully',
      life: 3000
    })
  } catch (e: any) {
    error.value = `Login failed: ${e.message || 'Unknown error'}`
    toast.add({
      severity: 'error',
      summary: 'Login Failed',
      detail: error.value,
      life: 5000
    })
  } finally {
    isLoading.value = false
  }
}

// Logout function
const logout = async () => {
  try {
    await sessionStore.logout()
    toast.add({
      severity: 'info',
      summary: 'Logged Out',
      detail: 'You have been logged out successfully',
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

/* Brand section */
.brand {
  display: flex;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #495057;
  font-weight: 600;
  font-size: 1.25rem;
}

.brand-link:hover {
  color: #007bff;
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 600;
}

/* Navigation */
.navigation {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: #6c757d;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #007bff;
  background-color: #f8f9fa;
}

.nav-link.router-link-active {
  color: #007bff;
  background-color: #e3f2fd;
}

/* User section */
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

/* Login dialog */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.provider-selection {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-label {
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
}

.provider-dropdown,
.custom-provider-input {
  width: 100%;
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.confirm-login-btn {
  background: #007bff;
  border-color: #007bff;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .top-bar-content {
    padding: 0 0.5rem;
  }

  .navigation {
    display: none;
  }

  .user-text {
    display: none;
  }

  .brand-text {
    display: none;
  }
}
</style>
