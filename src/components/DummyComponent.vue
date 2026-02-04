<template>
  <div>
    <p>Dummy Component: <{{ text }}></p>
  </div>
</template>

<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import { inject, onMounted, ref } from 'vue'
import type { Ref } from 'vue'

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')

const text = ref<string>('')

onMounted(() => {
  text.value = dialogRef?.value.data.text
})
</script>
