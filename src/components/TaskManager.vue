<template>
  <div class="task-manager">
    <div class="task-manager-header">
      <h1>Task Management</h1>
      <div class="quick-add">
        <InputText
          v-model="newTaskName"
          placeholder="Add new task..."
          @keydown.enter="addQuickTask"
          class="w-full"
        />
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
          <draggable
            v-model="tasks"
            group="tasks"
            item-key="id"
            handle=".task-drag-handle"
            @end="onDragEnd"
            ghost-class="ghost-task"
            class="task-draggable"
          >
            <template #item="{ element }">
              <task-item
                :task="element"
                :level="0"
                :expanded="expandedTaskIds.has(element.id)"
                :expanded-tasks="expandedTaskIds"
                @select="selectTask"
                @toggle="toggleTaskExpanded"
                @delete="deleteTask"
              />
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
    <div
      class="detail-overlay"
      :class="{ visible: isDrawerOpen }"
      @click="closeDrawer"
    ></div>

    <div class="task-drawer" :class="{ visible: isDrawerOpen }">
      <div class="drawer-header">
        <h2>
          {{ drawerMode === 'edit' ? 'Task Details' : 'Create New Task' }}
        </h2>
        <Button
          icon="pi pi-times"
          text
          @click="closeDrawer"
          class="close-btn"
        />
      </div>

      <!-- Edit task mode -->
      <div v-if="drawerMode === 'edit' && selectedTask">
        <TaskForm
          v-model="selectedTask"
          :showSubtasks="true"
          :availableTasksForSubtask="availableTasksForSubtask"
          @remove-subtask="removeSubtask"
          @add-subtask="addSubtask"
          class="drawer-form"
        >
          <template #actions>
            <div class="actions">
              <Button label="Save" icon="pi pi-check" @click="saveTask" />
              <Button
                label="Delete"
                icon="pi pi-trash"
                severity="danger"
                text
                @click="confirmDelete"
              />
            </div>
          </template>
        </TaskForm>
      </div>

      <!-- New task mode -->
      <div v-else-if="drawerMode === 'new'">
        <TaskForm
          :modelValue="newTask"
          @update:modelValue="value => Object.assign(newTask, value)"
          class="drawer-form"
        >
          <template #actions>
            <div class="actions">
              <Button
                label="Cancel"
                icon="pi pi-times"
                text
                @click="closeDrawer"
              />
              <Button
                label="Create"
                icon="pi pi-check"
                @click="createNewTask"
              />
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
import { ref, reactive, computed } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { v4 as uuidv4 } from 'uuid'
import { TaskClass, Status } from '@/models/TaskClass'
import draggable from 'vuedraggable'
import TaskItem from './TaskItem.vue'
import TaskForm from './TaskForm.vue'
import { useTaskStore } from '@/stores/tasks'
import { useSolidTasks } from '@/composables/useSolidTasks'
import {
  getChildTasks,
  buildTaskHierarchy,
  getAllDescendantTasks,
  isAncestor,
} from '@/models/task-operations'

// Use confirm dialog
const confirm = useConfirm()

// Use Solid tasks composable for Pod integration
const taskStore = useTaskStore()
const { saveToPod, addTaskAndSave, updateTaskAndSave, removeTaskAndSave } =
  useSolidTasks()

// Compute task hierarchy for rendering
const tasks = computed(() => {
  const rootIds = taskStore.graph.getRootIds()
  return buildTaskHierarchy(rootIds, taskStore)
})

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
  const excludeIds = new Set<string>([selectedTask.value.id])

  // Add all descendants
  const descendants = getAllDescendantTasks(selectedTask.value.id, taskStore)
  for (const desc of descendants) {
    excludeIds.add(desc.id)
  }

  // Get all tasks and filter out excluded ones
  return taskStore.tasks.filter(task => !excludeIds.has(task.id))
})

// New task form
const newTask = reactive<Partial<TaskClass>>({
  name: '',
  description: '',
  status: Status.IN_PROGRESS,
})

// Quick add task
const newTaskName = ref('')

