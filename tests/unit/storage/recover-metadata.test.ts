import { describe, it, expect } from 'vitest'
import { Parser } from 'n3'
import { findStaleSingleValuedTriples } from '@/storage/soukai/recover-metadata'

const DOC_URL = 'https://pod.example/planner/tasks/x'
const METADATA = `${DOC_URL}#it-metadata`
const RESOURCE = `${DOC_URL}#it`
const CRDT = 'https://vocab.noeldemartin.com/crdt/'
const SCHEMA = 'https://schema.org/'
const XSD = 'http://www.w3.org/2001/XMLSchema#'

function parse(turtle: string) {
  return new Parser({ baseIRI: DOC_URL }).parse(turtle)
}

describe('findStaleSingleValuedTriples', () => {
  it('returns the older duplicate crdt:updatedAt triple for deletion', () => {
    const quads = parse(`
      @prefix crdt: <${CRDT}> .
      <#it-metadata> crdt:updatedAt "2026-04-16T06:33:11.793Z"^^<${XSD}dateTime>,
                                   "2026-04-16T06:33:17.604Z"^^<${XSD}dateTime> .
    `)

    const stale = findStaleSingleValuedTriples(quads)

    expect(stale).toHaveLength(1)
    expect(stale[0]).toContain(METADATA)
    expect(stale[0]).toContain('2026-04-16T06:33:11.793Z')
    expect(stale[0]).not.toContain('2026-04-16T06:33:17.604Z')
  })

  it('returns nothing when every single-valued predicate has one value', () => {
    const quads = parse(`
      @prefix crdt: <${CRDT}> .
      @prefix schema: <${SCHEMA}> .
      <#it> schema:name "One" .
      <#it-metadata> crdt:updatedAt "2026-04-16T06:33:11.793Z"^^<${XSD}dateTime> .
    `)

    expect(findStaleSingleValuedTriples(quads)).toEqual([])
  })

  it('keeps multiple values for multi-valued predicates such as schema:hasPart', () => {
    const quads = parse(`
      @prefix schema: <${SCHEMA}> .
      <#it> schema:hasPart <a>, <b>, <c> .
    `)

    expect(findStaleSingleValuedTriples(quads)).toEqual([])
  })

  it('dedupes non-date single-valued predicates keeping the first value', () => {
    const quads = parse(`
      @prefix schema: <${SCHEMA}> .
      <#it> schema:name "First", "Second" .
    `)

    const stale = findStaleSingleValuedTriples(quads)

    expect(stale).toHaveLength(1)
    expect(stale[0]).toContain(RESOURCE)
    expect(stale[0]).toContain('Second')
  })

  it('leaves unrelated predicates alone', () => {
    const quads = parse(`
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      <#it> foaf:nick "a", "b" .
    `)

    expect(findStaleSingleValuedTriples(quads)).toEqual([])
  })
})
