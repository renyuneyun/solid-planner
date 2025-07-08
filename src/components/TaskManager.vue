<template>
  <div class="task-manager">
    <div class="task-manager-header">
      <h1>Task Management</h1>
      <div class="quick-add">
        <InputText v-model="newTaskName" placeholder="Add new task..." @keydown.enter="addQuickTask" class="w-full" />
        <Button icon="pi pi-plus" @click="addQuickTask" />
        <Button icon="pi pi-bars" @click="openNewTaskDrawer" />
      </div>
    </div>

    <div class="task-manager-content">
      <div class="task-list" :class="{ 'with-detail': isDrawerOpen }">
        <template v-if="tasks.length">
          <div class="task-list-header">
            <span class="name-column">Name</span>
            <span class="status-column">Status</span>
            <span class="date-column">Due Date</span>
            <span class="actions-column">Actions</span>
          </div>
          <draggable v-model="tasks" group="tasks" item-key="id" handle=".task-drag-handle" @end="onDragEnd"
            ghost-class="ghost-task" class="task-draggable">
            <template #item="{ element, index }">
              <task-item :task="element" :level="0" :expanded="expandedTaskIds.has(element.id)"
                :expanded-tasks="expandedTaskIds" @select="selectTask" @toggle="toggleTaskExpanded"
                @delete="deleteTask" />
            </template>
          </draggable>
        </template>
        <div v-else class="no-tasks">
          <i class="pi pi-check-circle"></i>
          <p>No tasks currently. Click the "+" above to add a task</p>
        </div>
      </div>
    </div>

    <!-- Task drawer (shared for editing and creating new tasks) -->
    <div class="detail-overlay" :class="{ visible: isDrawerOpen }" @click="closeDrawer"></div>

    <div class="task-drawer" :class="{ visible: isDrawerOpen }">
      <div class="drawer-header">
        <h2>{{ drawerMode === 'edit' ? 'Task Details' : 'Create New Task' }}</h2>
        <Button icon="pi pi-times" text @click="closeDrawer" class="close-btn" />
      </div>

      <!-- Edit task mode -->
      <div v-if="drawerMode === 'edit' && selectedTask">
        <TaskForm v-model="selectedTask" :showSubtasks="true" :availableTasksForSubtask="availableTasksForSubtask"
          @remove-subtask="removeSubtask" @add-subtask="addSubtask" class="drawer-form">
          <template #actions>
            <div class="actions">
              <Button label="Save" icon="pi pi-check" @click="saveTask" />
              <Button label="Delete" icon="pi pi-trash" severity="danger" text @click="confirmDelete" />
            </div>
          </template>
        </TaskForm>
      </div>

      <!-- New task mode -->
      <div v-else-if="drawerMode === 'new'">
        <TaskForm v-model="newTask" class="drawer-form">
          <template #actions>
            <div class="actions">
              <Button label="Cancel" icon="pi pi-times" text @click="closeDrawer" />
              <Button label="Create" icon="pi pi-check" @click="createNewTask" />
            </div>
          </template>
        </TaskForm>
      </div>
    </div>

    <!-- Confirm delete dialog -->
    <ConfirmDialog></ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { v4 as uuidv4 } from 'uuid'
import { TaskClass, Status } from '@/types/task'
import draggable from 'vuedraggable'
import TaskItem from './TaskItem.vue'
import TaskForm from './TaskForm.vue'
import { useTaskStore } from '@/stores/tasks'
import { useSessionStore } from 'solid-helper-vue'
import { findStorage } from '@renyuneyun/solid-helper'
import { fetchTasks } from '@/utils/queries'

// Use confirm dialog
const confirm = useConfirm()

// Task list data, will be provided by external source later
const tasks = ref<TaskClass[]>([])

// List of expanded task IDs
const expandedTaskIds = ref<Set<string>>(new Set())

// Currently selected task
const selectedTask = ref<TaskClass | null>(null)

// Drawer state management
const drawerMode = ref<'edit' | 'new'>('edit')
const isDrawerOpen = computed(
  () =>
    (drawerMode.value === 'edit' && selectedTask.value !== null) ||
    drawerMode.value === 'new',
)

// Calculate available task list for adding as subtasks
// Avoid circular dependencies, need to exclude current task and all its descendant tasks
const availableTasksForSubtask = computed(() => {
  if (!selectedTask.value) return []

  // Get all descendant task IDs under current task (including current task)
  const excludeIds = new Set<string>()

  // Recursively collect subtask IDs
  const collectChildTaskIds = (task: TaskClass) => {
    excludeIds.add(task.id)
    if (task.subTasks) {
      task.subTasks.forEach(subtask => collectChildTaskIds(subtask))
    }
  }

  collectChildTaskIds(selectedTask.value)

  // Filter out tasks that need to be excluded from all tasks
  const flattenTasks: TaskClass[] = []

  // Recursively collect all top-level tasks and their subtasks
  const collectAllTasks = (taskList: TaskClass[]) => {
    taskList.forEach(task => {
      if (!excludeIds.has(task.id)) {
        flattenTasks.push(task)
      }
      if (task.subTasks) {
        collectAllTasks(task.subTasks)
      }
    })
  }

  collectAllTasks(tasks.value)
  return flattenTasks
})

