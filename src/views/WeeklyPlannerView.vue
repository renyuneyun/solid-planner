<template>
  <section class="weekly-planner-view">
    <div class="app-container">
      <h1 class="view-title">Weekly Planner</h1>

      <!-- Focus Now Section -->
      <div class="focus-section">
        <h2 class="section-title">Focus Now</h2>
        <p class="section-description">
          {{
            focusNowTasks.length === 0
              ? 'No urgent tasks - great job!'
              : 'These tasks need your immediate attention'
          }}
        </p>
        <div v-if="focusNowDisplayTasks.length > 0" class="task-list">
          <TaskItemWithContext
            v-for="task in focusNowDisplayTasks"
            :key="task.id"
            :task="task"
            :show-parent="true"
            :priority="true"
            :tasks-in-group="focusNowTasks"
            @select="openTask"
          />
        </div>
      </div>

      <!-- This Week Section -->
      <div class="week-section">
        <h2 class="section-title">This Week</h2>
        <p class="section-description">
          {{
            thisWeekTasks.length === 0
              ? 'No other tasks this week'
              : 'Other tasks to complete this week'
          }}
        </p>
        <div v-if="thisWeekDisplayTasks.length > 0" class="task-list">
          <TaskItemWithContext
            v-for="task in thisWeekDisplayTasks"
            :key="task.id"
            :task="task"
            :show-parent="true"
            :priority="false"
            :tasks-in-group="thisWeekTasks"
            @select="openTask"
          />
        </div>
      </div>

      <!-- Upcoming Weeks Section -->
      <div v-if="upcomingWeeksDisplay.length > 0" class="upcoming-section">
        <h2 class="section-title">Upcoming</h2>
        <p class="section-description">Tasks for future weeks</p>

        <div
          v-for="weekGroup in upcomingWeeksDisplay"
          :key="weekGroup.week"
          class="week-group"
        >
          <h3 class="week-subtitle">
            {{ getWeekLabel(weekGroup.week) }}
            <span class="week-dates"
              >({{ formatWeekDateRange(weekGroup.week) }})</span
            >
          </h3>
          <div class="task-list">
            <TaskItemWithContext
              v-for="task in weekGroup.displayTasks"
              :key="task.id"
              :task="task"
              :show-parent="true"
              :priority="false"
              :tasks-in-group="weekGroup.tasks"
              @select="openTask"
            />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="
          focusNowDisplayTasks.length === 0 &&
          thisWeekDisplayTasks.length === 0 &&
          upcomingWeeksDisplay.length === 0
        "
        class="empty-state"
      >
        <p>No tasks for this week. Create some tasks to get started!</p>
        <router-link to="/all-tasks" class="btn-primary" title="Go to all tasks"
          >Go to All Tasks</router-link
        >
      </div>
    </div>

    <!-- Task Edit Drawer -->
    <div
      class="detail-overlay"
      :class="{ visible: isDrawerOpen }"
      @click="closeDrawer"
    ></div>

    <div class="task-drawer" :class="{ visible: isDrawerOpen }">
      <div class="drawer-header">
        <h2>Task Details</h2>
        <Button
          icon="pi pi-times"
          text
          title="Close"
          @click="closeDrawer"
          class="close-btn"
        />
      </div>

      <div v-if="selectedTask">
        <TaskForm v-model="selectedTask" class="drawer-form">
          <template #actions>
            <div class="actions">
              <Button
                label="Save"
                icon="pi pi-check"
                title="Save task"
                @click="saveTask"
              />
              <Button
                label="Cancel"
                icon="pi pi-times"
                text
                title="Cancel"
                @click="closeDrawer"
              />
            </div>
          </template>
        </TaskForm>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import {
  getWeeklyRelevantTasks,
  categorizeTasksByFocus,
  getUpcomingTasksByWeek,
  getWeekLabel,
  getWeekDateRange,
  getTasksToHideInGroup,
} from '@/utils/priority'
import TaskItemWithContext from '@/components/TaskItemWithContext.vue'
import TaskForm from '@/components/TaskForm.vue'
import type { TaskClass } from '@/models/TaskClass'
import { useLocalFirstTasks } from '@/composables/useLocalFirstTasks'

