import { ShapeType } from "@ldo/ldo";
import { taskSchema } from "./task.schema";
import { taskContext } from "./task.context";
import { Task } from "./task.typings";

/**
 * =============================================================================
 * LDO ShapeTypes task
 * =============================================================================
 */

/**
 * Task ShapeType
 */
export const TaskShapeType: ShapeType<Task> = {
  schema: taskSchema,
  shape: "urn:solid-planner:core#Task",
  context: taskContext,
};