// Add a simple task
async function addQuickTask() {
  if (!newTaskName.value.trim()) return

  const task = new TaskClass({
    id: uuidv4(),
    name: newTaskName.value,
    addedDate: new Date(),
  })

  newTaskName.value = ''

  // Save to Pod (incremental)
  try {
    await addTaskAndSave(task)
  } catch (err) {
    console.error('Failed to save task to Pod:', err)
  }
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
async function createNewTask() {
  if (!newTask.name?.trim()) return

  const task = new TaskClass({
    id: uuidv4(),
    name: newTask.name,
    description: newTask.description,
    addedDate: new Date(),
    startDate: newTask.startDate,
    endDate: newTask.endDate,
    status: newTask.status || Status.IN_PROGRESS,
  })

  closeDrawer()

  // Save to Pod (incremental)
  try {
    await addTaskAndSave(task)
  } catch (err) {
    console.error('Failed to save task to Pod:', err)
  }
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
  return taskStore.taskMap.get(taskId) || null
}

// Add subtask
async function addSubtask(subtaskId: string) {
  if (!selectedTask.value) return

  // Find the task to add as subtask
  const taskToAdd = taskStore.taskMap.get(subtaskId)
  if (!taskToAdd) return

  // Move task to be a child of selected task (use store action to ensure consistency)
  taskStore.moveTask(subtaskId, selectedTask.value.id)

  // Save both parent and child (incremental)
  try {
    await updateTaskAndSave(selectedTask.value)
    await updateTaskAndSave(taskToAdd)
  } catch (error) {
    console.error('Failed to save subtask relationship to Pod:', error)
  }
}

// Remove subtask from parent task
const removeSubtask = async (subtaskId: string) => {
  if (!selectedTask.value) return

  const subtask = taskStore.taskMap.get(subtaskId)
  if (!subtask) return

  // Remove the subtask from the currently selected task (parent)
  taskStore.moveTask(subtaskId, undefined)

  // Save both parent and child (incremental)
  try {
    await updateTaskAndSave(selectedTask.value)
    await updateTaskAndSave(subtask)
  } catch (error) {
    console.error('Failed to save subtask removal to Pod:', error)
  }
}

// Find and delete task
async function deleteTask(taskId: string) {
  const task = taskStore.taskMap.get(taskId)
  if (!task) return

  confirm.require({
    message: 'Do you want to delete this task and all its subtasks?',
    header: 'Confirm',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await removeTaskAndSave(taskId)
        // If deleted task is currently selected, clear selection
        if (selectedTask.value?.id === taskId) {
          selectedTask.value = null
        }
      } catch (error) {
        console.error('Failed to delete task from Pod:', error)
      }
    },
  })
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
    accept: async () => {
      const taskToDelete = selectedTask.value!

      // Delete from Pod and local state
      try {
        await removeTaskAndSave(taskToDelete.id)
        closeDrawer()
      } catch (err) {
        console.error('Failed to delete task:', err)
      }
    },
  })
}

// Save task changes
async function saveTask() {
  if (!selectedTask.value) return

  // Save to Pod (incremental)
  try {
    await updateTaskAndSave(selectedTask.value)
    // Optional: close drawer after successful save
    closeDrawer()
  } catch (err) {
    console.error('Failed to save task to Pod:', err)
    // Keep drawer open on error so user can retry
  }
}

// Handle drag end event
async function onDragEnd() {
  // Update parent-child relationships after drag end
  updateTaskRelationships()

  // Save all affected tasks to Pod after drag operation
  try {
    await saveToPod()
  } catch (error) {
    console.error('Failed to save drag operation to Pod:', error)
  }
}

// Update all task parent-child relationships
function updateTaskRelationships() {
  // This function needs to update the graph based on the current task hierarchy
  // Since we're using draggable with v-model="tasks", Vue manages the ordering
  // We need to rebuild parent-child relationships from the rendered tree

  // Get the current hierarchy from the rendered tasks
  const updateRelationships = (
    taskList: TaskClass[],
    parentId: string | undefined,
  ) => {
    for (let index = 0; index < taskList.length; index++) {
      const task = taskList[index]
      const oldParentId = taskStore.graph.getParentId(task.id)

      // Only update if parent changed
      if (oldParentId !== parentId) {
        taskStore.moveTask(task.id, parentId)
      }

      // Recursively update children
      const children = getChildTasks(task.id, taskStore)
      if (children.length > 0) {
        updateRelationships(children, task.id)
      }
    }
  }

  const rootIds = taskStore.graph.getRootIds()
  const rootTasks = rootIds
    .map(id => taskStore.taskMap.get(id))
    .filter((t): t is TaskClass => !!t)
  updateRelationships(rootTasks, undefined)
}

// Tasks are automatically loaded by useSolidTasks composable
// when user logs in. The composable watches for authentication changes.
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
