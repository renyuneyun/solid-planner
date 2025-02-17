<template>
  <div class="task-list">
    <div
      v-for="task in sortedTasks"
      :key="task.id"
      class="task-item"
      :class="[{ completed: task.completed }]"
    >
      <task-item :task="task" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(['update-task', 'delete-task'])

import TaskItem from './TaskItem.vue'
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { NS_SP } from '@/constants/ns'
import { computed } from 'vue'

const taskStore = useTaskStore()

// const sortedTasks = storeToRefs(taskStore).sortedTasks
const sortedTasks = storeToRefs(taskStore).rootTasks
</script>

<style scoped>
.task-list {
  display: grid;
  gap: 10px;
}

.task-item {
  display: flex;
  align-items: start;
  gap: 10px;
  padding: 10px;
  border-radius: 4px;
  background: white;
  border: 1px solid #eee;
}

.task-item.completed {
  opacity: 0.7;
  background: #f8f8f8;
}

.task-item.high {
  border-left: 4px solid #ff4757;
}
.task-item.medium {
  border-left: 4px solid #ffa502;
}
.task-item.low {
  border-left: 4px solid #2ed573;
}

.task-content {
  flex-grow: 1;
}

.task-meta {
  display: flex;
  gap: 10px;
  margin-top: 5px;
  font-size: 0.9em;
  color: #666;
}
</style>
