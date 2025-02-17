<template>
  <slot>To Restore Login function after finishing UI</slot>
  <!-- <slot v-if="sessionStore.isLoggedIn">No content for Slot</slot>
  <div v-else class="login-container">
    <h2>Login to Your Solid Pod</h2>
    <div class="provider-selection">
      <label for="provider">Select your Identity Provider:</label>
      <select id="provider" v-model="selectedProvider" class="provider-select">
        <option
          v-for="(url, name) in AUTH_CONFIG.identityProviders"
          :key="url"
          :value="url"
        >
          {{ name }}
        </option>
        <option value="custom">Custom Provider</option>
      </select>

      <input
        v-if="selectedProvider === 'custom'"
        v-model="customProvider"
        placeholder="Enter your Solid Identity Provider URL"
        class="custom-provider-input"
      />
    </div>

    <button @click="login" class="login-button" :disabled="isLoading">
      {{ isLoading ? 'Logging in...' : 'Login' }}
    </button>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div> -->
</template>

<script setup lang="ts">
// import { inject } from 'vue'
import { SessionProvider, KEYS, useSessionStore } from 'solid-helper-vue'
import { ref } from 'vue'
import { AUTH_CONFIG } from '../constants/auth'

const sessionStore = useSessionStore()

// // Not working. Need to figure out why. Currently use the store directly.
// const session = inject(KEYS.SESSION)
// const sessionInfo = inject(KEYS.SESSION_INFO)
// const loginInner = inject<
//   (
//     solidIdentityProvider: string,
//     redirectUrl: string,
//     clientName: string,
//   ) => Promise<void>
// >(KEYS.LOGIN)
const loginInner = sessionStore.login

const selectedProvider = ref(AUTH_CONFIG.defaultProvider)
const customProvider = ref('')
const isLoading = ref(false)
const error = ref(null)

const login = async () => {
  try {
    isLoading.value = true
    error.value = null

    const oidcIssuer =
      selectedProvider.value === 'custom'
        ? customProvider.value
        : selectedProvider.value

    loginInner(oidcIssuer, AUTH_CONFIG.redirectUrl, AUTH_CONFIG.clientName)
  } catch (e) {
    error.value = `Login failed: ${e.message}`
    isLoading.value = false
  }
}
</script>

<style scoped>
.auth-wrapper {
  height: 100%;
}

.login-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.provider-selection {
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.provider-select,
.custom-provider-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.login-button {
  width: 100%;
  padding: 0.75rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover:not(:disabled) {
  background: #45a049;
}

.login-button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  font-size: 0.9rem;
}
</style>
