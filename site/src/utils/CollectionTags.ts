import type { STACCollection } from '../types';

export type CollectionTag = 'sar' | 'aerial' | 'optical' | 'ceosArd';

export function getCollectionTags(collection: STACCollection): CollectionTag[] {
  const text = [collection.title, collection.description, ...(collection.keywords ?? [])].filter(Boolean).join(' ');
  const instruments = collection.summaries?.instruments;
  const instrumentText = Array.isArray(instruments) ? instruments.filter(value => typeof value === 'string').join(' ') : '';
  const tags: CollectionTag[] = [];
  const isAerial = /\baerial\b|\bair\s*photos?\b|\bphotograph(?:ie|ies)\s+a[eé]rienne/i.test(text);
  if (/\bsar\b|\bsynthetic\s+aperture\s+radar\b/i.test(`${text} ${instrumentText}`)
    || Object.keys(collection.summaries ?? {}).some(key => key.startsWith('sar:'))
    || collection.stac_extensions?.some(extension => /\/sar\//i.test(extension))) tags.push('sar');
  if (isAerial) tags.push('aerial');
  if (!isAerial && (/\boptical\b|\bmultispectral\b|\bhyperspectral\b|\breflectance\b/i.test(text)
    || /\b(?:MSI|OLCI|OLI|ETM\+?|AVHRR|MODIS|VIIRS)\b/i.test(instrumentText))) tags.push('optical');
  if (/\bCEOS[\s-]+(?:ARD|Analysis[\s-]+Ready[\s-]+Data)\b/i.test(text)) tags.push('ceosArd');
  return tags;
}