// New task form
const newTask = reactive<Partial<TaskClass>>({
  name: '',
  description: '',
  status: Status.IN_PROGRESS,
  subTasks: [],
})

// Quick add task
const newTaskName = ref('')

// Add a simple task
function addQuickTask() {
  if (!newTaskName.value.trim()) return

  const task = new TaskClass({
    id: uuidv4(),
    name: newTaskName.value,
    addedDate: new Date(),
    subTasks: [],
  })

  tasks.value.push(task)
  newTaskName.value = ''
}

// Open new task drawer
function openNewTaskDrawer() {
  // Reset form
  Object.assign(newTask, {
    name: '',
    description: '',
    status: Status.IN_PROGRESS,
    startDate: undefined,
    endDate: undefined,
    subTasks: [],
  })

  // Switch to new mode and open drawer
  drawerMode.value = 'new'
}

// Close drawer
function closeDrawer() {
  if (drawerMode.value === 'edit') {
    selectedTask.value = null
  }
  drawerMode.value = 'edit' // Default back to edit mode
}

// Create detailed new task
function createNewTask() {
  if (!newTask.name?.trim()) return

  const task = new TaskClass({
    id: uuidv4(),
    name: newTask.name,
    description: newTask.description,
    addedDate: new Date(),
    startDate: newTask.startDate,
    endDate: newTask.endDate,
    status: newTask.status || Status.IN_PROGRESS,
    subTasks: [],
  })

  tasks.value.push(task)
  closeDrawer()
}

// Select task to show details
function selectTask(task: TaskClass) {
  selectedTask.value = task
  drawerMode.value = 'edit'
}

// Expand/collapse task
function toggleTaskExpanded(taskId: string) {
  if (expandedTaskIds.value.has(taskId)) {
    expandedTaskIds.value.delete(taskId)
  } else {
    expandedTaskIds.value.add(taskId)
  }
}

// Find task by specific ID
function findTaskById(taskId: string): TaskClass | null {
  const findInList = (taskList: TaskClass[]): TaskClass | null => {
    for (const task of taskList) {
      if (task.id === taskId) {
        return task
      }
      if (task.subTasks && task.subTasks.length > 0) {
        const found = findInList(task.subTasks)
        if (found) return found
      }
    }
    return null
  }

  return findInList(tasks.value)
}

// Add subtask
function addSubtask(taskId: string) {
  if (!selectedTask.value) return

  // Find the task to add as subtask
  const taskToAdd = findTaskById(taskId)
  if (!taskToAdd) return

  // Remove from original position
  const removeFromParent = (taskList: TaskClass[], id: string): boolean => {
    for (let i = 0; i < taskList.length; i++) {
      if (taskList[i].id === id) {
        taskList.splice(i, 1)
        return true
      }
      if (taskList[i].subTasks && taskList[i].subTasks.length > 0) {
        if (removeFromParent(taskList[i].subTasks, id)) {
          return true
        }
      }
    }
    return false
  }

  // Remove from top-level tasks
  removeFromParent(tasks.value, taskId)

  // Set parent task relationship
  taskToAdd.parent = selectedTask.value

  // Add to subtask list
  selectedTask.value.subTasks.push(taskToAdd)

  // Update parent-child relationships
  updateTaskRelationships()
}

// Remove subtask from parent task
function removeSubtask(subtaskId: string) {
  if (!selectedTask.value || !selectedTask.value.subTasks) return

  const index = selectedTask.value.subTasks.findIndex(
    task => task.id === subtaskId,
  )
  if (index !== -1) {
    // Move subtask to top level
    const subtask = selectedTask.value.subTasks[index]
    subtask.parent = undefined
    tasks.value.push(subtask)

    // Remove from parent task
    selectedTask.value.subTasks.splice(index, 1)

    // Update parent-child relationships
    updateTaskRelationships()
  }
}

// Find and delete task
function deleteTask(taskId: string) {
  const deleteTaskRecursive = (taskList: TaskClass[]) => {
    const taskIndex = taskList.findIndex(t => t.id === taskId)
    if (taskIndex >= 0) {
      taskList.splice(taskIndex, 1)
      return true
    }

    for (const task of taskList) {
      if (task.subTasks && task.subTasks.length > 0) {
        if (deleteTaskRecursive(task.subTasks)) {
          return true
        }
      }
    }
    return false
  }

  deleteTaskRecursive(tasks.value)

  // If deleted task is currently selected, clear selection
  if (selectedTask.value?.id === taskId) {
    selectedTask.value = null
  }
}

