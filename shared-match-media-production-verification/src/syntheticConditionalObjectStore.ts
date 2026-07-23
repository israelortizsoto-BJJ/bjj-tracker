import type {
  ConditionalObjectStore,
  ConditionalPutOnlyIf,
} from "./conditionalObjectStore.ts";

type ObjectEntry = {
  body: string;
  etag: string;
  generation: number;
};

/**
 * Local synthetic conditional-object backend for isolated tests.
 *
 * Implements R2-shaped onlyIf ETag semantics in-process so tests can prove
 * stale-version rejection and cross-adapter-instance CAS without production
 * network, credentials, or bucket access.
 *
 * This is a test double for the injected ConditionalObjectStore capability.
 * It is not a production durable binding and must not be wired into runtime.
 *
 * Concurrency control is the synchronous onlyIf check-and-set on each put
 * (the same primitive the R2 adapter relies on). There is no application-level
 * per-key admission queue.
 */
export function createSyntheticConditionalObjectStore(): ConditionalObjectStore & {
  readonly _inspect: () => ReadonlyMap<string, ObjectEntry>;
} {
  const objects = new Map<string, ObjectEntry>();
  let etagCounter = 0;

  function nextEtag(generation: number): string {
    etagCounter += 1;
    // Opaque etag-like token; production R2 etags are similarly opaque strings.
    return `"syn-${generation}-${etagCounter.toString(16)}"`;
  }

  function putSync(
    key: string,
    value: string,
    onlyIf: ConditionalPutOnlyIf,
  ): { etag: string } | null {
    const existing = objects.get(key);

    if ("etagDoesNotMatch" in onlyIf) {
      if (onlyIf.etagDoesNotMatch !== "*") {
        throw new Error("synthetic store supports only etagDoesNotMatch: \"*\"");
      }
      if (existing) return null;
      const generation = 1;
      const etag = nextEtag(generation);
      objects.set(key, { body: value, etag, generation });
      return { etag };
    }

    if (!existing || existing.etag !== onlyIf.etagMatches) {
      return null;
    }
    const generation = existing.generation + 1;
    const etag = nextEtag(generation);
    objects.set(key, { body: value, etag, generation });
    return { etag };
  }

  return {
    get: async (key) => {
      const entry = objects.get(key);
      if (!entry) return null;
      return { body: entry.body, etag: entry.etag };
    },
    put: async (key, value, options) => putSync(key, value, options.onlyIf),
    _inspect: () => objects,
  };
}
