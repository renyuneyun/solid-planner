# API Quick Reference

## Pinia store (`useTaskStore`)

```typescript
const store = useTaskStore()

// State
store.taskMap    // Map<string, TaskClass> — all tasks
store.graph      // TaskGraph — derived relationship index
store.loading    // boolean
store.error      // string | null

// Getters
store.tasks          // TaskClass[] — all tasks as array
store.rootTasks      // TaskClass[] — tasks with no parent
store.sortedTasks    // TaskClass[] — sorted by endDate
store.overdueTasks   // TaskClass[] — past endDate, not completed/ignored

// Actions
store.loadTaskClasses(tasks, graph)     // replace all tasks + graph
store.addTaskClass(task)                // add root task
store.addSubTask(parentId, childTask)   // add task as child of parent
store.moveTask(taskId, newParentId)     // reparent (undefined = make root)
store.removeTaskClass(taskId)           // remove task + all descendants
store.updateTaskClass(task)             // replace task in map
store.clearTasks()                      // empty store
```

## TaskGraph (via `store.graph`)

```typescript
store.graph.getRootIds()                        // string[]
store.graph.getParentId(taskId)                 // string | undefined
store.graph.getChildrenIds(taskId)              // string[]
store.graph.getAllDescendantIds(taskId)          // string[] (includes taskId)
store.graph.isAncestor(ancestorId, taskId)      // boolean
```

## task-operations helpers (`src/models/task-operations.ts`)

```typescript
getChildTasks(taskId, store?)           // TaskClass[]
getParentTask(taskId, store?)           // TaskClass | undefined
getAllDescendantTasks(taskId, store?)    // TaskClass[]
getAncestorTaskIds(taskId, store?)      // string[] — nearest first

// Build nested tree for rendering (adds .subTasks to each node)
buildTaskHierarchy(taskIds, store?)     // TaskWithChildren[]
```

## useLocalFirstTasks composable

```typescript
const {
  isLoading, error, isAuthenticated, isOnline, syncStatus,
  loadTasks, saveTasks,
  addTask, updateTask, removeTask,
  manualSync,
} = useLocalFirstTasks()

await addTask(taskClass)
await updateTask(taskClass)
await removeTask(taskOrId)
await manualSync()
```

## Common patterns

**Build task tree for rendering**
```typescript
const rootIds = store.graph.getRootIds()
const tree = buildTaskHierarchy(rootIds, store) // each node has .subTasks
```

**Guard against circular subtask**
```typescript
function canAddAsSubtask(parentId: string, candidateId: string): boolean {
  if (parentId === candidateId) return false
  return !store.graph.isAncestor(candidateId, parentId)
}
```

**All tasks affected by a change to taskId**
```typescript
const affected = store.graph.getAllDescendantIds(taskId)
const parentId = store.graph.getParentId(taskId)
if (parentId) affected.push(parentId)
```
