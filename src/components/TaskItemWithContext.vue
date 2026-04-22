<template>
  <div
    class="task-item-with-context"
    :class="{ 'is-completing': completing }"
  >
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
          @click.stop
          class="task-checkbox"
          title="Mark as complete"
        />
        <span class="task-name" :class="{ completed: task.completed }">
          {{ task.name }}
        </span>
        <span v-if="completing" class="completing-badge">Done — click to undo</span>
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
        <button
          v-if="canPostpone && !isPostponed && !completing"
          class="postpone-btn"
          title="Move to This Week for now (restored automatically after a few hours)"
          @click="handlePostpone"
        >
          Later
        </button>
        <span v-if="isPostponed" class="postponed-badge">Postponed</span>
        <button
          v-if="isPostponed"
          class="restore-btn"
          title="Restore to Focus Now"
          @click="handleRestore"
        >
          Restore
        </button>
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

    <!-- Children tasks that are also prioritized (arbitrary depth) -->
    <div v-if="childrenInGroup.length > 0" class="children-in-group">
      <div
        v-for="{ task: child, depth } in childrenInGroup"
        :key="child.id"
        class="child-task"
        :style="{ marginLeft: `${depth * 1.5}rem` }"
        title="Click to edit task"
        @click="emit('select', child)"
      >
        <input
          type="checkbox"
          :checked="child.completed"
          @change.stop="toggleChildComplete(child)"
          @click.stop
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
  completing?: boolean // Task was just marked complete; still shown briefly for undo
  canPostpone?: boolean // Show "Later" button (focusNow tasks)
  isPostponed?: boolean // Show "Postponed" badge + "Restore" button (thisWeek tasks)
}

const props = withDefaults(defineProps<Props>(), {
  showParent: false,
  priority: false,
  tasksInGroup: () => [],
  completing: false,
  canPostpone: false,
  isPostponed: false,
})

const emit = defineEmits<{
  (e: 'select', task: TaskClass): void
  (e: 'complete', task: TaskClass): void
  (e: 'postpone', task: TaskClass): void
  (e: 'restore', task: TaskClass): void
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

// Get all descendant tasks that are also in the same priority group,
// collected depth-first so they render in natural tree order.
// depth=0 means direct child; depth=1 grandchild, etc.
const childrenInGroup = computed((): { task: TaskClass; depth: number }[] => {
  if (!props.tasksInGroup || props.tasksInGroup.length === 0) return []

  const taskIds = new Set(props.tasksInGroup.map(t => t.id))
  const result: { task: TaskClass; depth: number }[] = []

  function collect(parentId: string, depth: number) {
    const parent = store.taskMap.get(parentId)
    if (!parent) return
    for (const childId of parent.childIds) {
      const child = store.taskMap.get(childId)
      if (child && taskIds.has(child.id)) {
        result.push({ task: child, depth })
        collect(child.id, depth + 1)
      }
    }
  }

  collect(props.task.id, 0)
  return result
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
  props.task.completed = !props.task.completed
  emit('complete', props.task)
}

// Toggle child task completion
function toggleChildComplete(child: TaskClass) {
  child.completed = !child.completed
  emit('complete', child)
}

// Postpone / restore
function handlePostpone(event: MouseEvent) {
  event.stopPropagation()
  emit('postpone', props.task)
}

function handleRestore(event: MouseEvent) {
  event.stopPropagation()
  emit('restore', props.task)
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
  color: var(--color-text-muted);
  padding: 0.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.parent-indicator {
  color: var(--color-drag-handle);
}

.parent-name {
  font-style: italic;
}

.main-task {
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  transition: all 0.2s;
}

.main-task.clickable {
  cursor: pointer;
}

.main-task:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: var(--color-accent);
}

.main-task.is-priority {
  border-left: 4px solid var(--color-priority-border);
  background: var(--color-priority-bg);
}

.main-task.is-overdue {
  border-left: 4px solid var(--color-overdue-border);
  background: var(--color-overdue-bg);
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
  color: var(--color-text-primary);
}

.task-name.completed {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.overdue-badge {
  padding: 0.25rem 0.5rem;
  background: var(--color-overdue-border);
  color: white;
  font-size: 0.75rem;
  border-radius: 4px;
  font-weight: 600;
}

.subtask-badge {
  padding: 0.25rem 0.5rem;
  background: var(--color-postponed-badge);
  color: white;
  font-size: 0.75rem;
  border-radius: 4px;
}

.children-in-group {
  margin-top: 0.5rem;
  margin-left: 2rem;
  padding-left: 1rem;
  border-left: 3px solid var(--color-border-light);
}

.child-task {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: var(--color-surface-alt);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.child-task:hover {
  background: var(--color-surface-hover);
}

.child-task-name {
  flex: 1;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.child-task-name.completed {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.overdue-badge-small {
  padding: 0.125rem 0.375rem;
  background: var(--color-overdue-border);
  color: white;
  font-size: 0.7rem;
  border-radius: 3px;
  font-weight: 600;
}

.task-description {
  margin-left: 2rem;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.task-meta {
  margin-left: 2rem;
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
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

@keyframes fade-completing {
  0% {
    opacity: 1;
  }
  83% {
    opacity: 0.4;
  }
  100% {
    opacity: 0.4;
  }
}

.task-item-with-context.is-completing {
  animation: fade-completing 5s ease forwards;
}

.task-item-with-context.is-completing .main-task {
  border-color: var(--color-border-medium);
}

.completing-badge {
  padding: 0.125rem 0.5rem;
  background: var(--color-completing-badge);
  color: white;
  font-size: 0.72rem;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

.postpone-btn {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border-medium);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  margin-left: auto;
}

.postpone-btn:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-text-secondary);
  color: var(--color-text-primary);
}

.postponed-badge {
  padding: 0.125rem 0.5rem;
  background: var(--color-postponed-badge);
  color: white;
  font-size: 0.72rem;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

.restore-btn {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-accent);
  background: transparent;
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.restore-btn:hover {
  background: var(--color-accent);
  color: white;
}
</style>
