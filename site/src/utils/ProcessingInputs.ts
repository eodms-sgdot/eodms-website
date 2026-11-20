import type { ProcessDescription } from '../services/ProcessingService';
import type { STACItem } from '../types';

export function seedProcessingMetadata(candidate: Pick<STACItem, 'properties'>): Record<string, unknown> {
  const metadata = candidate.properties;
  return Object.fromEntries(Object.entries({
    uuid: metadata.segment_id,
    segment_id: metadata.segment_id,
    start_time: metadata.start_datetime ?? metadata.datetime,
    stop_time: metadata.end_datetime ?? metadata.datetime,
  }).filter(([, value]) => value != null));
}

export function formatProcessingInputBlocks(
  candidates: Pick<STACItem, 'properties'>[],
  description?: ProcessDescription,
): string {
  if (candidates.length === 0) return '{}';
  return candidates.map(candidate => JSON.stringify(
    description ? seedProcessingInputs(description, candidate) : seedProcessingMetadata(candidate),
    null,
    2,
  )).join('\n...\n');
}

export function seedProcessingInputs(description: ProcessDescription, candidate: Pick<STACItem, 'properties'>): Record<string, unknown> {
  const definitions = description.inputs;
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) return seedProcessingMetadata(candidate);
  const metadata = candidate.properties;
  const seeds: Record<string, unknown> = {
    ...seedProcessingMetadata(candidate),
    end_time: metadata.end_datetime ?? metadata.datetime,
  };
  return Object.fromEntries(Object.entries(definitions).flatMap(([name, definition]) => {
    if (seeds[name] != null) return [[name, seeds[name]]];
    if (definition && typeof definition === 'object' && 'default' in definition) return [[name, definition.default]];
    return [];
  }));
}

const itemInputNames = ['uuid', 'segment_id', 'start_time', 'end_time', 'stop_time'];

export function getProcessingInputsForCandidate(
  description: ProcessDescription,
  candidate: Pick<STACItem, 'properties'>,
  sharedInputs: Record<string, unknown>,
): Record<string, unknown> {
  const seeded = seedProcessingInputs(description, candidate);
  const inputs = { ...seeded, ...sharedInputs };
  itemInputNames.forEach(name => {
    if (name in seeded) inputs[name] = seeded[name];
    else delete inputs[name];
  });
  return inputs;
}
