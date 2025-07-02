<template>
  <div class="brand">
    <RouterLink to="/" class="brand-link">
      <i class="pi pi-calendar" style="font-size: 1.5rem; margin-right: 0.5rem;"></i>
      <span class="brand-text">Solid Planner</span>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<style scoped>
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
  transition: color 0.2s;
}

.brand-link:hover {
  color: #007bff;
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 600;
}

/* Responsive design */
@media (max-width: 768px) {
  .brand-text {
    display: none;
  }
}
</style>
