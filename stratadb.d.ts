/**
 * TypeScript definitions for StrataDB Node.js SDK
 *
 * All data methods are async and return Promises. Factory methods
 * (Strata.open, Strata.cache) remain synchronous.
 */

// =========================================================================
// Error classes
// =========================================================================

/** Base error for all StrataDB errors. */
export class StrataError extends Error {
  /** Machine-readable error category. */
  code: string;
}
export class NotFoundError extends StrataError {}
export class ValidationError extends StrataError {}
export class ConflictError extends StrataError {}
export class StateError extends StrataError {}
export class ConstraintError extends StrataError {}
export class AccessDeniedError extends StrataError {}
export class IoError extends StrataError {}

// =========================================================================
// Value types
// =========================================================================

/** JSON-compatible value type */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Versioned value returned by history operations */
export interface VersionedValue {
  value: JsonValue;
  version: number;
  timestamp: number;
}

/** JSON list result with pagination cursor */
export interface JsonListResult {
  keys: string[];
  cursor?: string;
}

/** Vector collection information */
export interface CollectionInfo {
  name: string;
  dimension: number;
  metric: string;
  count: number;
  indexType: string;
  memoryBytes: number;
}

/** Vector data with metadata */
export interface VectorData {
  key: string;
  embedding: number[];
  metadata?: JsonValue;
  version: number;
  timestamp: number;
}

/** Vector search result */
export interface SearchMatch {
  key: string;
  score: number;
  metadata?: JsonValue;
}

/** Fork operation result */
export interface ForkResult {
  source: string;
  destination: string;
  keysCopied: number;
}

/** Branch diff summary */
export interface DiffSummary {
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
}

/** Branch diff result */
export interface DiffResult {
  branchA: string;
  branchB: string;
  summary: DiffSummary;
}

/** Merge conflict */
export interface MergeConflict {
  key: string;
  space: string;
}

/** Merge operation result */
export interface MergeResult {
  keysApplied: number;
  spacesMerged: number;
  conflicts: MergeConflict[];
}

/** Database information */
export interface DatabaseInfo {
  version: string;
  uptimeSecs: number;
  branchCount: number;
  totalKeys: number;
}

/** Branch metadata with version info */
export interface BranchInfo {
  id: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
  version: number;
  timestamp: number;
}

/** Branch export result */
export interface BranchExportResult {
  branchId: string;
  path: string;
  entryCount: number;
  bundleSize: number;
}

/** Branch import result */
export interface BranchImportResult {
  branchId: string;
  transactionsApplied: number;
  keysWritten: number;
}

/** Bundle validation result */
export interface BundleValidateResult {
  branchId: string;
  formatVersion: number;
  entryCount: number;
  checksumsValid: boolean;
}

/** Vector entry for batch upsert */
export interface BatchVectorEntry {
  key: string;
  vector: number[];
  metadata?: JsonValue;
}

/** Transaction info */
export interface TransactionInfo {
  id: string;
  status: string;
  startedAt: number;
}

/** Metadata filter for vector search */
export interface MetadataFilter {
  field: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: JsonValue;
}

/** KV list result with pagination */
export interface KvListResult {
  keys: string[];
}

/** Cross-primitive search result */
export interface SearchHit {
  entity: string;
  primitive: string;
  score: number;
  rank: number;
  snippet?: string;
}

/** Options for opening a database */
export interface OpenOptions {
  /** Enable automatic text embedding for semantic search. */
  autoEmbed?: boolean;
  /** Open in read-only mode. */
  readOnly?: boolean;
}

/**
 * StrataDB database handle.
 *
 * All data methods are async and return Promises.
 * Factory methods (`open`, `cache`) are synchronous.
 */
export class Strata {
  // Factory methods (synchronous)
  static open(path: string, options?: OpenOptions): Strata;
  static cache(): Strata;

  // KV Store
  kvPut(key: string, value: JsonValue): Promise<number>;
  kvGet(key: string): Promise<JsonValue>;
  kvDelete(key: string): Promise<boolean>;
  kvList(prefix?: string): Promise<string[]>;
  kvHistory(key: string): Promise<VersionedValue[] | null>;
  kvGetVersioned(key: string): Promise<VersionedValue | null>;
  kvListPaginated(prefix?: string, limit?: number): Promise<KvListResult>;

