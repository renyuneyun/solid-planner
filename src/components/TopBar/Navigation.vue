<template>
  <nav class="navigation">
    <RouterLink
      v-for="item in navigationItems"
      :key="item.name"
      :to="item.path"
      class="nav-link"
    >
      <i :class="item.icon"></i>
      <span>{{ item.name }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

interface NavigationItem {
  name: string
  path: string
  icon: string
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Home',
    path: '/',
    icon: 'pi pi-home'
  },
  {
    name: 'About',
    path: '/about',
    icon: 'pi pi-info-circle'
  }
]
</script>

<style scoped>
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

/* Responsive design */
@media (max-width: 768px) {
  .navigation {
    display: none;
  }
}
</style>
