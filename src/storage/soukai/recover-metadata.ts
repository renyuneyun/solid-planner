import { Writer } from 'n3'
import type { Quad } from 'n3'

const CRDT = 'https://vocab.noeldemartin.com/crdt/'
const SCHEMA = 'https://schema.org/'
const XSD_DATE_TIME = 'http://www.w3.org/2001/XMLSchema#dateTime'

/**
 * Predicates that must have exactly one value on a task document. Values here
 * mirror the `Task` and `Metadata` model schemas (soukai-solid). When two
 * concurrent updates race, a second value is left behind because Soukai's
 * update deletes only the triples it read, so we clean the stale one up here.
 */
const SINGLE_VALUED_PREDICATES = new Set<string>([
  `${CRDT}resource`,
  `${CRDT}createdAt`,
  `${CRDT}updatedAt`,
  `${CRDT}deletedAt`,
  `${SCHEMA}name`,
  `${SCHEMA}description`,
  `${SCHEMA}priority`,
  `${SCHEMA}dateCreated`,
  `${SCHEMA}startTime`,
  `${SCHEMA}endTime`,
  `${SCHEMA}actionStatus`,
  `${SCHEMA}partOf`,
])

function pickKeepIndex(quads: Quad[]): number {
  const dateValues = quads.map(quad => {
    if (quad.object.termType !== 'Literal') return NaN
    if (quad.object.datatype.value !== XSD_DATE_TIME) return NaN
    return new Date(quad.object.value).getTime()
  })

  if (dateValues.every(value => !Number.isNaN(value))) {
    return dateValues.indexOf(
      Math.max(...dateValues.filter(v => !Number.isNaN(v))),
    )
  }

  return 0
}

/**
 * Given the quads of a task document, return N-Triples representations of the
 * stale triples that should be removed because their predicate is supposed to
 * be single-valued. For date-time predicates the latest value is kept; for
 * other predicates the first value is kept.
 */
export function findStaleSingleValuedTriples(quads: Quad[]): string[] {
  const groups = new Map<string, Quad[]>()

  for (const quad of quads) {
    if (quad.subject.termType !== 'NamedNode') continue
    if (!SINGLE_VALUED_PREDICATES.has(quad.predicate.value)) continue

    const key = `${quad.subject.value}\u0000${quad.predicate.value}`
    const group = groups.get(key)

    if (group) {
      group.push(quad)
    } else {
      groups.set(key, [quad])
    }
  }

  const stale: Quad[] = []

  for (const group of groups.values()) {
    if (group.length < 2) continue

    const keepIndex = pickKeepIndex(group)

    group.forEach((quad, index) => {
      if (index !== keepIndex) stale.push(quad)
    })
  }

  if (stale.length === 0) return []

  return new Writer({ format: 'N-Triples' })
    .quadsToString(stale)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}
