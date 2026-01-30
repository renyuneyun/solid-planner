# Migration from LDO to Soukai

## Summary

Successfully migrated the Solid Planner app from LDO (Linked Data Objects) to Soukai, a more stable and documented RDF library for Solid applications.

## Changes Made

### 1. Dependencies

- **Removed**: `@ldo/connected-solid`, `@ldo/ldo`, `@ldo/solid`, `ldo-cli`, `@shexjs/parser`, `@shexjs/term`, `shex`
- **Added**: `soukai`, `soukai-solid`
- **Removed script**: `build:ldo` from package.json

### 2. New Soukai Model

Created `/src/models/Task.ts`:

- Defined Task model extending `SolidModel`
- Used schema.org vocabulary (Action type)
- Defined all task fields with proper RDF property mappings
- Added type-safe field declarations
- Set up relationships for parent/child tasks

### 3. Updated solid-service.ts

- Replaced LDO dataset with Soukai's SolidEngine
- Implemented CRUD operations using Soukai's Active Record pattern
- Added conversion methods between Soukai Task models and TaskClass
- Simplified resource management (Soukai handles containers automatically)

### 4. Updated useSolidTasks.ts composable

- Changed `loadFromPod()` to use `loadTasksAsTaskClasses()`
- Simplified task operations (no more LDO conversions needed)
- Updated to use `getTaskContainerUrl()` instead of `getTaskResourceUrl()`

### 5. Updated stores/tasks.ts

- Removed LDO Task type completely
- Store now works directly with TaskClass objects
- Simplified state management (single Map instead of dual Maps)
- Removed LDO-specific conversion methods

### 6. Updated types/task.ts

- Removed all LDO-specific methods: `basicFromLdoTask()`, `fillRefsFromMap()`, `toLdoTask()`
- Removed `ldoObj` property
- TaskClass is now self-contained without LDO dependencies

### 7. Updated TaskManager.vue

- Removed all `toLdoTask()` calls
- Changed `addTask()` to `addTaskClass()`
- Changed `updateTask()` to `updateTaskClass()`
- Simplified relationship management (TaskClass handles it internally)

## Benefits of Soukai

1. **Better documentation**: Soukai has comprehensive documentation
2. **Active Record pattern**: More intuitive than LDO's dataset approach
3. **Automatic container management**: No need to manually create resources
4. **TypeScript support**: Better type safety with declared fields
5. **Simpler API**: Cleaner CRUD operations with `.save()`, `.delete()`, etc.
6. **Stable**: More mature than LDO alpha releases

## Breaking Changes

- Old LDO-generated types in `/src/ldo/` directory are now obsolete but kept for reference
- ShEx schemas in `/src/shapes/` are no longer used
- `build:ldo` script removed from package.json

## Data Compatibility

The RDF data format remains compatible:

- Still using schema.org/Action type
- Field mappings preserved (e.g., `schema:name` for title)
- Subtask relationships maintained

## Testing Recommendations

1. Test login/logout flow
2. Test creating new tasks
3. Test editing existing tasks
4. Test subtask relationships
5. Test saving to Pod
6. Test loading from Pod
7. Verify data integrity in Pod (check Turtle files)

## Future Improvements

- Consider using Soukai's built-in relationships more extensively
- Optimize batch operations for large task sets
- Add caching for better performance
- Implement offline support using Soukai's local engines

## Notes

- The `/src/utils/queries.ts` and `/src/utils/typing.ts` files still reference LDO but appear to be unused
- Old LDO types in `/src/ldo/` can be removed once migration is fully validated
- ShEx files in `/src/shapes/` can be archived/removed
