<template>
  <Dialog
    v-model:visible="isVisible"
    header="Login to Your Solid Pod"
    :style="{ width: '450px' }"
    modal
    class="login-dialog"
    @hide="resetForm"
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
        <Button label="Cancel" text @click="handleCancel" class="cancel-btn" />
        <Button
          label="Login"
          icon="pi pi-sign-in"
          @click="handleLogin"
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSessionStore } from 'solid-helper-vue'
import { useToast } from 'primevue/usetoast'
import { AUTH_CONFIG } from '@/solid/config'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

let sessionStore: ReturnType<typeof useSessionStore> | null = null
const toast = useToast()

// Local state
const selectedProvider = ref(AUTH_CONFIG.defaultProvider)
const customProvider = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)

// Computed visibility
const isVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

// Provider options for dropdown
const providerOptions = [
  ...Object.entries(AUTH_CONFIG.identityProviders).map(([name, url]) => ({
    name,
    url,
  })),
  { name: 'Custom Provider', url: 'custom' },
]

// Methods
const resetForm = () => {
  selectedProvider.value = AUTH_CONFIG.defaultProvider
  customProvider.value = ''
  error.value = null
  isLoading.value = false
}

const handleCancel = () => {
  isVisible.value = false
}

const handleLogin = async () => {
  try {
    isLoading.value = true
    error.value = null

    const oidcIssuer =
      selectedProvider.value === 'custom'
        ? customProvider.value
        : selectedProvider.value

    if (!oidcIssuer) {
      error.value = 'Please provide a valid Identity Provider URL'
      return
    }

    await sessionStore?.login(
      oidcIssuer,
      AUTH_CONFIG.redirectUrl,
      AUTH_CONFIG.clientName,
    )

    isVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Login Successful',
      detail: 'You have been logged in successfully',
      life: 3000,
    })
  } catch (e: any) {
    error.value = `Login failed: ${e.message || 'Unknown error'}`
    toast.add({
      severity: 'error',
      summary: 'Login Failed',
      detail: error.value,
      life: 5000,
    })
  } finally {
    isLoading.value = false
  }
}

// Initialize store on mount
onMounted(() => {
  sessionStore = useSessionStore()
})
</script>

<style scoped>
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
</style>
