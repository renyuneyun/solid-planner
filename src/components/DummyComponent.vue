<template>
  <div>
    <p>Dummy Component: <{{ text }}></p>
  </div>
</template>

<script setup lang="ts">
import { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import { inject, onMounted, ref, Ref } from 'vue'

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')

const text = ref<string>('')

onMounted(() => {
  text.value = dialogRef?.value.data.text
})
</script>
