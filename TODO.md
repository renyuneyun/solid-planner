## High priority -- do these things first, whenever possible

- [x] Use Solid data / resource to fetch tasks from
- [x] Support editing the Solid data
- [x] Fixed RDF serialization issues (undefined properties causing invalid RDF)
  - [x] Fixed data loading issues (proxy/reactivity conflicts)
  - [x] Subtasks are not right. Behaviour complicated. See subsection below
- [x] Migrate to Soukai as storage library
- [x] Do not directly reference TaskClass in TaskClass, to avoid complexity
  - [x] Instead, create a `graph` object with parent and child nodes, referenced by IDs
  - [x] TaskClass may also refer to parent and child using the IDs? Or don't do that completely?
- [ ] Change interface -- for automatic-local-first-with-sync, don't call it useSolidTasks
  - Instead, maybe call it use local-first tasks
  - Maybe have useSolidTasks as interface to be called by it; similarly, for local tasks (maybe call it indexed db task in fact? we may want alternative local storage, if it's not browser, right? e.g., android?)
  - This may provide better maintainability, if we want to expand the storage backend

## Mid priority -- can do these things in the meantime

- [ ] Prefixes not exist in the Turtle file.
  - Not supported by Soukai yet. Postpone.
- [x] Provide testing suits
  - [x] Unit tests
  - [x] Other tests with mock components
- [x] Enable local storage and CRDT-based sync
  - [x] Implemented IndexedDB local storage
  - [x] Implemented sync service with last-write-wins conflict resolution
  - [x] Enabled Soukai history tracking and tombstones
  - [x] Added sync status indicators in UI
  - [x] Added design notes as `CRDT_SYNC.md`
- [ ] Don't draw two "syncing" icons on the UI during sync
- [ ] Check tests capture all important parts

## Low priority -- do these only after finishing the above

- [x] Fix keeping log-in status
- [ ] Support the core feature -- automatic proprity and task filtering
  - [ ] Automatic proprity calculation (for root tasks)
  - [ ] Create a new page/tab for showing only relevant / important tasks (for the weekly planner); make it the default page/tab
  - [ ] Support priority calculation considering subtasks as well
  - [ ] Put more urgent subtasks earlier (while parent tasks later? how to design the UI?)
- [ ] Optimize performance of update
- [ ] Optimize performance of fetching (caching)
- [ ] Optimize performance of loading into store
- [ ] Optimize data structure in Pod
- [ ] Use TypeIndex?
- [x] Local data backend
- [x] Synchronization between local and remote (Solid), and make it local-first
  - [x] Check if CRDT is a good way, possibly enabled by Soukai

## Other

Consult the `Design.md` file for project's grand designs and future plans.
