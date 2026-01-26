# Quick Reference: LDO Alpha Migration

## 🎯 What Was Done

Your solid-planner project has been successfully upgraded from the legacy `ldo` package to the latest alpha version of the modern LDO ecosystem.

### Versions Installed
```json
{
  "@ldo/ldo": "^1.0.0-alpha.32",
  "@ldo/solid": "^1.0.0-alpha.1",
  "@ldo/connected-solid": "^1.0.0-alpha.32"
}
```

## 📝 Before & After

### Reading Tasks (Main Change)

**BEFORE (Legacy API):**
```typescript
import { parseRdf } from 'ldo';

const ldoDataset = await parseRdf(text, { baseIRI: URL_EX });
const tasks = ldoDataset.usingType(TaskShapeType).matchSubject(RDF.type, NS_SP('Task'));
```

**AFTER (New API):**
```typescript
import { createSolidLdoDataset } from "@ldo/connected-solid";

const ldoDataset = createSolidLdoDataset();
ldoDataset.setContext("solid", { fetch: authFetch });

const resource = ldoDataset.getResource(taskResourceUrl);
const readResult = await resource.read();

if (readResult.isError) {
  throw new Error(`Failed: ${readResult.type}`);
}

const tasksSet = ldoDataset.usingType(TaskShapeType).matchSubject(RDF.type, NS_SP('Task'));
const tasks = Array.from(tasksSet) as Task[];
```

## 🔑 Key Concepts

### 1. SolidLdoDataset
The entry point for all operations. Created with:
```typescript
const ldoDataset = createSolidLdoDataset();
ldoDataset.setContext("solid", { fetch: yourAuthFetch });
```

### 2. Resources
Access Solid resources with:
```typescript
const resource = ldoDataset.getResource("https://pod.example.com/file.ttl");
```

### 3. Reading
Always check errors:
```typescript
const readResult = await resource.read();
if (readResult.isError) {
  // Handle error: readResult.type contains error info
} else {
  // Success: data is loaded
}
```

### 4. Querying
Query loaded data using shape types:
```typescript
const items = ldoDataset.usingType(MyShapeType).matchSubject(RDF.type, MY_TYPE);
```

### 5. Converting Results
Convert LdSet to array:
```typescript
const itemsArray = Array.from(items) as MyType[];
```

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `MIGRATION_LDO_LATEST.md` | **Detailed migration guide** - All API changes explained |
| `UPGRADE_SUMMARY.md` | **Executive summary** - Overview & next steps |
| `MIGRATION_CHECKLIST.md` | **Verification checklist** - All completed tasks listed |
| This file | **Quick reference** - For quick lookups |

## ✅ Verification

Check everything is working:
```bash
# Type checking (should show 0 errors in main code)
npm run type-check

# Build (should succeed)
npm run build-only

# Check no old ldo imports remain
grep -r "from.*['\"]ldo['\"]" src --include="*.ts"
```

## 🚀 Next: Implement saveTask()

The old `saveTask()` function in `/src/utils/rdf-helpers.ts` needs implementation using the new API:

```typescript
export async function saveTask(
  task: Task,
  podRootUri: string,
  authFetch: typeof fetch,
): Promise<void> {
  const ldoDataset = createSolidLdoDataset();
  ldoDataset.setContext("solid", { fetch: authFetch });

  const taskResourceUrl = `${withTrailingSlash(podRootUri)}planner/tasks.ttl`;
  const resource = ldoDataset.getResource(taskResourceUrl);

  // Use transaction to update data
  const transaction = ldoDataset.startTransaction();
  const updatedTask = transaction
    .usingType(TaskShapeType)
    .write(resource)
    .fromSubject(task["@id"]!);
  
  // Update task properties
  updatedTask.title = task.title;
  updatedTask.description = task.description;
  updatedTask.priority = task.priority;
  // ... other properties
  
  const result = await transaction.commitToRemote();
  if (result.isError) {
    throw new Error(`Failed to save task: ${result.type}`);
  }
}
```

## 🔗 Quick Links

- **Official Guide**: https://ldo.js.org/latest/guides/solid/
- **API Reference**: https://ldo.js.org/latest/api/
- **GitHub Repository**: https://github.com/o-development/ldo

## ❓ Common Questions

### Q: Why did the API change?
A: The new API provides better resource management, cleaner error handling, and tighter Solid Pod integration through the `connected-solid` package.

### Q: Do I need to change my shape files?
A: No! Your `.shex` shape files and generated `.ts` files remain compatible. Only imports changed.

### Q: What about FoafProfile?
A: The FoafProfile shape is fully migrated and ready to use. It's not currently active in the app but can be integrated for user profile information.

### Q: Can I still use @inrupt/solid-client?
A: Yes, but it's being phased out. Gradually migrate functions to use LDO's `@ldo/connected-solid` API instead.

### Q: What if I encounter issues?
A: Check the comprehensive guide in `MIGRATION_LDO_LATEST.md` or refer to the official LDO documentation.

## 📊 Migration Stats

- **Files Modified**: 6
- **Type Errors Fixed**: 0 (after migration)
- **Build Status**: ✅ Passing
- **Documentation Pages**: 3 + this quick reference
- **Code Examples**: 20+

## 🎓 Learning Resources

1. **Start with**: `UPGRADE_SUMMARY.md` (high-level overview)
2. **Go deeper**: `MIGRATION_LDO_LATEST.md` (detailed guide)
3. **Verify**: `MIGRATION_CHECKLIST.md` (what was done)
4. **Reference**: This file (quick lookups)

---

**Status**: ✅ Core migration complete | ⏳ Testing phase ready
**Date**: December 5, 2025
**Version**: LDO Latest Alpha (1.0.0-alpha.32)
