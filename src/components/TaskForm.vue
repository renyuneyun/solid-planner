<!-- filepath: /home/ryey/coding/solid-planner/src/components/TaskForm.vue -->
<template>
  <div class="task-form">
    <div class="field">
      <label for="taskName">Task Name</label>
      <InputText id="taskName" v-model="taskModel.name" class="w-full" />
    </div>

    <div class="field">
      <label for="taskDescription">Description</label>
      <Textarea
        id="taskDescription"
        v-model="taskModel.description"
        rows="5"
        class="w-full"
      />
    </div>

    <div class="field">
      <label for="taskStatus">Status</label>
      <Dropdown
        id="taskStatus"
        v-model="taskModel.status"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        class="w-full"
      />
    </div>

    <div class="field-row">
      <div class="field">
        <label for="startDate">Start Date</label>
        <Calendar
          id="startDate"
          v-model="taskModel.startDate"
          showIcon
          class="w-full"
        />
      </div>
      <div class="field">
        <label for="endDate">Due Date</label>
        <Calendar
          id="endDate"
          v-model="taskModel.endDate"
          showIcon
          class="w-full"
        />
      </div>
    </div>

    <!-- Subtask management section -->
    <div class="field" v-if="showSubtasks">
      <div class="subtask-header">
        <label>Subtasks</label>
        <Button
          icon="pi pi-plus"
          text
          size="small"
          @click="showAddSubtaskDialog = true"
          v-tooltip.top="'Add Subtask'"
        />
      </div>

      <div v-if="subtasks.length > 0">
        <ul class="subtask-list">
          <li v-for="subtask in subtasks" :key="subtask.id">
            <div class="subtask-info">
              <i :class="getStatusIcon(subtask.status)"></i>
              <span>{{ subtask.name }}</span>
            </div>
            <div class="subtask-actions">
              <Button
                icon="pi pi-times"
                text
                size="small"
                @click="$emit('remove-subtask', subtask.id)"
              />
            </div>
          </li>
        </ul>
      </div>
      <div v-else class="no-subtasks">No subtasks yet</div>
    </div>

    <slot name="actions"></slot>

    <!-- Add subtask dialog -->
    <Dialog
      v-model:visible="showAddSubtaskDialog"
      header="Add Subtask"
      :style="{ width: '500px' }"
      modal
    >
      <div class="subtask-dialog-content">
        <div class="field">
          <label>Select task to add</label>
          <div class="p-input-icon-left w-full">
            <i class="pi pi-search" />
            <InputText
              v-model="subtaskSearchTerm"
              placeholder="Search tasks..."
              class="w-full"
            />
          </div>
        </div>

        <div class="available-tasks">
          <div
            v-for="task in availableTasks"
            :key="task.id"
            class="available-task-item"
            @click="selectTaskAsSubtask(task)"
          >
            <div class="task-item-info">
              <i :class="getStatusIcon(task.status)"></i>
              <span>{{ task.name }}</span>
            </div>
            <Button icon="pi pi-plus" text rounded />
          </div>

          <div v-if="availableTasks.length === 0" class="no-available-tasks">
            No available tasks to add
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="Close"
          icon="pi pi-times"
          text
          @click="showAddSubtaskDialog = false"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Status, TaskClass } from '@/models/TaskClass'
import { computed, ref, watchEffect } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { getChildTasks } from '@/models/task-operations'

// Define component properties
const props = defineProps<{
  modelValue: TaskClass | Partial<TaskClass> // Use modelValue for two-way binding
  showSubtasks?: boolean
  availableTasksForSubtask?: TaskClass[] // List of tasks available as subtasks
}>()

// Define events
const emit = defineEmits<{
  (e: 'update:modelValue', value: TaskClass | Partial<TaskClass>): void
  (e: 'remove-subtask', subtaskId: string): void
  (e: 'add-subtask', taskId: string): void
}>()

const taskStore = useTaskStore()

// Status options
const statusOptions = [
  { label: 'In Progress', value: Status.IN_PROGRESS },
  { label: 'Completed', value: Status.COMPLETED },
  { label: 'Ignored', value: Status.IGNORED },
]

// Use computed property for two-way binding
const taskModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

// Get subtasks for the current task
const subtasks = computed(() => {
  const task = taskModel.value as TaskClass
  return task && task.id ? getChildTasks(task.id, taskStore) : []
})

// Add subtask related state
const showAddSubtaskDialog = ref(false)
const subtaskSearchTerm = ref('')

// Calculate available task list (exclude current task and its subtasks)
const availableTasks = computed(() => {
  if (!props.availableTasksForSubtask) return []

  const currentTaskId = (taskModel.value as TaskClass).id
  const existingSubtaskIds = new Set(subtasks.value.map(task => task.id))

  // Filter out current task, tasks that are already subtasks, and filter by search term
  return props.availableTasksForSubtask.filter(task => {
    // Cannot add itself as subtask
    if (task.id === currentTaskId) return false

    // Cannot add tasks that are already subtasks
    if (existingSubtaskIds.has(task.id)) return false

    // Filter by search term
    if (subtaskSearchTerm.value) {
      return task.name
        .toLowerCase()
        .includes(subtaskSearchTerm.value.toLowerCase())
    }

    return true
  })
})

// Get icon corresponding to status
function getStatusIcon(status?: Status): string {
  switch (status) {
    case Status.IN_PROGRESS:
      return 'pi pi-spinner text-blue-500'
    case Status.COMPLETED:
      return 'pi pi-check-circle text-green-500'
    case Status.IGNORED:
      return 'pi pi-ban text-gray-500'
    default:
      return 'pi pi-circle-fill text-gray-300'
  }
}

// Select task as subtask
function selectTaskAsSubtask(task: TaskClass) {
  emit('add-subtask', task.id)
  showAddSubtaskDialog.value = false
  subtaskSearchTerm.value = ''
}

// Watch dialog close, reset search term
watchEffect(() => {
  if (!showAddSubtaskDialog.value) {
    subtaskSearchTerm.value = ''
  }
})
</script>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.field-row {
  display: flex;
  gap: 1rem;
}

.field-row .field {
  flex: 1;
}

.subtask-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.subtask-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  overflow: hidden;
}

.subtask-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fcfcfc;
}

.subtask-list li:last-child {
  border-bottom: none;
}

.subtask-list li:hover {
  background-color: #f5f5f5;
}

.subtask-info {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.subtask-actions {
  opacity: 0.7;
}

.subtask-list li:hover .subtask-actions {
  opacity: 1;
}

.no-subtasks {
  padding: 1rem;
  text-align: center;
  color: #6c757d;
  border: 1px dashed #dee2e6;
  border-radius: 6px;
  background-color: #f8f9fa;
}

.available-tasks {
  max-height: 300px;
  overflow-y: auto;
  margin-top: 1rem;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.available-task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.available-task-item:last-child {
  border-bottom: none;
}

.available-task-item:hover {
  background-color: #f5f5f5;
}

.task-item-info {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.no-available-tasks {
  padding: 1.5rem;
  text-align: center;
  color: #6c757d;
}

.subtask-dialog-content {
  padding: 0 1rem;
}
</style>
