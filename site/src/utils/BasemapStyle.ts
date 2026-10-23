import type { Language } from '../i18n';

export interface BasemapStyleLayer {
  id: string;
  type: string;
  layout?: Record<string, unknown>;
}

export function localizeCanadaBasemapStyle<Style extends { layers: BasemapStyleLayer[] }>(style: Style, language: Language): Style {
  const otherLanguage = language === 'en' ? /(?:^|[\s/_])(?:FR|French)(?=$|[\s/_])/i : /(?:^|[\s/_])(?:EN|English)(?=$|[\s/_])/i;
  return {
    ...style,
    layers: style.layers.map(layer => layer.type === 'symbol' && layer.layout?.['text-field'] && otherLanguage.test(layer.id)
      ? { ...layer, layout: { ...layer.layout, visibility: 'none' } }
      : layer),
  };
}