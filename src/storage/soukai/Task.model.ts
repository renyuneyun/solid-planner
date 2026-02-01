import { FieldType } from 'soukai'
import { SolidModel } from 'soukai-solid'

/**
 * Soukai model for Task, using schema.org/Action as RDF type
 * Enables history tracking for CRDT-like synchronization
 */
export default class Task extends SolidModel {
  // Enable history tracking for local-first/CRDT support
  static history = true
  static tombstone = true // Keep tombstones for deleted tasks

  static rdfContexts = {
    schema: 'https://schema.org/',
  }

  static rdfsClasses = ['Action']

  static fields = {
    title: {
      type: FieldType.String,
      required: true,
      rdfProperty: 'schema:name',
    },
    description: {
      type: FieldType.String,
      rdfProperty: 'schema:description',
    },
    priority: {
      type: FieldType.Number,
      rdfProperty: 'schema:priority',
    },
    dateCreated: {
      type: FieldType.Date,
      rdfProperty: 'schema:dateCreated',
    },
    startDate: {
      type: FieldType.Date,
      rdfProperty: 'schema:startTime',
    },
    endDate: {
      type: FieldType.Date,
      rdfProperty: 'schema:endTime',
    },
    status: {
      type: FieldType.String,
      rdfProperty: 'schema:actionStatus',
    },
    // Subtasks stored as URLs (foreign keys)
    subTaskUrls: {
      type: FieldType.Array,
      items: FieldType.String,
      rdfProperty: 'schema:hasPart',
    },
    // Parent task URL (for reverse lookup if needed)
    parentTaskUrl: {
      type: FieldType.String,
      rdfProperty: 'schema:partOf',
    },
  }

  // Type-safe field accessors
  declare title: string
  declare description?: string
  declare priority?: number
  declare dateCreated?: Date
  declare startDate?: Date
  declare endDate?: Date
  declare status?: string
  declare subTaskUrls?: string[]
  declare parentTaskUrl?: string

  // Soukai automatic timestamps
  declare createdAt?: Date
  declare updatedAt?: Date
}
