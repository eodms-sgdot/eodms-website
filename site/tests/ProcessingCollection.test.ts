import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isProcessingItem } from '../src/utils/ProcessingCollection.ts';
import { getAvailableProcessingJobSlots, getProcessingSubmissionCount } from '../src/utils/ProcessingJobCapacity.ts';

test('allows non-ScanSAR RADARSAT-1 Raw items and excludes other modes and collections', () => {
  assert.equal(isProcessingItem({ collection: 'Radarsat-1-Raw', properties: { beam_mode: 'Fine' } }), true);
  assert.equal(isProcessingItem({ collection: 'Radarsat-1-Raw', properties: { beam_mode: 'ScanSAR' } }), false);
  assert.equal(isProcessingItem({ collection: 'Radarsat-1-Raw', properties: { beam_mode: 'ScanSAR Narrow' } }), false);
  assert.equal(isProcessingItem({ collection: 'Radarsat-1-Raw', properties: {} }), false);
  assert.equal(isProcessingItem({ collection: 'Radarsat-1-FRED', properties: { beam_mode: 'Fine' } }), false);
  assert.equal(isProcessingItem({ collection: 'other-collection', properties: { beam_mode: 'Fine' } }), false);
});

test('limits submissions to available active processing job slots', () => {
  const jobs = [
    { type: 'process', jobID: 'accepted', status: 'accepted' as const },
    { type: 'process', jobID: 'running', status: 'running' as const },
    { type: 'process', jobID: 'finished', status: 'successful' as const },
  ];

  assert.equal(getAvailableProcessingJobSlots(null), 0);
  assert.equal(getAvailableProcessingJobSlots([]), 2);
  assert.equal(getAvailableProcessingJobSlots([jobs[0], jobs[2]]), 1);
  assert.equal(getAvailableProcessingJobSlots([jobs[0], jobs[1]]), 0);
  assert.equal(getAvailableProcessingJobSlots([jobs[0]], 1), 0);
});

test('submits as many processing jobs as both candidates and available slots allow', () => {
  assert.equal(getProcessingSubmissionCount(0, 2), 0);
  assert.equal(getProcessingSubmissionCount(3, 0), 0);
  assert.equal(getProcessingSubmissionCount(3, 2), 2);
  assert.equal(getProcessingSubmissionCount(1, 1), 1);
});
