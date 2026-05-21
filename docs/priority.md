# Priority System

`src/utils/priority.ts`

## Score formula

`calculatePriorityScore(task, graph, allTasks)` — higher score = higher urgency.

| Condition | Points |
|---|---|
| Overdue | +1000 + 50 × days_overdue |
| ≤ 7 days to deadline | +350 − 50 × days |
| 7–30 days to deadline | +50 − 2 × (days − 7) |
| Has active (non-completed) children | +200 |
| High subtask completion ratio | up to +50 |
| Start date already passed | +100 |
| Start date ≤ 3 days away | +50 |
| Completed or Ignored | −1000 (effectively excluded) |

## Soft deadline

If a task has no `endDate`, the soft deadline is **end of Friday of the week the task was created**. Tasks added on Saturday or Sunday use the *following* Friday.

## Weekly relevance filter

`getWeeklyRelevantTasks(tasks)` keeps a task if:
- It is overdue, **or**
- Its `startDate` falls in the current week (Sun–Sat), **or**
- Its deadline (hard or soft) falls in the current week.

Completed and Ignored tasks are excluded.

## Focus categories

`categorizeTasksByFocus(tasks, graph, allTasks)` splits weekly-relevant tasks into:

- **Focus Now** — overdue tasks, plus tasks with score ≥ 500 (up to 5 tasks max).
- **This Week** — everything else.

If nothing qualifies for Focus Now, the top-scored This Week task is promoted so the section is never empty when work exists.

Postponed tasks (see `usePostponedTasks`) are filtered out of the active pool before categorization and appended to "This Week".

## Subtask display deduplication

`getTasksToHideInGroup(tasks, graph)` — when both a parent and one of its children appear in the same section, the child is hidden (it will be shown inline under the parent by `TaskItemWithContext`).

## Upcoming weeks

`getUpcomingTasksByWeek(tasks, weeksAhead)` groups non-current-week tasks by which future week they fall in (up to `weeksAhead` weeks, default 4).

## Known limitations

Priority calculation currently considers only each task in isolation (plus its direct children for blocking bonus). It does not propagate subtask urgency upward through deeper hierarchies. This is planned future work (see `TODO.md`).
