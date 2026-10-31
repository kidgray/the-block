/**
 * Small deterministic random numbers for the simulated bidder (design §6.2): the same seed always
 * gives the same ceilings and delays, so the demo and the tests are reproducible.
 */

/** A 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A seeded generator of numbers in [0, 1) (mulberry32). */
export function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** One stable number in [0, 1) for a key, independent of the order in which keys are asked for. */
export function stableUnit(seed: string, key: string): number {
  return seededRandom(`${seed}:${key}`)();
}
