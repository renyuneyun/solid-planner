<template>
  <div class="about">
    <h1>Solid Planner</h1>
    <p class="version">v{{ appVersion }}</p>
  </div>
</template>

<script setup lang="ts">
const appVersion = __APP_VERSION__
</script>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
}

.about .version {
  color: #6c757d;
  font-size: 1rem;
  margin-top: 0.25rem;
}
</style>
