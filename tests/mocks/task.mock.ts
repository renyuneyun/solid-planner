import { TaskClass, Status } from '@/models/TaskClass'

/**
 * Factory function to create test tasks with default values
 */
export function createMockTask(
  overrides: Partial<TaskClass> = {},
): TaskClass {
  return new TaskClass({
    id: `task-${Date.now()}-${Math.random()}`,
    name: 'Test Task',
    description: 'Test task description',
    addedDate: new Date(),
    status: Status.IN_PROGRESS,
    ...overrides,
  })
}

/**
 * Create a hierarchy of test tasks: parent with children
 */
export function createMockTaskHierarchy() {
  const parent = createMockTask({
    id: 'parent-1',
    name: 'Parent Task',
  })

  const child1 = createMockTask({
    id: 'child-1',
    name: 'Child Task 1',
    parentId: 'parent-1',
  })

  const child2 = createMockTask({
    id: 'child-2',
    name: 'Child Task 2',
    parentId: 'parent-1',
  })

  const grandchild = createMockTask({
    id: 'grandchild-1',
    name: 'Grandchild Task',
    parentId: 'child-1',
  })

  parent.childIds = ['child-1', 'child-2']
  child1.childIds = ['grandchild-1']

  return { parent, child1, child2, grandchild }
}

/**
 * Create multiple independent test tasks
 */
export function createMockTasks(count: number): TaskClass[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({
      id: `task-${i}`,
      name: `Task ${i}`,
    }),
  )
}
