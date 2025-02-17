<template>
  <form @submit.prevent="submitTask" class="enhanced-task-form">
    <div class="form-group">
      <label>Task Title</label>
      <input v-model="task.title" required />
    </div>

    <div class="form-group">
      <label>Due Date</label>
      <input type="date" v-model="task.dueDate" required />
    </div>

    <div class="form-group">
      <label>Priority</label>
      <select v-model="task.priority">
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>

    <button type="submit">Add Task</button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['add-task'])
const task = ref({
  title: '',
  dueDate: '',
  priority: 'medium',
  subtasks: [],
})

function submitTask() {
  emit('add-task', { ...task.value })
  task.value = {
    title: '',
    dueDate: '',
    priority: 'medium',
    subtasks: [],
  }
}
</script>

<style>
.enhanced-task-form {
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.subtasks {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #eee;
}

.subtask {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
</style>
