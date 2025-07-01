<template>
  <section class="home-view">
    <div class="app-container">
      <TaskManager />
    </div>
  </section>
</template>

<script setup lang="ts">
import TaskManager from '@/components/TaskManager.vue'
</script>

<style scoped>
.home-view {
  padding: 2rem 0;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}
</style>
