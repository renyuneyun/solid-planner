# RDF Vocabulary

Tasks are stored as `schema:Action` resources on the Solid Pod.

Context prefix: `schema:` → `https://schema.org/`

| TaskClass field | RDF predicate | Notes |
|---|---|---|
| `name` | `schema:name` | Required |
| `description` | `schema:description` | |
| (internal) | `schema:priority` | Numeric; currently unused in scoring |
| `addedDate` | `schema:dateCreated` | |
| `startDate` | `schema:startTime` | |
| `endDate` | `schema:endTime` | |
| `status` | `schema:actionStatus` | String: `InProgress`, `Completed`, `Ignored` |
| `childIds` | `schema:hasPart` | Array of task URLs |
| `parentId` | `schema:partOf` | Single task URL |

Soukai model file: `src/storage/soukai/Task.model.ts`.

History tracking (`static history = true`) and tombstones (`static tombstone = true`) are enabled on the model for CRDT-like conflict support.

## Storage location

Tasks are stored in the container: `<podRoot>/planner/tasks/`

The pod root is discovered via `findStorage(webId)` from `@renyuneyun/solid-helper`.
