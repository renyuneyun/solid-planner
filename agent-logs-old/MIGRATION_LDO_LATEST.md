# LDO Migration to Latest Alpha Version

## Summary

This document describes the migration of the solid-planner project from the legacy `ldo` package to the latest alpha versions of the new LDO ecosystem (`@ldo/ldo`, `@ldo/solid`, `@ldo/connected-solid`).

## Package Updates

### Removed
- `ldo` ^1.0.3 - Legacy LDO package (replaced by scoped packages)

### Updated/Added
- `@ldo/ldo` ^1.0.0-alpha.32 - Core LDO package with shape types
- `@ldo/solid` ^1.0.0-alpha.1 - Solid-specific LDO utilities
- `@ldo/connected-solid` ^1.0.0-alpha.32 - High-level Solid + LDO integration

## Key Changes

### 1. Import Updates

#### ShapeType Imports
**Before:**
```typescript
import { ShapeType } from "ldo";
```

**After:**
```typescript
import { ShapeType } from "@ldo/ldo";
```

#### Dataset Creation
**Before:**
```typescript
import { parseRdf } from 'ldo';

const ldoDataset = await parseRdf(text, {
  baseIRI: URL_EX,
});
```

**After:**
```typescript
import { createSolidLdoDataset } from "@ldo/connected-solid";

const ldoDataset = createSolidLdoDataset();
ldoDataset.setContext("solid", { fetch: authFetch });

const resource = ldoDataset.getResource(taskResourceUrl);
const readResult = await resource.read();
if (readResult.isError) {
  throw new Error(`Failed to read resource: ${readResult.type}`);
}
```

### 2. API Changes

#### Resource Reading Pattern
The new LDO Solid API uses a resource-based pattern for interacting with Solid Pods:

```typescript
// Get a resource
const resource = ldoDataset.getResource("https://pod.example.com/tasks.ttl");

// Read the resource
const readResult = await resource.read();
if (!readResult.isError) {
  // Data is now loaded into the dataset
  const tasks = ldoDataset
    .usingType(TaskShapeType)
    .matchSubject(RDF.type, NS_SP('Task'));
  
  // Convert LdSet to array
  const tasksArray = Array.from(tasks);
}
```

#### Result Handling
Results now follow a consistent pattern with `isError` flag:

```typescript
const readResult = await resource.read();
if (readResult.isError) {
  // Handle error - readResult.type contains error information
  throw new Error(`Operation failed: ${readResult.type}`);
} else {
  // Success - the resource has been read
  // For data resources, the dataset is automatically updated
}
```

### 3. File Structure

All generated LDO files remain the same:

```
src/ldo/
├── task.context.ts        # JSON-LD context for task shape
├── task.schema.ts         # ShEx schema for task shape
├── task.shapeTypes.ts     # ShapeType definition (uses @ldo/ldo)
├── task.typings.ts        # TypeScript interface for Task
├── foafProfile.context.ts # JSON-LD context for foafProfile shape
├── foafProfile.schema.ts  # ShEx schema for foafProfile shape
├── foafProfile.shapeTypes.ts # ShapeType definition (uses @ldo/ldo)
└── foafProfile.typings.ts # TypeScript interface for FoafProfile
```

## Modified Files

### `/src/utils/queries.ts`
- Updated `fetchTasks()` to use `createSolidLdoDataset()`
- Uses new resource-based API with `.read()` for fetching
- Converts `LdSet` result to array with `Array.from()`
- Proper error handling with `readResult.isError`

### `/src/ldo/task.shapeTypes.ts`
- Updated import: `"ldo"` → `"@ldo/ldo"`
- ShapeType definition structure unchanged

### `/src/ldo/foafProfile.shapeTypes.ts`
- Updated import: `"ldo"` → `"@ldo/ldo"`
- ShapeType definition structure unchanged

### `/src/utils/typing.ts`
- Added missing import for `Task` type from `@/ldo/task.typings`

### `/src/utils/rdf-helpers.ts`
- Marked `saveTask()` as deprecated
- Function needs refactoring to use new LDO Solid API
- Placeholder implementation throws error directing to use `@ldo/connected-solid`

### `/package.json`
- Removed legacy `ldo` package
- Verified modern `@ldo/*` packages are installed

## Migration Guide for New Features

### Reading Tasks from Solid Pod

```typescript
import { createSolidLdoDataset } from "@ldo/connected-solid";
import { TaskShapeType } from '@/ldo/task.shapeTypes';
import { Task } from '@/ldo/task.typings';
import { RDF } from '@inrupt/vocab-common-rdf';
import { NS_SP } from '@/constants/ns';

export async function fetchTasks(
  podRootUri: string,
  authFetch: typeof fetch
): Promise<Task[]> {
  const taskResourceUrl = `${withTrailingSlash(podRootUri)}planner/tasks.ttl`;

  const ldoDataset = createSolidLdoDataset();
  ldoDataset.setContext("solid", { fetch: authFetch });

  const resource = ldoDataset.getResource(taskResourceUrl);
  const readResult = await resource.read();

  if (readResult.isError) {
    throw new Error(`Failed to read tasks: ${readResult.type}`);
  }

  // Query tasks using shape type
  const tasksSet = ldoDataset
    .usingType(TaskShapeType)
    .matchSubject(RDF.type, NS_SP('Task'));

  return Array.from(tasksSet) as Task[];
}
```

### Creating/Updating Tasks (Pattern for Future Implementation)

The new API supports transactions for updating data:

```typescript
const transaction = ldoDataset.startTransaction();
const task = transaction
  .usingType(TaskShapeType)
  .write(resource)
  .fromSubject("https://example.com/task/1");

task.title = "Updated Title";
task.description = "Updated description";

const result = await transaction.commitToRemote();
```

## Notes

- All shape files (`task.shex`, `foafProfile.shex`) remain compatible
- The CLI build command (`npm run build:ldo`) still generates the same structure
- The `@ldo/connected-solid` package provides high-level APIs for Solid Pod integration
- `@ldo/ldo` provides core LDO functionality and ShapeType definitions
- `@ldo/solid` provides Solid-specific utilities (may be used internally by connected-solid)

## Testing Recommendations

1. Test reading tasks from a Solid Pod using the new `fetchTasks()` implementation
2. Verify that tasks are correctly parsed using the `TaskShapeType`
3. Test error handling for missing/inaccessible resources
4. Verify type safety with Task objects in components and stores
5. Test the new API with various Solid servers (PodSpaces, Inrupt pods, etc.)

## Future Work

1. Implement `saveTask()` using the new transaction-based API
2. Implement task creation using `resource.createAndOverwrite()`
3. Add support for real-time updates using WebSocket subscriptions
4. Migrate from `@inrupt/solid-client` to LDO for all Pod interactions
5. Add FoafProfile integration for user information

## References

- [LDO for Solid Guide](https://ldo.js.org/latest/guides/solid/)
- [LDO GitHub Repository](https://github.com/o-development/ldo)
- [LDO API Documentation](https://ldo.js.org/latest/api/)
