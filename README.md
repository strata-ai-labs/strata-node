# strata-node

Node.js SDK for [StrataDB](https://github.com/strata-systems/strata-core) — an embedded database for AI agents.

NAPI-RS bindings embedding the Rust library directly in a native Node.js addon. No network hop, no serialization overhead beyond the Node/Rust boundary.

## Installation

```bash
npm install @stratadb/core
```

### From Source

Requires Rust toolchain and Node.js:

```bash
git clone https://github.com/strata-systems/strata-node.git
cd strata-node
npm install
npm run build
```

## Quick Start

All data methods are **async** and return Promises. Use `await` for every call.

```javascript
const { Strata } = require('@stratadb/core');

// Open a database (or use Strata.cache() for in-memory)
const db = Strata.open('/path/to/data');

// Key-value storage
await db.kvPut('user:123', 'Alice');
console.log(await db.kvGet('user:123'));  // "Alice"

// Branch isolation (like git branches)
await db.createBranch('experiment');
await db.setBranch('experiment');
console.log(await db.kvGet('user:123'));  // null - isolated

// Space organization within branches
await db.setSpace('conversations');
await db.kvPut('msg_001', 'hello');
```

## Features

### Six Data Primitives

| Primitive | Purpose | Key Methods |
|-----------|---------|-------------|
| **KV Store** | Working memory, config | `kvPut`, `kvGet`, `kvDelete`, `kvList` |
| **Event Log** | Immutable audit trail | `eventAppend`, `eventGet`, `eventList` |
| **State Cell** | CAS-based coordination | `stateSet`, `stateGet`, `stateCas` |
| **JSON Store** | Structured documents | `jsonSet`, `jsonGet`, `jsonDelete` |
| **Vector Store** | Embeddings, similarity search | `vectorUpsert`, `vectorSearch` |
| **Branch** | Data isolation | `createBranch`, `setBranch`, `forkBranch` |

### Error Handling

All errors thrown by StrataDB are instances of `StrataError` (or a subclass). Each error has a `.code` property for programmatic handling:

```javascript
const { Strata, NotFoundError, StrataError } = require('@stratadb/core');

const db = Strata.cache();

try {
  await db.vectorSearch('missing_collection', [1, 0, 0], 1);
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Collection not found');
  }
  // Or check the code property:
  console.log(err.code); // "NOT_FOUND"
}
```

Error class hierarchy:

| Error Class | Code | When |
|---|---|---|
| `NotFoundError` | `NOT_FOUND` | Key, branch, collection, or document not found |
| `ValidationError` | `VALIDATION` | Invalid key, path, input, or wrong type |
| `ConflictError` | `CONFLICT` | Version conflict, transition failed, transaction conflict |
| `StateError` | `STATE` | Branch closed/exists, collection exists, transaction not active |
| `ConstraintError` | `CONSTRAINT` | Dimension mismatch, constraint violation, overflow |
| `AccessDeniedError` | `ACCESS_DENIED` | Insufficient permissions |
| `IoError` | `IO` | I/O, serialization, internal, or not-implemented errors |

### Vector Operations

```javascript
// Create a collection
await db.vectorCreateCollection('embeddings', 384, 'cosine');

// Upsert with array
const embedding = new Array(384).fill(0).map(() => Math.random());
await db.vectorUpsert('embeddings', 'doc-1', embedding, { title: 'Hello' });

// Search returns matches with scores
const results = await db.vectorSearch('embeddings', embedding, 10);
for (const match of results) {
  console.log(`${match.key}: ${match.score}`);
}
```

### Branch Operations

```javascript
// Fork current branch (copies all data)
await db.forkBranch('experiment');

// Compare branches
const diff = await db.diffBranches('default', 'experiment');
console.log(`Added: ${diff.summary.totalAdded}`);

// Merge branches
const result = await db.mergeBranches('experiment', 'last_writer_wins');
console.log(`Keys applied: ${result.keysApplied}`);
```

### Transactions

```javascript
await db.begin();
try {
  await db.kvPut('key1', 'value1');
  await db.kvPut('key2', 'value2');
  const version = await db.commit();
  console.log(`Committed at version ${version}`);
} catch (err) {
  await db.rollback();
  throw err;
}

// Check transaction state
console.log(await db.txnIsActive()); // false
const info = await db.txnInfo();     // null when no txn
```

### Event Log

```javascript
// Append events
await db.eventAppend('tool_call', { tool: 'search', query: 'weather' });
await db.eventAppend('tool_call', { tool: 'calculator', expr: '2+2' });

// Get by sequence number
const event = await db.eventGet(0);

// List by type
const toolCalls = await db.eventList('tool_call');
```

### Compare-and-Swap (Version-based)

```javascript
// Initialize if not exists
await db.stateInit('counter', 0);

// CAS is version-based — pass expected version, not expected value
const version = await db.stateSet('counter', 1);

// Update only if version matches
const newVersion = await db.stateCas('counter', 2, version);
if (newVersion === null) {
  console.log('CAS failed — version mismatch');
}
```

### Cross-Primitive Search

```javascript
// Search across all primitives (KV, events, JSON docs, etc.)
const hits = await db.search('hello world');
for (const hit of hits) {
  console.log(`${hit.primitive}/${hit.entity}: score=${hit.score}`);
}

// Search specific primitives only
const kvHits = await db.search('hello', 10, ['kv']);
```

### Retention

```javascript
// Trigger garbage collection to reclaim old versions
await db.retentionApply();
```

## API Reference

### Strata

| Method | Returns | Description |
|--------|---------|-------------|
| `Strata.open(path, options?)` | `Strata` | Open database at path (sync) |
| `Strata.cache()` | `Strata` | Create in-memory database (sync) |

### KV Store

| Method | Returns | Description |
|--------|---------|-------------|
| `kvPut(key, value)` | `Promise<number>` | Store a value, returns version |
| `kvGet(key)` | `Promise<JsonValue>` | Get a value (null if missing) |
| `kvDelete(key)` | `Promise<boolean>` | Delete a key |
| `kvList(prefix?)` | `Promise<string[]>` | List keys |
| `kvHistory(key)` | `Promise<VersionedValue[]>` | Get version history |
| `kvGetVersioned(key)` | `Promise<VersionedValue>` | Get value with version info |
| `kvListPaginated(prefix?, limit?)` | `Promise<KvListResult>` | List keys with limit |

### State Cell

| Method | Returns | Description |
|--------|---------|-------------|
| `stateSet(cell, value)` | `Promise<number>` | Set value, returns version |
| `stateGet(cell)` | `Promise<JsonValue>` | Get value |
| `stateInit(cell, value)` | `Promise<number>` | Initialize if not exists |
| `stateCas(cell, newValue, expectedVersion?)` | `Promise<number\|null>` | Compare-and-swap |
| `stateHistory(cell)` | `Promise<VersionedValue[]>` | Get version history |
| `stateDelete(cell)` | `Promise<boolean>` | Delete a state cell |
| `stateList(prefix?)` | `Promise<string[]>` | List cell names |
| `stateGetVersioned(cell)` | `Promise<VersionedValue>` | Get with version info |

### Event Log

| Method | Returns | Description |
|--------|---------|-------------|
| `eventAppend(type, payload)` | `Promise<number>` | Append event, returns sequence |
| `eventGet(sequence)` | `Promise<VersionedValue>` | Get by sequence number |
| `eventList(type)` | `Promise<VersionedValue[]>` | List by type |
| `eventLen()` | `Promise<number>` | Get total count |
| `eventListPaginated(type, limit?, after?)` | `Promise<VersionedValue[]>` | List with pagination |

### JSON Store

| Method | Returns | Description |
|--------|---------|-------------|
| `jsonSet(key, path, value)` | `Promise<number>` | Set at JSONPath |
| `jsonGet(key, path)` | `Promise<JsonValue>` | Get at JSONPath |
| `jsonDelete(key, path)` | `Promise<number>` | Delete |
| `jsonHistory(key)` | `Promise<VersionedValue[]>` | Get version history |
| `jsonList(limit, prefix?, cursor?)` | `Promise<JsonListResult>` | List keys |
| `jsonGetVersioned(key)` | `Promise<VersionedValue>` | Get with version info |

### Vector Store

| Method | Returns | Description |
|--------|---------|-------------|
| `vectorCreateCollection(name, dim, metric?)` | `Promise<number>` | Create collection |
| `vectorDeleteCollection(name)` | `Promise<boolean>` | Delete collection |
| `vectorListCollections()` | `Promise<CollectionInfo[]>` | List collections |
| `vectorUpsert(collection, key, vector, metadata?)` | `Promise<number>` | Insert/update |
| `vectorGet(collection, key)` | `Promise<VectorData>` | Get vector |
| `vectorDelete(collection, key)` | `Promise<boolean>` | Delete vector |
| `vectorSearch(collection, query, k)` | `Promise<SearchMatch[]>` | Search |
| `vectorCollectionStats(collection)` | `Promise<CollectionInfo>` | Get stats |
| `vectorBatchUpsert(collection, vectors)` | `Promise<number[]>` | Batch insert/update |
| `vectorSearchFiltered(collection, query, k, metric?, filter?)` | `Promise<SearchMatch[]>` | Filtered search |

### Branches

| Method | Returns | Description |
|--------|---------|-------------|
| `currentBranch()` | `Promise<string>` | Get current branch |
| `setBranch(name)` | `Promise<void>` | Switch branch |
| `createBranch(name)` | `Promise<void>` | Create empty branch |
| `forkBranch(dest)` | `Promise<ForkResult>` | Fork with data copy |
| `listBranches()` | `Promise<string[]>` | List all branches |
| `deleteBranch(name)` | `Promise<void>` | Delete branch |
| `branchExists(name)` | `Promise<boolean>` | Check if branch exists |
| `branchGet(name)` | `Promise<BranchInfo>` | Get branch metadata |
| `diffBranches(a, b)` | `Promise<DiffResult>` | Compare branches |
| `mergeBranches(source, strategy?)` | `Promise<MergeResult>` | Merge into current |

### Spaces

| Method | Returns | Description |
|--------|---------|-------------|
| `currentSpace()` | `Promise<string>` | Get current space |
| `setSpace(name)` | `Promise<void>` | Switch space |
| `listSpaces()` | `Promise<string[]>` | List spaces |
| `deleteSpace(name)` | `Promise<void>` | Delete space |
| `deleteSpaceForce(name)` | `Promise<void>` | Force delete space |
| `spaceCreate(name)` | `Promise<void>` | Create space explicitly |
| `spaceExists(name)` | `Promise<boolean>` | Check if space exists |

### Database

| Method | Returns | Description |
|--------|---------|-------------|
| `ping()` | `Promise<string>` | Health check |
| `info()` | `Promise<DatabaseInfo>` | Get database info |
| `flush()` | `Promise<void>` | Flush to disk |
| `compact()` | `Promise<void>` | Trigger compaction |

### Transactions

| Method | Returns | Description |
|--------|---------|-------------|
| `begin(readOnly?)` | `Promise<void>` | Begin transaction |
| `commit()` | `Promise<number>` | Commit, returns version |
| `rollback()` | `Promise<void>` | Rollback |
| `txnInfo()` | `Promise<TransactionInfo>` | Get transaction info |
| `txnIsActive()` | `Promise<boolean>` | Check if transaction active |

### Bundle Operations

| Method | Returns | Description |
|--------|---------|-------------|
| `branchExport(branch, path)` | `Promise<BranchExportResult>` | Export branch to bundle |
| `branchImport(path)` | `Promise<BranchImportResult>` | Import branch from bundle |
| `branchValidateBundle(path)` | `Promise<BundleValidateResult>` | Validate bundle file |

### Search

| Method | Returns | Description |
|--------|---------|-------------|
| `search(query, k?, primitives?)` | `Promise<SearchHit[]>` | Cross-primitive search |

### Retention

| Method | Returns | Description |
|--------|---------|-------------|
| `retentionApply()` | `Promise<void>` | Trigger garbage collection |

## TypeScript

Full TypeScript definitions are included:

```typescript
import { Strata, JsonValue, SearchMatch, NotFoundError } from '@stratadb/core';

const db = Strata.cache();
await db.kvPut('key', { count: 42 });
const value: JsonValue = await db.kvGet('key');
```

## Development

```bash
# Install dev dependencies
npm install

# Build native module
npm run build

# Run tests
npm test
```

## License

MIT
