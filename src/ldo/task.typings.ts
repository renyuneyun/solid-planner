import { ContextDefinition } from "jsonld";

/**
 * =============================================================================
 * Typescript Typings for task
 * =============================================================================
 */

/**
 * Task Type
 */
export interface Task {
  "@id"?: string;
  "@context"?: ContextDefinition;
  type: {
    "@id": "Action";
  };
  title: string;
  description?: string;
  priority?: number;
  dateCreated?: string;
  startDate?: string;
  endDate?: string;
  status?:
    | {
        "@id": "InProgress";
      }
    | {
        "@id": "Completed";
      }
    | {
        "@id": "NotStarted";
      }
    | {
        "@id": "Ignored";
      };
  subTask?: Task[];
}
