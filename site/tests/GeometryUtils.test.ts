import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getShortestLongitudeBounds, splitAntimeridianGeometry } from '../src/utils/Antimeridian.ts';

test('computes a short longitude extent for footprints crossing the dateline', () => {
  assert.deepEqual(getShortestLongitudeBounds([179, -179]), [179, 181]);
  assert.deepEqual(getShortestLongitudeBounds([-140, -50]), [-140, -50]);
});

test('splits a dateline-crossing polygon into bounded polygons', () => {
  const geometry = {
    type: 'Polygon' as const,
    coordinates: [[[179, 70], [-179, 70], [-179, 72], [179, 72], [179, 70]]],
  };
  const split = splitAntimeridianGeometry(geometry);

  assert.equal(split.type, 'MultiPolygon');
  if (split.type !== 'MultiPolygon') return;
  assert.equal(split.coordinates.length, 2);
  for (const polygon of split.coordinates) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        assert.ok(Math.abs(ring[index][0] - ring[index - 1][0]) <= 180);
      }
      assert.ok(ring.every(position => position[0] >= -180 && position[0] <= 180));
    }
  }
});

test('closes a circumpolar ring through the pole before splitting', () => {
  const geometry = {
    type: 'Polygon' as const,
    coordinates: [[[-135, 80], [-45, 80], [45, 80], [135, 80], [-135, 80]]],
  };
  const split = splitAntimeridianGeometry(geometry);

  assert.equal(split.type, 'MultiPolygon');
  if (split.type !== 'MultiPolygon') return;
  assert.ok(split.coordinates.flat(2).some(position => position[1] === 90));
});