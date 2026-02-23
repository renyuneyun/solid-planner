<template>
  <div class="task-item-with-context">
    <!-- Parent tasks (shown greyed out for context) -->
    <div v-if="showParent && parentTasks.length > 0" class="parent-context">
      <div
        v-for="(parent, index) in parentTasks"
        :key="parent.id"
        class="parent-task"
        :style="{ paddingLeft: `${index * 1}rem` }"
      >
        <span class="parent-indicator">↳</span>
        <span class="parent-name">{{ parent.name }}</span>
      </div>
    </div>

    <!-- Main task -->
    <div
      class="main-task"
      :class="{
        'is-priority': priority,
        'is-overdue': isTaskOverdue,
        clickable: true,
      }"
      title="Click to edit task"
      @click="selectTask"
    >
      <div class="task-header">
        <input
          type="checkbox"
          :checked="task.completed"
          @change.stop="toggleComplete"
          class="task-checkbox"
          title="Mark as complete"
        />
        <span class="task-name" :class="{ completed: task.completed }">
          {{ task.name }}
        </span>
        <span
          v-if="isTaskOverdue"
          class="overdue-badge"
          title="This task is overdue"
          >Overdue</span
        >
        <span
          v-if="task.childIds.length > 0"
          class="subtask-badge"
          :title="`${completedSubtasks} of ${task.childIds.length} subtasks completed`"
        >
          {{ completedSubtasks }}/{{ task.childIds.length }} subtasks
        </span>
      </div>

      <div v-if="task.description" class="task-description">
        {{ task.description }}
      </div>

      <div class="task-meta">
        <span v-if="deadline" class="deadline">
          {{ deadlineLabel }}: {{ formatDate(deadline) }}
          <span class="days-until">({{ daysUntilText }})</span>
        </span>
        <span v-if="task.startDate" class="start-date">
          Starts: {{ formatDate(task.startDate) }}
        </span>
      </div>
    </div>

    <!-- Children tasks that are also prioritized -->
    <div v-if="childrenInGroup.length > 0" class="children-in-group">
      <div
        v-for="child in childrenInGroup"
        :key="child.id"
        class="child-task"
        title="Click to edit task"
        @click="emit('select', child)"
      >
        <input
          type="checkbox"
          :checked="child.completed"
          @change.stop="toggleChildComplete(child)"
          class="task-checkbox"
          title="Mark as complete"
        />
        <span class="child-task-name" :class="{ completed: child.completed }">
          {{ child.name }}
        </span>
        <span
          v-if="isOverdue(child)"
          class="overdue-badge-small"
          title="This task is overdue"
          >!</span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { TaskClass } from '@/models/TaskClass'
import {
  isOverdue,
  calculateSoftDeadline,
  getDaysUntilDeadline,
  getParentChainIds,
} from '@/utils/priority'

interface Props {
  task: TaskClass
  showParent?: boolean
  priority?: boolean
  tasksInGroup?: TaskClass[] // All tasks in the same priority group
}

const props = withDefaults(defineProps<Props>(), {
  showParent: false,
  priority: false,
  tasksInGroup: () => [],
})

const emit = defineEmits<{
  (e: 'select', task: TaskClass): void
}>()

const store = useTaskStore()

// Get parent tasks for context
const parentTasks = computed(() => {
  if (!props.showParent) return []

  const parentIds = getParentChainIds(props.task.id, store.graph)
  return parentIds
    .map(id => store.taskMap.get(id))
    .filter((t): t is TaskClass => t !== undefined)
    .reverse() // Show from top-level parent down
})

// Get children tasks that are also in the same priority group
const childrenInGroup = computed(() => {
  if (!props.tasksInGroup || props.tasksInGroup.length === 0) return []

  const taskIds = new Set(props.tasksInGroup.map(t => t.id))
  return props.task.childIds
    .map(id => store.taskMap.get(id))
    .filter((t): t is TaskClass => t !== undefined && taskIds.has(t.id))
})

// Check if task is overdue
const isTaskOverdue = computed(() => isOverdue(props.task))

// Get deadline (either explicit or soft deadline)
const deadline = computed(() => {
  return props.task.endDate || calculateSoftDeadline(props.task)
})

const deadlineLabel = computed(() => {
  return props.task.endDate ? 'Deadline' : 'Target'
})

// Days until deadline
const daysUntil = computed(() => getDaysUntilDeadline(props.task))

const daysUntilText = computed(() => {
  const days = daysUntil.value
  if (days < 0) {
    return `${Math.abs(days)} days overdue`
  } else if (days === 0) {
    return 'due today'
  } else if (days === 1) {
    return 'due tomorrow'
  } else {
    return `${days} days left`
  }
})

// Subtask completion
const completedSubtasks = computed(() => {
  return props.task.childIds.filter(childId => {
    const child = store.taskMap.get(childId)
    return child && child.completed
  }).length
})

// Format date for display
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

// Toggle task completion
function toggleComplete() {
  const updatedTask = props.task
  updatedTask.completed = !updatedTask.completed
  store.updateTaskClass(updatedTask)
}

// Toggle child task completion
function toggleChildComplete(child: TaskClass) {
  child.completed = !child.completed
  store.updateTaskClass(child)
}

// Select task for editing
function selectTask() {
  emit('select', props.task)
}
</script>

<style scoped>
.task-item-with-context {
  margin-bottom: 0.5rem;
}

.parent-context {
  margin-bottom: 0.25rem;
}

.parent-task {
  font-size: 0.85rem;
  color: #999;
  padding: 0.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.parent-indicator {
  color: #ccc;
}

.parent-name {
  font-style: italic;
}

.main-task {
  padding: 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.2s;
}

.main-task.clickable {
  cursor: pointer;
}

.main-task:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

.main-task.is-priority {
  border-left: 4px solid #ffc107;
  background: #fffef7;
}

.main-task.is-overdue {
  border-left: 4px solid #dc3545;
  background: #fff5f5;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.task-checkbox {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.task-name {
  flex: 1;
  font-size: 1rem;
  font-weight: 500;
  color: #2c3e50;
}

.task-name.completed {
  text-decoration: line-through;
  color: #999;
}

.overdue-badge {
  padding: 0.25rem 0.5rem;
  background: #dc3545;
  color: white;
  font-size: 0.75rem;
  border-radius: 4px;
  font-weight: 600;
}

.subtask-badge {
  padding: 0.25rem 0.5rem;
  background: #6c757d;
  color: white;
  font-size: 0.75rem;
  border-radius: 4px;
}

.children-in-group {
  margin-top: 0.5rem;
  margin-left: 2rem;
  padding-left: 1rem;
  border-left: 3px solid #e0e0e0;
}

.child-task {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: #f8f9fa;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.child-task:hover {
  background: #e9ecef;
}

.child-task-name {
  flex: 1;
  font-size: 0.9rem;
  color: #495057;
}

.child-task-name.completed {
  text-decoration: line-through;
  color: #999;
}

.overdue-badge-small {
  padding: 0.125rem 0.375rem;
  background: #dc3545;
  color: white;
  font-size: 0.7rem;
  border-radius: 3px;
  font-weight: 600;
}

.task-description {
  margin-left: 2rem;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.task-meta {
  margin-left: 2rem;
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #6c757d;
}

.deadline,
.start-date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.days-until {
  font-weight: 600;
}
</style>
