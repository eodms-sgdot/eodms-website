import { useEffect } from "react";
import { useMap } from "react-leaflet";
import * as EsriVector from "esri-leaflet-vector";

interface VectorTileLayerProps {
    url: string,
    attribution?: string;
    apiKey? : string
}

export function VectorTileLayer({ url, attribution, apiKey } : VectorTileLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !url) return;
    
    const customLayer = EsriVector.vectorTileLayer(url, {
      apiKey: apiKey,
      attribution: attribution
    });

    customLayer.addTo(map);

    // Clean up layer when component unmounts
    return () => {
        customLayer.remove();
    };
  }, [map, url, attribution, apiKey]);

  return null;
}