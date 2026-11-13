import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fields, recordAuthSource } from '../src/session.ts';

test('records the upstream reported by the local AAA proxy', () => {
  const values = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => { values.set(key, value); } };
  recordAuthSource(storage, 'http://127.0.0.1:5173/aaa/v1/login',
    'https://example.test/aaa/v1/login', 'production', true);
  assert.deepEqual(JSON.parse(values.get(fields.authSource)!), {
    url: 'https://example.test/aaa/v1/login', environment: 'production',
  });
});

test('does not infer an upstream from a local proxy that does not report one', () => {
  const values = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => { values.set(key, value); } };
  recordAuthSource(storage, 'http://127.0.0.1:5173/aaa/v1/login', undefined, undefined, true);
  assert.deepEqual(JSON.parse(values.get(fields.authSource)!), { url: null, environment: null });
});

test('records the browser-facing endpoint for a deployed site', () => {
  const values = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => { values.set(key, value); } };
  recordAuthSource(storage, 'https://example.test/aaa/v1/login', undefined, undefined, false);
  assert.deepEqual(JSON.parse(values.get(fields.authSource)!), {
    url: 'https://example.test/aaa/v1/login', environment: null,
  });
});
