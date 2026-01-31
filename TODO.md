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

## Mid priority -- can do these things in the meantime

- [ ] Prefixes not exist in the Turtle file.

## Low priority -- do these only after finishing the above

- [x] Fix keeping log-in status
- [ ] Optimize performance of update
- [ ] Optimize performance of fetching (caching)
- [ ] Optimize performance of loading into store
- [ ] Optimize data structure in Pod
- [ ] Use TypeIndex?
- [ ] Local data backend
