## Bugs -- fix these if possible unless other tasks are specified

## High priority -- do these things first, whenever possible

- [x] Support the core feature -- automatic proprity and task filtering
  - [x] Automatic proprity calculation (for root tasks)
  - [x] Create a new page/tab for showing only relevant / important tasks (for the weekly planner); make it the default page/tab
  - [ ] Support priority calculation considering subtasks as well
  - [ ] Put more urgent subtasks earlier (while parent tasks later? how to design the UI?)
- [ ] Export and import feature -- both for supporting migration, and for disaster recovery
  - [ ] Also add automatic backup feature inside the Pod

## Mid priority -- can do these things in the meantime

- [ ] Have a "add task" field in Weekly Planner
- [x] Change the color of different task status, to be both good-looking and differentiating enough
- [ ] Don't draw two "syncing" icons on the UI during sync
- [ ] Check tests capture all important parts
- [x] Have a static ClientId
- [ ] Use NLP tools to support a "magic add task" feature, to parse from user's (semi-)natural language description of tasks to create new tasks
- [ ] Have a configuration page; configs are stored to local and Pod both; if conflict (not normal updates) exists, Pod wins
  - [ ] The conflict resolution strategy
  - [ ] How long a postponing should be effective
  - [ ] Storage location (grey-out; will be made explicit after better understanding about Type Index or Interop)
- [ ] Convert to calendar (.ics) so it can be retrieved from calendar software
  - [ ] Maybe appropriate permission is needed? Might be tricky for Solid's current permission model and calendar apps
    - [ ] Maybe deploy a companion service that exposes a more conventional authentication mechanism for calendar apps to use

## Low priority -- do these only after finishing the above

- [ ] CORS error for static built site when fetching from Solid Pod?
  - [ ] I've only seen this once. Not sure if this is actually a bug in Solid Planner or somewhere else.
- [ ] Prefixes not exist in the Turtle file.
  - Not supported by Soukai yet. Postpone.
- [ ] Optimize performance of update
- [ ] Optimize performance of fetching (caching)
- [ ] Optimize performance of loading into store
- [ ] Optimize data structure in Pod
- [ ] Use TypeIndex?
- [ ] Consider PWA
- [ ] Compile to Android

## Recurring

- [ ] Write tests
- [ ] Verify if all logic is necessary, and clean up unnecessary ones
- [ ] Improve interfaces / APIs / exported functions for maintainability
- [ ] Extract common interfaces and functions, and reduce repeated code
- [ ] Improve other types of code maintainability

## Done

- [x] Use Solid data / resource to fetch tasks from
- [x] Support editing the Solid data
- [x] Fixed RDF serialization issues (undefined properties causing invalid RDF)
  - [x] Fixed data loading issues (proxy/reactivity conflicts)
  - [x] Subtasks are not right. Behaviour complicated. See subsection below
- [x] Migrate to Soukai as storage library
- [x] Do not directly reference TaskClass in TaskClass, to avoid complexity
  - [x] Instead, create a `graph` object with parent and child nodes, referenced by IDs
  - [x] TaskClass may also refer to parent and child using the IDs? Or don't do that completely?
- [x] Provide testing suits
  - [x] Unit tests
  - [x] Other tests with mock components
- [x] Fix keeping log-in status
- [x] Enable local storage and CRDT-based sync
  - [x] Implemented IndexedDB local storage
  - [x] Implemented sync service with last-write-wins conflict resolution
  - [x] Enabled Soukai history tracking and tombstones
  - [x] Added sync status indicators in UI
  - [x] Added design notes as `CRDT_SYNC.md`
- [x] Local data backend
- [x] Synchronization between local and remote (Solid), and make it local-first
  - [x] Check if CRDT is a good way, possibly enabled by Soukai
- [x] Change interface -- for automatic-local-first-with-sync, don't call it useSolidTasks
  - Instead, maybe call it use local-first tasks
  - Maybe have useSolidTasks as interface to be called by it; similarly, for local tasks (maybe call it indexed db task in fact? we may want alternative local storage, if it's not browser, right? e.g., android?)
  - This may provide better maintainability, if we want to expand the storage backend
- [x] When app loaded, and log-in, it won't automatically sync from Solid Pod, until a new task is added.
- [x] After syncing, the page won't automatically reload and see the fetched tasks.
- [x] Fix vercel deployment -- maybe only needing vercel.json
- [x] Deploy as static page
- [x] At log-out, allow the user to choose to keep the local data or clean them. This would allow switching user without unexpectedly touching others' data (tasks).
- [x] Update solid-helper-vue to v0.3.1, to use the new wrapper for login management
- [x] On Weekly Plan page, don't immediately remove newly-finished tasks (by clicking the checkbox, e.g.)m but wait for a little while (and draw an animation / fade in the meantime), to allow users to revert changes if that happens to be the case
- [x] Add a "postpone" button to Weekly Plan page, to allow getting other tasks higher up in the queue (but does not actually change the end date of the task). If all tasks in "focus now" are postponed, move other tasks up (? needs further thinking for edge cases, but idea is this)

### Fixed Bugs

- [x] After editing a task, the old entry and a new entry both exists (with Solid Login)
- [x] After creating a task, it does not immediately appear on the UI (with Solid Login)
- [x] On Weekly Planning page, after clicking "complete" / checkbox, the side panel also appears
- [x] On Weekly Plan page, after clicking checkbox, the task disappears, but comes back soon after

## Other

Consult the `Design.md` file for project's grand designs and future plans.
