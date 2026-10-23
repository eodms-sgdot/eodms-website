import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localizeCanadaBasemapStyle } from '../src/utils/BasemapStyle.ts';

test('hides only opposite-language text layers across Canada basemap naming conventions', () => {
  const names = ['Label EN', 'Places_EN', 'Large_English', 'Countries/English/label', 'River EN/point',
    'Label FR', 'Places_FR', 'Medium_French', 'Countries/French/label', 'River FR/point', 'Route Number'];
  const style = {
    version: 8,
    sources: { esri: { type: 'vector' } },
    layers: names.map(id => ({ id, type: 'symbol', layout: { 'text-field': '{_name}', visibility: 'visible' } })),
  };
  for (const language of ['en', 'fr'] as const) {
    const result = localizeCanadaBasemapStyle(style, language);
    assert.equal(result.version, style.version);
    assert.equal(result.sources, style.sources);
    result.layers.forEach((layer, index) => {
      const hidden = language === 'en' ? index >= 5 && index < 10 : index < 5;
      assert.equal(layer.layout.visibility, hidden ? 'none' : 'visible', `${language}: ${layer.id}`);
      assert.equal(style.layers[index].layout.visibility, 'visible');
    });
  }
});

test('preserves neutral labels, non-text symbols, geometry, and existing visibility', () => {
  const style = { layers: [
    { id: 'French River', type: 'line', layout: {} },
    { id: 'Capital FR', type: 'symbol', layout: { 'icon-image': 'capital' } },
    { id: 'Route Number', type: 'symbol', layout: { 'text-field': '{_name}', visibility: 'none' } },
    { id: 'Infrastructure', type: 'symbol', layout: { 'text-field': '{_name}' } },
    { id: 'Background', type: 'background' },
  ] };
  const result = localizeCanadaBasemapStyle(style, 'en');
  result.layers.forEach((layer, index) => assert.equal(layer, style.layers[index]));
});