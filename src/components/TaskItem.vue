<template>
  <div class="task-item" :class="[{ overdue: isOverdue }]">
    <div class="task-header">
      <input
        type="checkbox"
        v-model="task.completed"
        @change="emitToggleDone"
      />
      <div class="task-meta">
        <h4>{{ task.name }}</h4>
        <p v-if="task.description">{{ task.description }}</p>
        <div class="start-date" v-if="!isOverdue">
          Start: {{ formatDate(task.effectiveStartDate) }}
        </div>
        <div class="due-date" v-else>
          Due: {{ formatDate(props.task.effectiveEndDate) }}
          <span v-if="isOverdue" class="overdue-label">(OVERDUE)</span>
        </div>
      </div>
      <button @click="emitEdit" class="edit-btn">✍️</button>
      <button @click="emitDelete" class="delete-btn">🗑️</button>
    </div>

    <div v-if="task.subTasks.length" class="subtasks">
      <div
        v-for="(subtask, index) in task.subTasks"
        :key="index"
        class="subtask"
      >
        <task-item
          :task="subtask"
          @toggle-done="emitToggleDone"
          @edit="emitEdit"
          @delete="emitDelete"
        />
      </div>
    </div>

    <div class="task-progress">
      <div
        class="task-progress-bar"
        :style="{ width: completionPercentage + '%' }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue'
import { TaskClass } from '@/types/task'
import { isOverdue as isOverdueF } from '@/utils/datetime'

const props = defineProps({
  task: {
    type: Object as PropType<TaskClass>,
    required: true,
  },
})

const emit = defineEmits(['toggleDone', 'edit', 'delete'])

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const isOverdue = computed(() => isOverdueF(props.task))

const completionPercentage = computed(() => {
  if (!props.task.subTasks.length) return props.task.completed ? 100 : 0
  const completed = props.task.subTasks.filter(t => t.completed).length
  return (completed / props.task.subTasks.length) * 100
})

const effectiveEndDate = computed(() => props.task.effectiveEndDate)
const effectiveStartDate = computed(() => props.task.effectiveStartDate)

function emitToggleDone() {
  emit('toggleDone', props.task.id, !props.task.completed)
}

function emitEdit() {
  emit('edit', props.task.id)
}

function emitDelete() {
  emit('delete', props.task.id)
}
</script>

<style>
.task-item {
  background: white;
  border-left: 4px solid;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.task-item.high {
  border-color: #ff5252;
}
.task-item.medium {
  border-color: #ffc107;
}
.task-item.low {
  border-color: #4caf50;
}

.task-item.overdue {
  background: #fff0f0;
  border-color: #c62828;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.start-date {
  font-size: 0.9em;
  color: #666;
}

.due-date {
  font-size: 0.9em;
  color: #666;
}

.overdue-label {
  color: #c62828;
  font-weight: bold;
}

.subtasks {
  margin-left: 2rem;
  margin-top: 0.5rem;
}

.subtask {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9em;
}

.subtask-due {
  font-size: 0.8em;
  color: #999;
}

.delete-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  color: #666;
}

.completed {
  text-decoration: line-through;
  opacity: 0.7;
}
</style>
