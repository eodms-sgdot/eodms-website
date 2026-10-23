import { useEffect } from "react";
import { useMap } from "react-leaflet";
import * as EsriVector from "esri-leaflet-vector";
import type { Language } from "../../i18n";
import { localizeCanadaBasemapStyle, type BasemapStyleLayer } from "../../utils/BasemapStyle";

interface VectorTileLayerProps {
    url: string,
    language?: Language;
    attribution?: string;
    apiKey? : string
}

export function VectorTileLayer({ url, language, attribution, apiKey } : VectorTileLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !url) return;
    
    const customLayer = EsriVector.vectorTileLayer(url, {
      apiKey: apiKey,
      attribution: attribution,
      ...(language && { style: (style: { layers: BasemapStyleLayer[] }) => localizeCanadaBasemapStyle(style, language) }),
    });

    customLayer.addTo(map);

    // Clean up layer when component unmounts
    return () => {
        customLayer.remove();
    };
  }, [map, url, language, attribution, apiKey]);

  return null;
}