  // State Cell
  stateSet(cell: string, value: JsonValue): Promise<number>;
  stateGet(cell: string): Promise<JsonValue>;
  stateInit(cell: string, value: JsonValue): Promise<number>;
  stateCas(cell: string, newValue: JsonValue, expectedVersion?: number): Promise<number | null>;
  stateHistory(cell: string): Promise<VersionedValue[] | null>;
  stateDelete(cell: string): Promise<boolean>;
  stateList(prefix?: string): Promise<string[]>;
  stateGetVersioned(cell: string): Promise<VersionedValue | null>;

  // Event Log
  eventAppend(eventType: string, payload: JsonValue): Promise<number>;
  eventGet(sequence: number): Promise<VersionedValue | null>;
  eventList(eventType: string): Promise<VersionedValue[]>;
  eventLen(): Promise<number>;
  eventListPaginated(eventType: string, limit?: number, after?: number): Promise<VersionedValue[]>;

  // JSON Store
  jsonSet(key: string, path: string, value: JsonValue): Promise<number>;
  jsonGet(key: string, path: string): Promise<JsonValue>;
  jsonDelete(key: string, path: string): Promise<number>;
  jsonHistory(key: string): Promise<VersionedValue[] | null>;
  jsonList(limit: number, prefix?: string, cursor?: string): Promise<JsonListResult>;
  jsonGetVersioned(key: string): Promise<VersionedValue | null>;

  // Vector Store
  vectorCreateCollection(collection: string, dimension: number, metric?: string): Promise<number>;
  vectorDeleteCollection(collection: string): Promise<boolean>;
  vectorListCollections(): Promise<CollectionInfo[]>;
  vectorUpsert(collection: string, key: string, vector: number[], metadata?: JsonValue): Promise<number>;
  vectorGet(collection: string, key: string): Promise<VectorData | null>;
  vectorDelete(collection: string, key: string): Promise<boolean>;
  vectorSearch(collection: string, query: number[], k: number): Promise<SearchMatch[]>;
  vectorCollectionStats(collection: string): Promise<CollectionInfo>;
  vectorBatchUpsert(collection: string, vectors: BatchVectorEntry[]): Promise<number[]>;
  vectorSearchFiltered(
    collection: string,
    query: number[],
    k: number,
    metric?: string,
    filter?: MetadataFilter[],
  ): Promise<SearchMatch[]>;

  // Branch Management
  currentBranch(): Promise<string>;
  setBranch(branch: string): Promise<void>;
  createBranch(branch: string): Promise<void>;
  forkBranch(destination: string): Promise<ForkResult>;
  listBranches(): Promise<string[]>;
  deleteBranch(branch: string): Promise<void>;
  branchExists(name: string): Promise<boolean>;
  branchGet(name: string): Promise<BranchInfo | null>;
  diffBranches(branchA: string, branchB: string): Promise<DiffResult>;
  mergeBranches(source: string, strategy?: string): Promise<MergeResult>;

  // Space Management
  currentSpace(): Promise<string>;
  setSpace(space: string): Promise<void>;
  listSpaces(): Promise<string[]>;
  deleteSpace(space: string): Promise<void>;
  deleteSpaceForce(space: string): Promise<void>;
  spaceCreate(space: string): Promise<void>;
  spaceExists(space: string): Promise<boolean>;

  // Database Operations
  ping(): Promise<string>;
  info(): Promise<DatabaseInfo>;
  flush(): Promise<void>;
  compact(): Promise<void>;

  // Bundle Operations
  branchExport(branch: string, path: string): Promise<BranchExportResult>;
  branchImport(path: string): Promise<BranchImportResult>;
  branchValidateBundle(path: string): Promise<BundleValidateResult>;

  // Transaction Operations
  begin(readOnly?: boolean): Promise<void>;
  commit(): Promise<number>;
  rollback(): Promise<void>;
  txnInfo(): Promise<TransactionInfo | null>;
  txnIsActive(): Promise<boolean>;

  // Search
  search(query: string, k?: number, primitives?: string[]): Promise<SearchHit[]>;

  // Retention
  retentionApply(): Promise<void>;
}

/**
 * Download model files for auto-embedding.
 */
export function setup(): string;
