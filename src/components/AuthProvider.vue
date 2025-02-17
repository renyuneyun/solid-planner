<template>
  <div class="auth-wrapper">
    <slot v-if="session?.info.isLoggedIn" :session="session">
      <!-- Main app content will be rendered here when authenticated -->
    </slot>
    <div v-else class="login-container">
      <h2>Login to Your Solid Pod</h2>
      <div class="provider-selection">
        <label for="provider">Select your Identity Provider:</label>
        <select
          id="provider"
          v-model="selectedProvider"
          class="provider-select"
        >
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
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import {
  handleIncomingRedirect,
  login as solidLogin,
  getDefaultSession,
} from '@inrupt/solid-client-authn-browser'
import { AUTH_CONFIG } from '../constants/auth'

export default {
  name: 'AuthProvider',

  setup() {
    const session = ref(null)
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

        await solidLogin({
          oidcIssuer,
          redirectUrl: AUTH_CONFIG.redirectUrl,
          clientName: AUTH_CONFIG.clientName,
        })
      } catch (e) {
        error.value = `Login failed: ${e.message}`
        isLoading.value = false
      }
    }

    onMounted(async () => {
      try {
        // Handle the redirect after login
        await handleIncomingRedirect({
          restorePreviousSession: true,
        })

        session.value = getDefaultSession()
      } catch (e) {
        error.value = `Authentication error: ${e.message}`
      }
    })

    return {
      session,
      selectedProvider,
      customProvider,
      isLoading,
      error,
      login,
      AUTH_CONFIG,
    }
  },
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
