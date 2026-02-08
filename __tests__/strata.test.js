/**
 * Integration tests for the StrataDB Node.js SDK.
 *
 * All methods are async — every call uses `await`.
 */

const {
  Strata,
  StrataError,
  NotFoundError,
  ValidationError,
  ConflictError,
  StateError,
  ConstraintError,
} = require('../stratadb');

describe('Strata', () => {
  let db;

  beforeEach(() => {
    db = Strata.cache();
  });

  // =========================================================================
  // KV Store
  // =========================================================================

  describe('KV Store', () => {
    test('put and get', async () => {
      await db.kvPut('key1', 'value1');
      expect(await db.kvGet('key1')).toBe('value1');
    });

    test('put and get object', async () => {
      await db.kvPut('config', { theme: 'dark', count: 42 });
      const result = await db.kvGet('config');
      expect(result.theme).toBe('dark');
      expect(result.count).toBe(42);
    });

    test('get missing returns null', async () => {
      expect(await db.kvGet('nonexistent')).toBeNull();
    });

    test('delete', async () => {
      await db.kvPut('to_delete', 'value');
      expect(await db.kvDelete('to_delete')).toBe(true);
      expect(await db.kvGet('to_delete')).toBeNull();
    });

    test('list', async () => {
      await db.kvPut('user:1', 'alice');
      await db.kvPut('user:2', 'bob');
      await db.kvPut('item:1', 'book');

      const allKeys = await db.kvList();
      expect(allKeys.length).toBe(3);

      const userKeys = await db.kvList('user:');
      expect(userKeys.length).toBe(2);
    });

    test('put returns version number', async () => {
      const v = await db.kvPut('vkey', 'val');
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThan(0);
    });

    test('history', async () => {
      await db.kvPut('hkey', 'v1');
      await db.kvPut('hkey', 'v2');
      const history = await db.kvHistory('hkey');
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0]).toHaveProperty('version');
      expect(history[0]).toHaveProperty('timestamp');
    });

    test('getVersioned', async () => {
      await db.kvPut('vkey2', 'val');
      const vv = await db.kvGetVersioned('vkey2');
      expect(vv).not.toBeNull();
      expect(vv.value).toBe('val');
      expect(typeof vv.version).toBe('number');
    });

    test('getVersioned missing returns null', async () => {
      expect(await db.kvGetVersioned('nope')).toBeNull();
    });

    test('listPaginated', async () => {
      await db.kvPut('p:a', 1);
      await db.kvPut('p:b', 2);
      await db.kvPut('p:c', 3);
      const result = await db.kvListPaginated('p:', 2);
      expect(result.keys).toBeDefined();
      expect(result.keys.length).toBeLessThanOrEqual(3);
    });
  });

  // =========================================================================
  // State Cell
  // =========================================================================

  describe('State Cell', () => {
    test('set and get', async () => {
      await db.stateSet('counter', 100);
      expect(await db.stateGet('counter')).toBe(100);
    });

    test('init', async () => {
      await db.stateInit('status', 'pending');
      expect(await db.stateGet('status')).toBe('pending');
    });

    test('cas', async () => {
      const version = await db.stateSet('value', 1);
      const newVersion = await db.stateCas('value', 2, version);
      expect(newVersion).not.toBeNull();
      expect(await db.stateGet('value')).toBe(2);
      // Wrong version → CAS fails
      const result = await db.stateCas('value', 3, 999);
      expect(result).toBeNull();
    });

    test('history', async () => {
      await db.stateSet('hcell', 'a');
      await db.stateSet('hcell', 'b');
      const history = await db.stateHistory('hcell');
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    test('delete', async () => {
      await db.stateSet('del_cell', 'x');
      const deleted = await db.stateDelete('del_cell');
      expect(deleted).toBe(true);
      expect(await db.stateGet('del_cell')).toBeNull();
    });

    test('list', async () => {
      await db.stateSet('cell_a', 1);
      await db.stateSet('cell_b', 2);
      const cells = await db.stateList('cell_');
      expect(cells.length).toBe(2);
    });

    test('getVersioned', async () => {
      await db.stateSet('vcell', 42);
      const vv = await db.stateGetVersioned('vcell');
      expect(vv).not.toBeNull();
      expect(vv.value).toBe(42);
      expect(typeof vv.version).toBe('number');
    });
  });

  // =========================================================================
  // Event Log
  // =========================================================================

  describe('Event Log', () => {
    test('append and get', async () => {
      await db.eventAppend('user_action', { action: 'click', target: 'button' });
      expect(await db.eventLen()).toBe(1);

      const event = await db.eventGet(0);
      expect(event).not.toBeNull();
      expect(event.value.action).toBe('click');
    });

    test('list by type', async () => {
      await db.eventAppend('click', { x: 10 });
      await db.eventAppend('scroll', { y: 100 });
      await db.eventAppend('click', { x: 20 });

      const clicks = await db.eventList('click');
      expect(clicks.length).toBe(2);
    });

    test('eventLen', async () => {
      expect(await db.eventLen()).toBe(0);
      await db.eventAppend('a', {});
      await db.eventAppend('b', {});
      expect(await db.eventLen()).toBe(2);
    });

    test('listPaginated', async () => {
      await db.eventAppend('page', { n: 1 });
      await db.eventAppend('page', { n: 2 });
      await db.eventAppend('page', { n: 3 });
      const events = await db.eventListPaginated('page', 2);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(3);
    });
  });

  // =========================================================================
  // JSON Store
  // =========================================================================

  describe('JSON Store', () => {
    test('set and get', async () => {
      await db.jsonSet('config', '$', { theme: 'dark', lang: 'en' });
      const result = await db.jsonGet('config', '$');
      expect(result.theme).toBe('dark');
    });

    test('get path', async () => {
      await db.jsonSet('config', '$', { theme: 'dark', lang: 'en' });
      const theme = await db.jsonGet('config', '$.theme');
      expect(theme).toBe('dark');
    });

    test('list', async () => {
      await db.jsonSet('doc1', '$', { a: 1 });
      await db.jsonSet('doc2', '$', { b: 2 });
      const result = await db.jsonList(100);
      expect(result.keys.length).toBe(2);
    });

    test('history', async () => {
      await db.jsonSet('jhist', '$', { v: 1 });
      await db.jsonSet('jhist', '$', { v: 2 });
      const history = await db.jsonHistory('jhist');
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    test('delete', async () => {
      await db.jsonSet('jdel', '$', { x: 1 });
      const version = await db.jsonDelete('jdel', '$');
      expect(typeof version).toBe('number');
    });

    test('getVersioned', async () => {
      await db.jsonSet('jv', '$', { data: true });
      const vv = await db.jsonGetVersioned('jv');
      expect(vv).not.toBeNull();
      expect(typeof vv.version).toBe('number');
    });
  });

  // =========================================================================
  // Vector Store
  // =========================================================================

  describe('Vector Store', () => {
    test('create collection', async () => {
      await db.vectorCreateCollection('embeddings', 4);
      const collections = await db.vectorListCollections();
      expect(collections.some((c) => c.name === 'embeddings')).toBe(true);
    });

    test('upsert and search', async () => {
      await db.vectorCreateCollection('embeddings', 4);

      const v1 = [1.0, 0.0, 0.0, 0.0];
      const v2 = [0.0, 1.0, 0.0, 0.0];

      await db.vectorUpsert('embeddings', 'v1', v1);
      await db.vectorUpsert('embeddings', 'v2', v2);

      const results = await db.vectorSearch('embeddings', v1, 2);
      expect(results.length).toBe(2);
      expect(results[0].key).toBe('v1');
    });

    test('upsert with metadata', async () => {
      await db.vectorCreateCollection('docs', 4);
      const vec = [1.0, 0.0, 0.0, 0.0];
      await db.vectorUpsert('docs', 'doc1', vec, { title: 'Hello' });

      const result = await db.vectorGet('docs', 'doc1');
      expect(result.metadata.title).toBe('Hello');
    });

    test('get', async () => {
      await db.vectorCreateCollection('vget', 4);
      await db.vectorUpsert('vget', 'k1', [1, 0, 0, 0]);
      const result = await db.vectorGet('vget', 'k1');
      expect(result).not.toBeNull();
      expect(result.key).toBe('k1');
      expect(result.embedding.length).toBe(4);
      expect(typeof result.version).toBe('number');
    });

    test('get missing returns null', async () => {
      await db.vectorCreateCollection('vget2', 4);
      expect(await db.vectorGet('vget2', 'nope')).toBeNull();
    });

    test('delete', async () => {
      await db.vectorCreateCollection('vdel', 4);
      await db.vectorUpsert('vdel', 'k1', [1, 0, 0, 0]);
      expect(await db.vectorDelete('vdel', 'k1')).toBe(true);
      expect(await db.vectorGet('vdel', 'k1')).toBeNull();
    });

    test('deleteCollection', async () => {
      await db.vectorCreateCollection('to_delete', 4);
      expect(await db.vectorDeleteCollection('to_delete')).toBe(true);
    });

    test('collectionStats', async () => {
      await db.vectorCreateCollection('stats', 4);
      await db.vectorUpsert('stats', 'k1', [1, 0, 0, 0]);
      const stats = await db.vectorCollectionStats('stats');
      expect(stats.name).toBe('stats');
      expect(stats.dimension).toBe(4);
      expect(stats.count).toBeGreaterThanOrEqual(1);
    });

    test('batchUpsert', async () => {
      await db.vectorCreateCollection('batch', 4);
      const versions = await db.vectorBatchUpsert('batch', [
        { key: 'b1', vector: [1, 0, 0, 0] },
        { key: 'b2', vector: [0, 1, 0, 0], metadata: { label: 'two' } },
      ]);
      expect(versions.length).toBe(2);
      versions.forEach((v) => expect(typeof v).toBe('number'));
    });

    test('rejects NaN in vector', async () => {
      await db.vectorCreateCollection('nan_test', 4);
      await expect(
        db.vectorUpsert('nan_test', 'k', [1, NaN, 0, 0]),
      ).rejects.toThrow(/not a finite number/);
    });

    test('rejects Infinity in vector', async () => {
      await db.vectorCreateCollection('inf_test', 4);
      await expect(
        db.vectorUpsert('inf_test', 'k', [1, 0, Infinity, 0]),
      ).rejects.toThrow(/not a finite number/);
    });
  });

  // =========================================================================
  // Branches
  // =========================================================================

  describe('Branches', () => {
    test('create and list', async () => {
      await db.createBranch('feature');
      const branches = await db.listBranches();
      expect(branches).toContain('default');
      expect(branches).toContain('feature');
    });

    test('switch', async () => {
      await db.kvPut('x', 1);
      await db.createBranch('feature');
      await db.setBranch('feature');

      expect(await db.kvGet('x')).toBeNull();

      await db.kvPut('x', 2);
      await db.setBranch('default');
      expect(await db.kvGet('x')).toBe(1);
    });

    test('fork', async () => {
      await db.kvPut('shared', 'original');
      const result = await db.forkBranch('forked');
      expect(result.keysCopied).toBeGreaterThan(0);

      await db.setBranch('forked');
      expect(await db.kvGet('shared')).toBe('original');
    });

    test('current branch', async () => {
      expect(await db.currentBranch()).toBe('default');
      await db.createBranch('test');
      await db.setBranch('test');
      expect(await db.currentBranch()).toBe('test');
    });

    test('deleteBranch', async () => {
      await db.createBranch('to_del');
      await db.deleteBranch('to_del');
      const branches = await db.listBranches();
      expect(branches).not.toContain('to_del');
    });

    test('branchExists', async () => {
      expect(await db.branchExists('default')).toBe(true);
      expect(await db.branchExists('nope')).toBe(false);
    });

    test('branchGet', async () => {
      const info = await db.branchGet('default');
      expect(info).not.toBeNull();
      expect(info.id).toBe('default');
      expect(info).toHaveProperty('status');
      expect(info).toHaveProperty('version');
    });

    test('branchGet missing returns null', async () => {
      expect(await db.branchGet('nonexistent')).toBeNull();
    });

    test('diffBranches', async () => {
      await db.kvPut('d_key', 'val');
      await db.createBranch('diff_b');
      const diff = await db.diffBranches('default', 'diff_b');
      expect(diff).toHaveProperty('summary');
      expect(diff.summary).toHaveProperty('totalAdded');
    });

    test('mergeBranches', async () => {
      await db.kvPut('base', 'val');
      await db.forkBranch('merge_src');
      await db.setBranch('merge_src');
      await db.kvPut('new_key', 'from_src');
      await db.setBranch('default');
      const result = await db.mergeBranches('merge_src');
      expect(result).toHaveProperty('keysApplied');
    });
  });

  // =========================================================================
  // Spaces
  // =========================================================================

  describe('Spaces', () => {
    test('list spaces', async () => {
      const spaces = await db.listSpaces();
      expect(spaces).toContain('default');
    });

    test('switch space', async () => {
      await db.kvPut('key', 'value1');
      await db.setSpace('other');
      expect(await db.kvGet('key')).toBeNull();

      await db.kvPut('key', 'value2');
      await db.setSpace('default');
      expect(await db.kvGet('key')).toBe('value1');
    });

    test('current space', async () => {
      expect(await db.currentSpace()).toBe('default');
    });

    test('spaceCreate', async () => {
      await db.spaceCreate('explicit');
      const exists = await db.spaceExists('explicit');
      expect(exists).toBe(true);
    });

    test('spaceExists', async () => {
      expect(await db.spaceExists('default')).toBe(true);
      expect(await db.spaceExists('nonexistent_space')).toBe(false);
    });

    test('deleteSpace', async () => {
      await db.spaceCreate('to_del_space');
      await db.deleteSpaceForce('to_del_space');
      expect(await db.spaceExists('to_del_space')).toBe(false);
    });
  });

  // =========================================================================
  // Database Operations
  // =========================================================================

  describe('Database', () => {
    test('ping', async () => {
      const version = await db.ping();
      expect(version).toBeTruthy();
    });

    test('info', async () => {
      const info = await db.info();
      expect(info.version).toBeTruthy();
      expect(info.branchCount).toBeGreaterThanOrEqual(1);
    });

    test('flush', async () => {
      await db.flush();
      // No error means success
    });

    test('compact', async () => {
      await db.compact();
      // No error means success
    });
  });

  // =========================================================================
  // Transactions
  // =========================================================================

  describe('Transactions', () => {
    test('begin and commit', async () => {
      await db.begin();
      await expect(db.txnIsActive()).resolves.toBe(true);
      const version = await db.commit();
      expect(typeof version).toBe('number');
    });

    test('begin and rollback', async () => {
      await db.begin();
      await db.rollback();
      await expect(db.txnIsActive()).resolves.toBe(false);
    });

    test('txnIsActive before begin', async () => {
      expect(await db.txnIsActive()).toBe(false);
    });

    test('txnInfo', async () => {
      // Before any txn, info should be null
      expect(await db.txnInfo()).toBeNull();
      await db.begin();
      const info = await db.txnInfo();
      expect(info).not.toBeNull();
      expect(info).toHaveProperty('id');
      expect(info).toHaveProperty('status');
      await db.rollback();
    });
  });

  // =========================================================================
  // Retention
  // =========================================================================

  describe('Retention', () => {
    test('retentionApply succeeds', async () => {
      await db.kvPut('r_key', 'val');
      await db.retentionApply();
      // No error means success
    });
  });

  // =========================================================================
  // Time Travel
  // =========================================================================

  describe('Time Travel', () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    test('kvGet with asOf returns past value', async () => {
      await db.kvPut('tt_kv', 'v1');
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.kvPut('tt_kv', 'v2');

      expect(await db.kvGet('tt_kv')).toBe('v2');
      expect(await db.kvGet('tt_kv', ts)).toBe('v1');
    });

    test('kvGet with asOf before creation returns null', async () => {
      const range = await db.timeRange();
      // Use timestamp 1 (before any writes)
      const earlyTs = 1;
      await db.kvPut('tt_kv_early', 'val');
      expect(await db.kvGet('tt_kv_early', earlyTs)).toBeNull();
    });

    test('kvList with asOf returns fewer keys', async () => {
      await db.kvPut('ttl_a', 1);
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.kvPut('ttl_b', 2);

      const current = await db.kvList('ttl_');
      expect(current.length).toBe(2);
      const past = await db.kvList('ttl_', ts);
      expect(past.length).toBe(1);
    });

    test('stateGet with asOf returns past value', async () => {
      await db.stateSet('tt_state', 'old');
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.stateSet('tt_state', 'new');

      expect(await db.stateGet('tt_state')).toBe('new');
      expect(await db.stateGet('tt_state', ts)).toBe('old');
    });

    test('stateList with asOf', async () => {
      await db.stateSet('tts_a', 1);
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.stateSet('tts_b', 2);

      const current = await db.stateList('tts_');
      expect(current.length).toBe(2);
      const past = await db.stateList('tts_', ts);
      expect(past.length).toBe(1);
    });

    test('eventGet with asOf', async () => {
      await db.eventAppend('tt_evt', { v: 1 });
      // Event sequence is 0 (first event in fresh db)
      const evt = await db.eventGet(0);
      expect(evt).not.toBeNull();
      expect(evt.value.v).toBe(1);
      // The event timestamp is its creation time
      const eventTs = evt.timestamp;

      await sleep(50);
      // asOf at the event timestamp should return it
      const past = await db.eventGet(0, eventTs);
      expect(past).not.toBeNull();

      // asOf before the event was created should return null
      const before = await db.eventGet(0, 1);
      expect(before).toBeNull();
    });

    test('eventList with asOf', async () => {
      await db.eventAppend('tt_etype', { n: 1 });
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.eventAppend('tt_etype', { n: 2 });

      const current = await db.eventList('tt_etype');
      expect(current.length).toBe(2);
      const past = await db.eventList('tt_etype', ts);
      expect(past.length).toBe(1);
    });

    test('jsonGet with asOf returns past value', async () => {
      await db.jsonSet('tt_json', '$', { v: 1 });
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.jsonSet('tt_json', '$', { v: 2 });

      const current = await db.jsonGet('tt_json', '$');
      expect(current.v).toBe(2);
      const past = await db.jsonGet('tt_json', '$', ts);
      expect(past.v).toBe(1);
    });

    test('jsonList with asOf', async () => {
      await db.jsonSet('ttj_a', '$', { x: 1 });
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.jsonSet('ttj_b', '$', { x: 2 });

      const current = await db.jsonList(100, 'ttj_');
      expect(current.keys.length).toBe(2);
      const past = await db.jsonList(100, 'ttj_', undefined, ts);
      expect(past.keys.length).toBe(1);
    });

    test('vectorSearch with asOf', async () => {
      await db.vectorCreateCollection('tt_vec', 4);
      await db.vectorUpsert('tt_vec', 'a', [1, 0, 0, 0]);
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.vectorUpsert('tt_vec', 'b', [0, 1, 0, 0]);

      const current = await db.vectorSearch('tt_vec', [1, 0, 0, 0], 10);
      expect(current.length).toBe(2);
      const past = await db.vectorSearch('tt_vec', [1, 0, 0, 0], 10, ts);
      expect(past.length).toBe(1);
    });

    test('vectorGet with asOf', async () => {
      await db.vectorCreateCollection('tt_vget', 4);
      await db.vectorUpsert('tt_vget', 'k', [1, 0, 0, 0], { tag: 'v1' });
      await sleep(50);
      const range = await db.timeRange();
      const ts = range.latestTs;
      await sleep(50);
      await db.vectorUpsert('tt_vget', 'k', [0, 1, 0, 0], { tag: 'v2' });

      const current = await db.vectorGet('tt_vget', 'k');
      expect(current.metadata.tag).toBe('v2');
      const past = await db.vectorGet('tt_vget', 'k', ts);
      expect(past).not.toBeNull();
      expect(past.metadata.tag).toBe('v1');
    });

    test('timeRange returns oldest and latest', async () => {
      await db.kvPut('tr_key', 'val');
      const range = await db.timeRange();
      expect(range).toHaveProperty('oldestTs');
      expect(range).toHaveProperty('latestTs');
      expect(typeof range.oldestTs).toBe('number');
      expect(typeof range.latestTs).toBe('number');
      expect(range.latestTs).toBeGreaterThanOrEqual(range.oldestTs);
    });
  });

  // =========================================================================
  // Errors
  // =========================================================================

  describe('Errors', () => {
    test('NotFoundError on missing collection', async () => {
      try {
        await db.vectorSearch('no_such_collection', [1, 0, 0, 0], 1);
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect(err).toBeInstanceOf(StrataError);
        expect(err.code).toBe('NOT_FOUND');
      }
    });

    test('ValidationError on invalid metric', async () => {
      try {
        await db.vectorCreateCollection('x', 4, 'invalid_metric');
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.code).toBe('VALIDATION');
      }
    });

    test('ConstraintError on dimension mismatch', async () => {
      await db.vectorCreateCollection('dim_test', 4);
      try {
        await db.vectorUpsert('dim_test', 'k', [1, 0]); // wrong dimension
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(ConstraintError);
        expect(err.code).toBe('CONSTRAINT');
      }
    });

    test('error hierarchy — instanceof checks', async () => {
      try {
        await db.vectorSearch('no_such', [1, 0, 0, 0], 1);
        fail('Expected error');
      } catch (err) {
        expect(err instanceof NotFoundError).toBe(true);
        expect(err instanceof StrataError).toBe(true);
        expect(err instanceof Error).toBe(true);
        // Not other types
        expect(err instanceof ValidationError).toBe(false);
        expect(err instanceof ConflictError).toBe(false);
      }
    });

    test('StrataError has code property', async () => {
      try {
        await db.vectorSearch('missing', [1, 0, 0, 0], 1);
        fail('Expected error');
      } catch (err) {
        expect(err.code).toBeDefined();
        expect(typeof err.code).toBe('string');
      }
    });
  });

  // =========================================================================
  // Search
  // =========================================================================

  describe('Search', () => {
    test('cross-primitive search returns array', async () => {
      await db.kvPut('search_key', 'hello world');
      const results = await db.search('hello');
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
