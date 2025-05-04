<template>
  <main>
    <div v-if="sessionStore.isLoggedIn" class="app-container">
      <header class="app-header">
        <h1>Weekly Tasks</h1>
        <div class="user-info">
          <p>
            <span>{{ sessionStore.webid }}</span>
          </p>
          <button @click="sessionStore.logout" class="logout-button">
            Logout
          </button>
        </div>
      </header>
    </div>
    <TaskManager />
  </main>
</template>

<script setup lang="ts">
import TaskManager from '@/components/TaskManager.vue'
import { useSessionStore } from 'solid-helper-vue'

const sessionStore = useSessionStore()
</script>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-button {
  padding: 0.5rem 1rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.logout-button:hover {
  background: #c82333;
}
</style>
