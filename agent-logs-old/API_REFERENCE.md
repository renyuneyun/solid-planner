# Task API Reference (Concise)

## Store

```typescript
const store = useTaskStore()

store.taskMap // Map<id, TaskClass>
store.rootTasks // Root tasks (computed)
store.graph // Derived TaskGraph

store.addTaskClass(task)
store.addSubTask(parentId, childTask)
store.moveTask(taskId, newParentId)
store.removeTaskClass(taskId)
store.updateTaskClass(task)
store.loadTaskClasses(tasks, graph)
store.clearTasks()
```

## TaskClass

```typescript
task.id
task.fullId
task.name
task.description
task.addedDate
task.startDate
task.endDate
task.status
task.parentId
task.childIds
task.getParentId()
task.getChildrenIds()
```

## TaskGraph (derived index)

```typescript
store.graph.getRootIds()
store.graph.getAllDescendantIds(taskId)
store.graph.isAncestor(ancestorId, taskId)
```

## Adapter

```typescript
getChildTasks(taskId, store)
getParentTask(taskId, store)
getAllDescendantTasks(taskId, store)
getAncestorTaskIds(taskId, store)
buildTaskHierarchy(rootIds, store) // adds .subTasks for rendering
```

## Common usage

```typescript
const rootIds = store.graph.getRootIds()
const tasks = buildTaskHierarchy(rootIds, store)

store.moveTask(childId, parentId)
```

    return

}

store.moveTask(taskId, newParentId)
}

````

### Pattern 3: Add Subtask (with validation)
```typescript
async function addSubtaskToTask(parentId: string, newSubtask: TaskClass) {
  // Ensure new subtask won't create a cycle
  if (store.graph.isAncestor(newSubtask.id, parentId)) {
    console.error('Would create circular dependency')
    return
  }

  // Add to store
  store.addSubTask(parentId, newSubtask)

  // Save to Pod
  await updateTaskAndSave(newSubtask)
}
````

### Pattern 4: Get All Tasks Affected by Change

```typescript
function getAffectedTaskIds(taskId: string): string[] {
  const affected = store.graph.getAllDescendantIds(taskId)
  const parentId = store.graph.getParentId(taskId)
  if (parentId) {
    affected.push(parentId)
  }
  return affected
}
```

### Pattern 5: Check if Task Can be a Subtask

```typescript
function canAddAsSubtask(parentId: string, subtaskId: string): boolean {
  // Can't add a task as its own ancestor
  if (parentId === subtaskId) return false

  // Can't create circular reference
  if (store.graph.isAncestor(subtaskId, parentId)) return false

  return true
}
```

## Best Practices

1. **Always use the store** - Don't manipulate taskMap or graph directly
2. **Use adapters** - They handle the ID-to-object mapping for you
3. **Validate relationships** - Check for cycles before adding relationships
4. **Load with graph** - Always call `loadTaskClasses(tasks, graph)` with the graph
5. **Save after changes** - Use `updateTaskAndSave()` from composable to persist
6. **Check parents before removing** - Remember removing a task removes all descendants

## Type Definitions

```typescript
// Core types
type TaskId = string
type ParentTaskId = string | undefined // undefined = root task

// Graph operations always use IDs
type GraphOperation =
  | 'setParent'
  | 'addChild'
  | 'removeChild'
  | 'removeTaskAndDescendants'

// Task hierarchy for rendering
interface TaskWithChildren extends TaskClass {
  subTasks: TaskWithChildren[]
}
```