// Confirm delete currently selected task
function confirmDelete() {
  if (!selectedTask.value) return

  confirm.require({
    message: `Are you sure you want to delete task "${selectedTask.value.name}"?`,
    header: 'Confirm Delete',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: () => {
      deleteTask(selectedTask.value!.id)
    },
  })
}

// Save task changes
function saveTask() {
  if (!selectedTask.value) return

  // In actual project, this would call API to save task
  // Since we use references, changes automatically reflect in task list

  // Notify update completion
  // Actual project might need to show success notification

  // Optional: close drawer
  closeDrawer()
}

// Handle drag end event
function onDragEnd(event: any) {
  // Update parent-child relationships after drag end
  updateTaskRelationships()
}

// Update all task parent-child relationships
function updateTaskRelationships() {
  // Recursively update task relationships
  const updateRelationships = (taskList: TaskClass[], parent?: TaskClass) => {
    for (const task of taskList) {
      task.parent = parent
      if (task.subTasks && task.subTasks.length > 0) {
        updateRelationships(task.subTasks, task)
      }
    }
  }

  updateRelationships(tasks.value)
}

// Extracted logic for loading tasks based on session
const sessionStore = useSessionStore()
const taskStore = useTaskStore()

async function loadTasksForSession() {
  if (!sessionStore.webid) {
    return
  }
  const storageUrl = await findStorage(sessionStore.webid)
  if (!storageUrl) {
    console.error('No storage found for current WebID')
    return
  }
  console.log('Loading tasks from storage:', storageUrl)
  const remoteTasks = await fetchTasks(storageUrl, sessionStore.session.fetch);
  taskStore.loadTasks(remoteTasks)
  tasks.value = taskStore.rootTasks
  updateTaskRelationships()
}

watch(
  () => sessionStore.webid,
  async (newWebid, oldWebid) => {
    if (newWebid !== oldWebid) {
      await loadTasksForSession()
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.task-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f8f9fa;
  position: relative;
}

.task-manager-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e9ecef;
  background-color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.task-manager-header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #344767;
}

.quick-add {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
  max-width: 800px;
}

.task-manager-content {
  display: flex;
  flex: 1;
  padding: 1.5rem 2rem;
  overflow: hidden;
  position: relative;
}

.task-list {
  flex: 1;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow-y: auto;
  padding: 0.5rem;
  height: 100%;
  transition: width 0.3s ease;
}

.task-list.with-detail {
  width: calc(100% - 500px);
}

.task-draggable {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.task-list-header {
  display: flex;
  padding: 1rem 1.5rem;
  font-weight: bold;
  border-bottom: 1px solid #e9ecef;
  color: #344767;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.name-column {
  flex: 4;
}

.status-column {
  flex: 1;
  text-align: center;
}

.date-column {
  flex: 2;
  text-align: center;
}

.actions-column {
  flex: 1;
  text-align: right;
}

/* Shared drawer component styles */
.task-drawer {
  position: fixed;
  right: 0;
  top: 0;
  width: 480px;
  height: 100vh;
  background-color: white;
  box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
  padding: 1.5rem 2rem;
  overflow-y: auto;
  z-index: 100;
  transition: transform 0.3s ease;
  transform: translateX(100%);
}

.task-drawer.visible {
  transform: translateX(0);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.drawer-header h2 {
  margin: 0;
  color: #344767;
  font-size: 1.5rem;
}

.close-btn {
  margin-top: -0.5rem;
}

.drawer-form {
  max-width: 100%;
}

.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #f0f0f0;
}

.no-tasks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  color: #6c757d;
}

.no-tasks i {
  font-size: 3.5rem;
  margin-bottom: 1.5rem;
  color: #adb5bd;
}

.ghost-task {
  opacity: 0.5;
  background: #f0f0f0;
}

/* Add overlay layer styles */
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 99;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s;
}

.detail-overlay.visible {
  opacity: 1;
  visibility: visible;
}

/* Improve form field readability */
:deep(.p-dropdown),
:deep(.p-calendar),
:deep(.p-inputtext) {
  width: 100%;
}

:deep(.p-calendar .p-inputtext) {
  width: 100%;
}

:deep(.p-inputtextarea) {
  width: 100%;
  min-height: 120px;
}

@media (max-width: 992px) {
  .task-drawer {
    width: 100%;
  }

  .task-list.with-detail {
    width: 100%;
  }
}
</style>
