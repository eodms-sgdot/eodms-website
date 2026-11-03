import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTourSteps } from '../src/config/tourSteps.config.ts';

test('French tour steps keep stable references and preserve the EODMS search action data', () => {
  const steps = getTourSteps('eodms', 'fr');
  const searchStep = steps.find((step) => step.id === 'search-button');

  assert.strictEqual(getTourSteps('eodms', 'fr'), steps);
  assert.equal(searchStep?.title, 'Lancer votre recherche');
  assert.equal(searchStep?.collectionId, 'RCMImageProducts');
  assert.equal(searchStep?.temporalOption, '1');
});

test('French NAPL steps also keep stable references', () => {
  const steps = getTourSteps('napl', 'fr');
  assert.strictEqual(getTourSteps('napl', 'fr'), steps);
  assert.equal(steps[4].title, 'Valise - votre sélection');
});