const store = useTaskStore()
const taskOperations = ref<ReturnType<typeof useLocalFirstTasks> | null>(null)
const selectedTask = ref<TaskClass | null>(null)

const isDrawerOpen = computed(() => selectedTask.value !== null)

onMounted(() => {
  taskOperations.value = useLocalFirstTasks()
})

// Get all tasks and graph
const allTasksArray = computed(
  () => Array.from(store.taskMap.values()) as TaskClass[],
)
const allTasksMap = computed(() => store.taskMap)
const graph = computed(() => store.graph)

// Get weekly relevant tasks
const weeklyTasks = computed(() => {
  return getWeeklyRelevantTasks(allTasksArray.value)
})

// Categorize tasks by focus
const categorizedTasks = computed(() => {
  return categorizeTasksByFocus(
    weeklyTasks.value,
    graph.value,
    allTasksMap.value,
  )
})

const focusNowTasks = computed(() => categorizedTasks.value.focusNow)
const thisWeekTasks = computed(() => categorizedTasks.value.thisWeek)

const focusNowDisplayTasks = computed(() => {
  const hidden = getTasksToHideInGroup(focusNowTasks.value, graph.value)
  return focusNowTasks.value.filter(task => !hidden.has(task.id))
})

const thisWeekDisplayTasks = computed(() => {
  const hidden = getTasksToHideInGroup(thisWeekTasks.value, graph.value)
  return thisWeekTasks.value.filter(task => !hidden.has(task.id))
})

// Get upcoming weeks
const upcomingWeeks = computed(() => {
  return getUpcomingTasksByWeek(allTasksArray.value, 4)
})

const upcomingWeeksDisplay = computed(() => {
  return upcomingWeeks.value
    .map(group => {
      const hidden = getTasksToHideInGroup(group.tasks, graph.value)
      return {
        ...group,
        displayTasks: group.tasks.filter(task => !hidden.has(task.id)),
      }
    })
    .filter(group => group.displayTasks.length > 0)
})

// Format week date range for display
function formatWeekDateRange(weekNum: number): string {
  const { start, end } = getWeekDateRange(weekNum)
  return (
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(start) +
    ' - ' +
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(end)
  )
}

function openTask(task: TaskClass) {
  selectedTask.value = task
}

async function saveTask() {
  if (!selectedTask.value || !taskOperations.value) return
  try {
    await taskOperations.value.updateTask(selectedTask.value)
    closeDrawer()
  } catch (err) {
    console.error('Failed to save task:', err)
  }
}

function closeDrawer() {
  selectedTask.value = null
}
</script>

<style scoped>
.weekly-planner-view {
  padding: 2rem 0;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.view-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 2rem;
  color: #2c3e50;
}

.focus-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: #fff3cd;
  border-left: 4px solid #ffc107;
  border-radius: 8px;
}

.week-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-left: 4px solid #6c757d;
  border-radius: 8px;
}

.upcoming-section {
  margin-bottom: 3rem;
  padding: 1.5rem;
  background: #f0f8ff;
  border-left: 4px solid #17a2b8;
  border-radius: 8px;
}

.week-group {
  margin-bottom: 2rem;
  padding-left: 1rem;
  border-left: 3px solid #cce5ff;
}

.week-group:last-child {
  margin-bottom: 0;
}

.week-subtitle {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #17a2b8;
}

.week-dates {
  font-size: 0.85rem;
  font-weight: 400;
  color: #666;
  margin-left: 0.5rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.section-description {
  font-size: 0.9rem;
  color: #6c757d;
  margin-bottom: 1rem;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Drawer styles */
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
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
}

.empty-state p {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.btn-primary {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #0056b3;
}
</style>
