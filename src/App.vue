<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { SessionProvider } from 'solid-helper-vue'
import { DynamicDialog } from 'primevue'
import LoginProvider from './components/LoginProvider.vue'
</script>

<template>
  <SessionProvider>
    <LoginProvider>
      <RouterView />
      <DynamicDialog />
    </LoginProvider>
  </SessionProvider>
</template>

<style scoped></style>
