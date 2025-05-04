<!-- filepath: src/components/TaskItem.vue -->
<template>
  <div
    class="task-item"
    :class="{
      'task-completed': task.status === Status.COMPLETED,
      'task-ignored': task.status === Status.IGNORED,
    }"
    :style="{ marginLeft: `${level * 20}px` }"
  >
    <div class="task-item-content" @click="$emit('select', task)">
      <div class="task-drag-handle">
        <i class="pi pi-bars"></i>
      </div>

      <div class="task-expand" v-if="hasSubtasks" @click.stop="toggleExpand">
        <i
          :class="isExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
        ></i>
      </div>
      <div class="task-expand" v-else>
        <i class="pi pi-circle-fill"></i>
      </div>

      <div class="task-name">{{ task.name }}</div>

      <div class="task-status">
        <Tag
          :value="getStatusLabel(task.status)"
          :severity="getStatusSeverity(task.status)"
        />
      </div>

      <div class="task-date">
        {{ task.endDate ? formatDate(task.endDate) : '-' }}
      </div>

      <div class="task-actions">
        <Button
          icon="pi pi-trash"
          text
          severity="danger"
          @click.stop="$emit('delete', task.id)"
        />
      </div>
    </div>

    <!-- Recursively render subtasks -->
    <draggable
      v-if="hasSubtasks && isExpanded"
      v-model="task.subTasks"
      group="tasks"
      item-key="id"
      handle=".task-drag-handle"
      ghost-class="ghost-task"
      :style="{ marginLeft: '20px' }"
    >
      <template #item="{ element }">
        <task-item
          :task="element"
          :level="level + 1"
          :expanded="expandedTasks.has(element.id)"
          :expanded-tasks="expandedTasks"
          @select="$emit('select', $event)"
          @toggle="$emit('toggle', $event)"
          @delete="$emit('delete', $event)"
        />
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TaskClass, Status } from '@/types/task'
import draggable from 'vuedraggable'
import { format } from 'date-fns'
import Tag from 'primevue/tag'

const props = defineProps<{
  task: TaskClass
  level: number
  expanded: boolean
  expandedTasks: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select', task: TaskClass): void
  (e: 'toggle', taskId: string): void
  (e: 'delete', taskId: string): void
}>()

// Check if has subtasks
const hasSubtasks = computed(() => {
  return props.task.subTasks && props.task.subTasks.length > 0
})

// Check if task is expanded
const isExpanded = computed(() => {
  // This needs to sync with parent component's expanded list
  return props.expanded
})

// Toggle expand state
function toggleExpand(event: Event) {
  event.stopPropagation()
  emit('toggle', props.task.id)
}

// Format date
function formatDate(date: Date): string {
  try {
    return format(new Date(date), 'yyyy-MM-dd')
  } catch (e) {
    return '-'
  }
}

// Get status corresponding label
function getStatusLabel(status?: Status): string {
  switch (status) {
    case Status.IN_PROGRESS:
      return 'In Progress'
    case Status.COMPLETED:
      return 'Completed'
    case Status.IGNORED:
      return 'Ignored'
    default:
      return 'Not Started'
  }
}

// Get status corresponding color
function getStatusSeverity(status?: Status): string {
  switch (status) {
    case Status.IN_PROGRESS:
      return 'info'
    case Status.COMPLETED:
      return 'success'
    case Status.IGNORED:
      return 'secondary'
    default:
      return 'warning'
  }
}
</script>

<style scoped>
.task-item {
  border-bottom: 1px solid #f5f5f5;
}

.task-item-content {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.task-item-content:hover {
  background-color: #f9f9f9;
}

.task-drag-handle {
  cursor: grab;
  padding: 0 0.5rem;
  color: #ccc;
}

.task-drag-handle:hover {
  color: #666;
}

.task-expand {
  margin-right: 0.5rem;
  width: 24px;
  display: flex;
  justify-content: center;
}

.task-expand i.pi-circle-fill {
  font-size: 0.5rem;
  color: #ccc;
}

.task-name {
  flex: 3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status {
  flex: 1;
}

.task-date {
  flex: 1;
  color: #6c757d;
}

.task-actions {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  visibility: hidden;
}

.task-item-content:hover .task-actions {
  visibility: visible;
}

.task-completed .task-name {
  text-decoration: line-through;
  color: #6c757d;
}

.task-ignored .task-name {
  color: #adb5bd;
}

.ghost-task {
  opacity: 0.5;
  background: #f0f0f0;
}
</style>
