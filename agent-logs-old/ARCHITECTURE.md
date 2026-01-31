# Task Storage and Sync Architecture (Concise)

## Overview

Tasks store relationships as IDs (`parentId`, `childIds`). The graph is a derived index for fast lookups. Soukai persists relationships via `subTaskUrls`/`parentTaskUrl`.

## Key pieces

### TaskClass ([src/types/task.ts](src/types/task.ts))

- Data + relationship IDs.
- `getParentId()` / `getChildrenIds()` read local fields.

### TaskGraph ([src/utils/task-graph.ts](src/utils/task-graph.ts))

- Derived from TaskClass data.
- Fast queries: `getRootIds()`, `isAncestor()`, `getAllDescendantIds()`.

### Store ([src/stores/tasks.ts](src/stores/tasks.ts))

- Source of truth for mutations.
- `moveTask()`, `addSubTask()`, `removeTaskClass()` keep IDs and graph in sync.

### Adapter ([src/utils/task-graph-adapter.ts](src/utils/task-graph-adapter.ts))

- Convenience helpers for components: `getChildTasks()`, `buildTaskHierarchy()`.

### Solid service ([src/utils/solid-service.ts](src/utils/solid-service.ts))

- Load all tasks, set IDs, derive graph.
- Save all tasks (relationships stored as IDs in `subTaskUrls`/`parentTaskUrl`).

## Data flow

1. Load from Pod → TaskClass (IDs) → TaskGraph derived → Store
2. UI edits via store actions → IDs updated → Save all tasks
   store.moveTask(childId, undefined) // Remove from parent

````

### For rendering hierarchies:
```typescript
// Use the adapter to build hierarchical structure
const tasks = buildTaskHierarchy(rootIds, store)
// Now tasks[i].subTasks contains children for rendering
````

## Benefits

1. **No Circular References** - Tasks don't reference each other directly
2. **Clean Serialization** - Just IDs to serialize, not object graphs
3. **Better RDF Mapping** - Direct mapping to RDF relationships
4. **Improved Reactivity** - No proxy/reactivity conflicts
5. **Easier to Sync** - Graph state is independent of task data
6. **Scalability** - Efficient lookups and traversals through the graph
7. **Type Safety** - Clear separation of concerns
8. **Testability** - TaskGraph can be unit tested independently

## Testing the Changes

The build succeeds with no TypeScript errors. The system should:

- ✅ Load tasks from Solid Pod with relationships intact
- ✅ Display task hierarchies correctly
- ✅ Handle adding/removing subtasks
- ✅ Properly sync changes back to Pod
- ✅ Support dragging and reordering tasks
- ✅ Maintain backward compatibility with existing components

## Future Improvements

1. **Caching Strategy** - Cache graph structure alongside tasks
2. **Pagination** - Load large task sets incrementally
3. **Conflict Resolution** - Handle merge conflicts when syncing
4. **Subscriptions** - Real-time updates for collaborative editing
5. **Advanced Queries** - Filter/sort by complex relationships
