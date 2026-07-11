import { createHash } from 'node:crypto';

// RFC 4122's well-known "DNS" namespace UUID. The specific well-known
// namespace doesn't matter for our purposes — we always hash against this
// same fixed constant, which is what makes deterministicUuidV5 reproducible
// across processes, machines, and time for a given input string.
const DEFAULT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidStringToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

/**
 * Deterministic UUIDv5 (RFC 4122): the same (namespace, name) pair always
 * produces the same UUID, and the output is a spec-valid UUID string —
 * exactly the point-ID format Qdrant (Component 3) requires (unsigned
 * integer or UUID; a raw hash digest would NOT pass Qdrant's validation).
 *
 * This is what `KnowledgeProcessor` uses to derive `chunkId` from
 * `${documentId}:${chunkIndex}`: reprocessing the same document with the
 * same chunking config regenerates the exact same chunk IDs, so re-running
 * "Reindexing" (architecture doc, Phase 3) overwrites the same Qdrant
 * points instead of accumulating duplicates on every re-crawl or re-upload.
 */
export function deterministicUuidV5(name: string, namespace: string = DEFAULT_NAMESPACE): string {
  const namespaceBytes = uuidStringToBytes(namespace);
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = createHash('sha1')
    .update(Buffer.concat([namespaceBytes, nameBytes]))
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
