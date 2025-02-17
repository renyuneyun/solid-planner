<template>
  <div class="enhanced-planner">
    <!-- Task Creation with Subtasks -->
    <task-form @add-task="addTask" />

    <div class="task-groups">
      <task-list @update-task="updateTask" @delete-task="deleteTask" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TaskForm from './TaskForm.vue'
import TaskList from './TaskList.vue'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()

taskStore.fetchTasks()

const tasks = ref([])

// Task Management
function addTask(newTask) {
  taskStore.addTask({
    ...newTask,
    id: Date.now(),
    completed: false,
    createdAt: new Date().toISOString(),
  })
}

function updateTask(updatedTask) {
  taskStore.updateTask(updatedTask)
}

function deleteTask(taskId) {
  taskStore.removeTask(taskId)
}
</script>

<style>
.enhanced-planner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.priority-groups {
  display: grid;
  gap: 2rem;
}

.priority-group h3 {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.priority-group .urgent {
  background: #ffebee;
  color: #c62828;
}

.priority-group .high-priority {
  background: #fff3e0;
  color: #ef6c00;
}

.priority-group .upcoming {
  background: #e8f5e9;
  color: #2e7d32;
}

.task-progress {
  height: 4px;
  background: #eee;
  margin: 0.5rem 0;
}

.task-progress-bar {
  height: 100%;
  background: #42b983;
  transition: width 0.3s ease;
}
</style>
