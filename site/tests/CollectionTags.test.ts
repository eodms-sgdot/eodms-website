import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCollectionTags } from '../src/utils/CollectionTags.ts';

const collection = { id: 'example', description: '', links: [] };

test('classifies SAR from keywords, instruments, summaries, extensions, or description', () => {
  for (const metadata of [
    { keywords: ['sar'] }, { summaries: { instruments: ['SAR'] } },
    { summaries: { 'sar:frequency_band': ['C'] } },
    { stac_extensions: ['https://stac-extensions.github.io/sar/v1.0.0/schema.json'] },
    { description: 'Raw signal data which can be processed to generate SAR images.' },
  ]) assert.deepEqual(getCollectionTags({ ...collection, ...metadata }), ['sar']);
});

test('recognizes aerial photography and optical instruments without collection ID mappings', () => {
  assert.deepEqual(getCollectionTags({ ...collection, description: 'A collection of aerial photographs.' }), ['aerial']);
  assert.deepEqual(getCollectionTags({ ...collection, title: 'Surveyors General Branch Air Photos' }), ['aerial']);
  assert.deepEqual(getCollectionTags({ ...collection, keywords: ['aerial', 'optical'] }), ['aerial']);
  for (const instrument of ['MSI', 'OLCI']) {
    assert.deepEqual(getCollectionTags({ ...collection, summaries: { instruments: [instrument] } }), ['optical']);
  }
  assert.deepEqual(getCollectionTags({ ...collection, description: 'Multispectral imagery' }), ['optical']);
});

test('adds CEOS-ARD alongside the sensor type but does not treat all ARD as CEOS-ARD', () => {
  assert.deepEqual(getCollectionTags({ ...collection, title: 'RADARSAT-1, CEOS-ARD', keywords: ['SAR'] }), ['sar', 'ceosArd']);
  assert.deepEqual(getCollectionTags({ ...collection, description: 'CEOS Analysis Ready Data', keywords: ['sar'] }), ['sar', 'ceosArd']);
  assert.deepEqual(getCollectionTags({ ...collection, title: 'Analysis Ready Data' }), []);
});

test('leaves unknown collections untagged and tolerates non-array instrument summaries', () => {
  assert.deepEqual(getCollectionTags(collection), []);
  assert.deepEqual(getCollectionTags({ ...collection, summaries: { instruments: { description: 'unknown' } } }), []);
  assert.deepEqual(getCollectionTags({ ...collection, keywords: ['eo', 'COG'] }), []);
});