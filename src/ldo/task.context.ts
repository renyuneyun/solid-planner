import { ContextDefinition } from "jsonld";

/**
 * =============================================================================
 * taskContext: JSONLD Context for task
 * =============================================================================
 */
export const taskContext: ContextDefinition = {
  type: {
    "@id": "@type",
  },
  Action: "https://schema.org/Action",
  title: {
    "@id": "urn:solid-planner:core#title",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  description: {
    "@id": "urn:solid-planner:core#description",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  priority: {
    "@id": "urn:solid-planner:core#priority",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  dateCreated: {
    "@id": "https://schema.org/dateCreated",
    "@type": "http://www.w3.org/2001/XMLSchema#date",
  },
  startDate: {
    "@id": "https://schema.org/startDate",
    "@type": "http://www.w3.org/2001/XMLSchema#date",
  },
  endDate: {
    "@id": "https://schema.org/endDate",
    "@type": "http://www.w3.org/2001/XMLSchema#date",
  },
  status: {
    "@id": "urn:solid-planner:core#status",
  },
  InProgress: "urn:solid-planner:core#InProgress",
  Completed: "urn:solid-planner:core#Completed",
  NotStarted: "urn:solid-planner:core#NotStarted",
  Ignored: "urn:solid-planner:core#Ignored",
  subTask: {
    "@id": "urn:solid-planner:core#subTask",
    "@type": "@id",
    "@container": "@set",
  },
};
