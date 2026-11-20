import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatProcessingInputBlocks, getProcessingInputsForCandidate, seedProcessingInputs } from '../src/utils/ProcessingInputs.ts';

test('seeds RADARSAT-1 Raw process inputs from segment_id and acquisition times', () => {
  const candidate = {
    properties: {
      segment_id: 'raw-segment-123',
      start_datetime: '2024-01-02T03:04:05Z',
      end_datetime: '2024-01-02T03:10:05Z',
      datetime: '2024-01-02T03:04:05Z',
    },
  };

  assert.deepEqual(seedProcessingInputs({
    id: 'r1-process',
    version: '1',
    inputs: { uuid: {}, segment_id: {}, start_time: {}, stop_time: {} },
  }, candidate), {
    uuid: 'raw-segment-123',
    segment_id: 'raw-segment-123',
    start_time: '2024-01-02T03:04:05Z',
    stop_time: '2024-01-02T03:10:05Z',
  });
});

test('uses each cart item metadata while preserving shared inputs', () => {
  const description = {
    id: 'r1-process',
    version: '1',
    inputs: { uuid: {}, segment_id: {}, start_time: {}, stop_time: {}, lookup_table: {} },
  };
  const candidate = {
    properties: {
      segment_id: 'raw-segment-456',
      start_datetime: '2024-02-03T04:05:06Z',
      end_datetime: '2024-02-03T04:11:06Z',
    },
  };

  assert.deepEqual(getProcessingInputsForCandidate(description, candidate, {
    uuid: 'raw-segment-123',
    segment_id: 'raw-segment-123',
    start_time: '2024-01-02T03:04:05Z',
    stop_time: '2024-01-02T03:10:05Z',
    lookup_table: 'custom-table',
  }), {
    uuid: 'raw-segment-456',
    segment_id: 'raw-segment-456',
    start_time: '2024-02-03T04:05:06Z',
    stop_time: '2024-02-03T04:11:06Z',
    lookup_table: 'custom-table',
  });
});

test('formats one JSON input block per eligible candidate', () => {
  const candidates = [
    { properties: { segment_id: 'segment-1', datetime: '2024-01-02T03:04:05Z' } },
    { properties: { segment_id: 'segment-2', datetime: '2024-02-03T04:05:06Z' } },
  ];

  assert.equal(formatProcessingInputBlocks(candidates), [
    '{',
    '  "uuid": "segment-1",',
    '  "segment_id": "segment-1",',
    '  "start_time": "2024-01-02T03:04:05Z",',
    '  "stop_time": "2024-01-02T03:04:05Z"',
    '}',
    '...',
    '{',
    '  "uuid": "segment-2",',
    '  "segment_id": "segment-2",',
    '  "start_time": "2024-02-03T04:05:06Z",',
    '  "stop_time": "2024-02-03T04:05:06Z"',
    '}',
  ].join('\n'));
});

test('keeps compatibility with process descriptions that still declare end_time', () => {
  const candidate = {
    properties: {
      segment_id: 'raw-segment-789',
      start_datetime: '2024-03-04T05:06:07Z',
      end_datetime: '2024-03-04T05:12:07Z',
    },
  };
  assert.deepEqual(seedProcessingInputs({
    id: 'r1-process',
    version: '1',
    inputs: { uuid: {}, start_time: {}, end_time: {} },
  }, candidate), {
    uuid: 'raw-segment-789',
    start_time: '2024-03-04T05:06:07Z',
    end_time: '2024-03-04T05:12:07Z',
  });
});
