import { Schema } from "shexj";

/**
 * =============================================================================
 * taskSchema: ShexJ Schema for task
 * =============================================================================
 */
export const taskSchema: Schema = {
  type: "Schema",
  shapes: [
    {
      id: "urn:solid-planner:core#Task",
      type: "ShapeDecl",
      shapeExpr: {
        type: "Shape",
        expression: {
          type: "EachOf",
          expressions: [
            {
              type: "TripleConstraint",
              predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
              valueExpr: {
                type: "NodeConstraint",
                values: ["https://schema.org/Action"],
              },
            },
            {
              type: "TripleConstraint",
              predicate: "urn:solid-planner:core#title",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
            },
            {
              type: "TripleConstraint",
              predicate: "urn:solid-planner:core#description",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "urn:solid-planner:core#priority",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#integer",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/dateCreated",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#date",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/startDate",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#date",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "https://schema.org/endDate",
              valueExpr: {
                type: "NodeConstraint",
                datatype: "http://www.w3.org/2001/XMLSchema#date",
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "urn:solid-planner:core#status",
              valueExpr: {
                type: "NodeConstraint",
                values: [
                  "urn:solid-planner:core#InProgress",
                  "urn:solid-planner:core#Completed",
                  "urn:solid-planner:core#NotStarted",
                  "urn:solid-planner:core#Ignored",
                ],
              },
              min: 0,
              max: 1,
            },
            {
              type: "TripleConstraint",
              predicate: "urn:solid-planner:core#subTask",
              valueExpr: "urn:solid-planner:core#Task",
              min: 0,
              max: -1,
            },
          ],
        },
        extra: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"],
      },
    },
  ],
};
