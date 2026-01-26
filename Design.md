# Core Design of SoLiD Planner

This document describes the core design of Solid Planner, a special TODO app that focuses on weekly planning. AI coding agent, please use this as a reference when working. You should follow the design here, unless you believe or find it is not a good choice -- notify me in that case before proceeding.

## Goal and core functions

Solid Planner is a TODO app, but not just a TODO app. Its focus on weekly planning means:

1. The user would create (a lot of) new tasks from time to time, but not do all of them immediately
2. The user may not specify their priority, but just some rough idea on their deadline or when to start (or something alike that is tangible). the app should be able to figure out the best priority for each of them. (The exact algorithm for this can be delayed until a future iteration, but please keep this in mind when designing the data structures / function signatures / interfaces.)
3. There will likely be left-over tasks from previous week. Handle them properly.
4. The app will show the tasks by their priority respective to the current week, rather than cluttering everything together. (This will be done when we are to refine the UI, but keep this in mind.)
5. Tasks will have subtasks. Their relation (in terms of "finished") should be handled properly. The UI display should be taken care of as well, because some subtasks may need to be done more urgently, while some may not be needed until a far future. (Again, if not easy, the UI shall be dealt with later.)
6. Tasks will have dependencies. Their priority should be properly handled.
7. User's plan may change, and situations can change, so tasks can get deprecated/canceled. I would prefer a tombstone mechanism, rather than completely removing them (unless the user explicitly says so).
8. Overflown tasks (tasks not completed by the hard deadline) are not necessarily catastrophe, but they should be prioritized and highlighted. Soft deadlines (e.g. appropriate deadline estimated by the app) shall follow something similar, but less important.

It's usage of SoLid (Social Linked Data) hints the necessity of interoperability in the future. For now, we only need to represent the tasks using RDF. See later for further details.

With the core goals in mind, we have these planned core features:

1. RDF-based data -- we use Solid, so RDF is a natural choice; it also offers extensibility and interoperability, so using that would be ideal as well.
2. Deploy as static page -- this app is simple enough that it shall be deployed as static pages.
3. Offline support -- The user may be using the app offline; appropriate preparation for synchronization is needed. (In the initial versions, this is not necessary.)
4. Friendly UI -- the user will see a minimal UI in most time, illustrating the tasks to focus, and the rest of the tasks in their respective priority.
5. Automatic scheduling -- despite the lack of user-specified deadline or starting time, Solid Planner shall estimate an appropriate time, to prioritize them.
6. I18n -- the UI shall be prepared for i18n.

## Technology stack

Please use these technologies.
This list is not meant to be complete, but as some personal preferences of technologies.

- Vue 3
- Vite for building
- Pinia
- PrimeVue 4 for UI
  - https://primevue.org/
- Appropriate RDF library
  - Prefer LDO (Linked Data Objects)
    - Repo: https://github.com/o-development/ldo
    - Prefer 1.0.0-alpha: https://ldo.js.org/1.0.0-alpha.X/
  - But if LDO is not a good choice, use Soukai
    - Homepage: https://soukai.js.org/
    - Doc: https://soukai.js.org/guide/getting-started/installation.html

## Technical design

You are free to choose most of the architectural and technical designs, but need to obey the following:

- Abstraction of underlying data-handling: either you use LDO or Soukai, you must make an abstraction of the underlying library, because that's easier for migration between different technologies. I guess this is also helpful for Solid-based and local-based storage (and potentially more in the future).
- The UI shall respond fast: when user clicks a button, the UI shall update quickly, even if the Internet is slow. If possible, store that as local values, and wait for Internet sync to complete (or fail, and possibly fallback). I believe there are appropriate libraries for that.

## Additional notes

- I've written part of the code (with the help of AI coding agents). But it's not complete in many ways (e.g. not correctly connected to Solid Pods). Please let me know if you feel they are appropriate or not. (You may also want to refer to the logs of previous agents, under `agent-logs-old/`.)
- Please refer to the `TODO.md` file. Note that it is not necessarily up-to-date or right, especially about the features being implemented. If you find contradictions, prefer the current document.
- Don't overengineer.
- Perform appropriate abstraction and code reuse.
