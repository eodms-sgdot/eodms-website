import { useEffect, useRef, useContext, useState } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet'; 
import L, { LatLng, type LeafletEvent } from 'leaflet';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { AppContext } from '../AppContext';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/assets/css/leaflet.css';
import type { STACItem } from '../types'; 
import { getLatLonCoordsFromGeometry } from '../utils/GeometryUtils';
import RotatedImageOverlay from 'react-leaflet-rotated-imageoverlay';
import type { SearchResult } from 'leaflet-geosearch/dist/providers/provider.js';
import { GeolocatorProvider } from './providers/GeolocatorProvider';
import { VectorTileLayer } from './layer/VectorTileLayer';
import { getBaseMapAttribution } from "../basemaps";

declare global { interface Window { L: typeof L; } }
window.L = L;

/**
 * Properties for the StacMap component.
 */
interface StacMapProps {
  /** Callback fired when a user successfully draws a rectangle on the map. Returns [W, S, E, N] */
  onAoiDrawn: (bbox: [number, number, number, number]) => void;
  /** Callback fired when a user selects a search result from GeoSearch */
  onLocationSelected: (bbox: [number, number, number, number]) => void;
  /** Bounding box coordinates used to programmatically animate and zoom the map */
  zoomBounds?: [number, number, number, number] | null;
  /** Array of STAC features retrieved from the search */
  searchResults?: STACItem[];
  /** Dictionary mapping STAC Item IDs to their assigned highlight color string */
  selectedFootprints?: Record<string, string>;
  /** Callback fired when a user clicks on a rendered GeoJSON footprint */
  onFeatureClick?: (id: string) => void;
  /** Dictionary mapping STAC Item IDs to the URL of their active thumbnail image */
  activeThumbnails?: Record<string, string>;
  /** Used to clear the current AOI */
  clearAoiTrigger?: number;
  /** Callback for updating the bbox in local storage*/
  setBbox: (bbox: string | null) => void;
}

interface DrawCreatedEvent extends L.LeafletEvent {
  layer: L.Rectangle;
}

/**
 * Function to clear the current AOI. 
 * 
 * @param trigger 
 * @param drawnItemsRef
 * @returns null
 */
function ClearAoiController({ trigger, drawnItemsRef }: { trigger?: number, drawnItemsRef: React.RefObject<L.FeatureGroup> }) {
  useEffect(() => {
    if (trigger) drawnItemsRef.current?.clearLayers();
  }, [trigger, drawnItemsRef]);
  return null;
}

/**
 * Invisible utility component that taps into the react-leaflet map context 
 * to programmatically fly to a specific bounding box.
 * * @param {Object} props
 * @param {[number, number, number, number] | null} props.bounds - The [W, S, E, N] bounds to zoom to.
 */
function MapZoomController({ bounds }: { bounds?: [number, number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]], { padding: [50, 50], animate: true });
    }
  }, [bounds, map]);
  return null;
}

/**
 * Attaches the Leaflet.Draw toolbar to the map and listens for completion events.
 * * @param {Object} props
 * @param {Function} props.onAoiDrawn - Callback to pass the generated BBOX up to the parent.
 * @param {Function} props.setBbox - Callback to clear the BBOX from local storage when it's removed.
 */
function DrawControl({ onAoiDrawn, onOpenCoordinateEntry, coordinateEntryLabel, drawnItemsRef, setBbox }: { 
  onAoiDrawn: (bbox: [number, number, number, number]) => void;
  onOpenCoordinateEntry: () => void;
  coordinateEntryLabel: string;
  drawnItemsRef: React.RefObject<L.FeatureGroup>;
  setBbox: (bbox: string | null) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    const drawnItems = drawnItemsRef.current;
    map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems, remove: true },
      draw: { polyline: false, polygon: false, circle: false, marker: false, circlemarker: false, rectangle: { showArea: false } },
    });
    
    map.addControl(drawControl);

    const drawToolbar = drawControl.getContainer()?.querySelector('.leaflet-draw-toolbar');
    if (drawToolbar instanceof HTMLElement) {
      const coordinateButton = L.DomUtil.create('a', 'leaflet-draw-coordinate-entry', drawToolbar);
      coordinateButton.href = '#';
      coordinateButton.title = coordinateEntryLabel;
      coordinateButton.setAttribute('role', 'button');
      coordinateButton.setAttribute('aria-label', coordinateEntryLabel);
      coordinateButton.textContent = 'XY';
      coordinateButton.style.backgroundImage = 'none';
      coordinateButton.style.color = '#333';
      coordinateButton.style.fontSize = '10px';
      coordinateButton.style.fontWeight = 'bold';
      coordinateButton.style.lineHeight = '26px';
      L.DomEvent.disableClickPropagation(coordinateButton);
      L.DomEvent.on(coordinateButton, 'click', (event) => {
        L.DomEvent.preventDefault(event);
        onOpenCoordinateEntry();
      });
    }
    
    const onDrawCreated = (e: L.LeafletEvent) => {
      const event = e as DrawCreatedEvent;
      console.log(event);
      drawnItems.clearLayers(); 
      drawnItems.addLayer(event.layer);
      const b = event.layer.getBounds();
      const bboxString = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
      setBbox(bboxString);
      onAoiDrawn([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    
    const onDrawDeleted = (e: L.LeafletEvent) => {
      const event = e as DrawCreatedEvent;
      
      if(event && setBbox) {
        setBbox(null);
      }
    };

    map.on(L.Draw.Event.CREATED, onDrawCreated);
    map.on(L.Draw.Event.DELETED, onDrawDeleted);
    
    return () => { 
      map.removeControl(drawControl); 
      map.off(L.Draw.Event.CREATED, onDrawCreated); 
      map.off(L.Draw.Event.DELETED, onDrawDeleted);
    };
  }, [map, onAoiDrawn, onOpenCoordinateEntry, coordinateEntryLabel, drawnItemsRef, setBbox]);
  
  return null;
}

function SearchControl({onLocationSelected, searchLabel, drawnItemsRef, selectedProvider}: {
  onLocationSelected: (bbox: [number, number, number, number]) => void;
  searchLabel: string;
  drawnItemsRef: React.RefObject<L.FeatureGroup>;
  selectedProvider: string;
}) {
  const map = useMap();
  
  useEffect(() => {

    const drawnItems = drawnItemsRef.current;
    map.addLayer(drawnItems);
    
    const provider = selectedProvider === 'osm' ? new OpenStreetMapProvider() : new GeolocatorProvider();

    const searchControl = new (GeoSearchControl as unknown as new (options: object) => L.Control)({
      provider: provider,
      style: 'button',
      autoClose: true,
      keepResult: true,
      retainZoomLevel: true,
      showMarker: false,
      searchLabel: searchLabel + '...',
    });

    const handleShowLocation = (event:LeafletEvent) => {

      drawnItemsRef.current?.clearLayers();
      const result = event as LeafletEvent & {location: SearchResult}
      const b = result.location.bounds;
      if (b) {
        // Leaflet geosearch returns bounds [[S,W],[N,E]]
        const southWest = L.latLng(b[0][0], b[0][1]);
        const northEast = L.latLng(b[1][0], b[1][1]);
        const bounds = L.latLngBounds(southWest, northEast);

        // Draw the bounding box on the map
        const rectangle = L.rectangle(bounds, {
          color: '#3388ff',
          weight: 4,
          opacity: 0.5,
          fillColor: '#3388ff',
          fillOpacity: 0.2,
        });
        drawnItemsRef.current?.addLayer(rectangle);

        onLocationSelected([b[0][1], b[0][0], b[1][1], b[1][0]]);
      }
    };
    
    map.addControl(searchControl);
    map.on('geosearch/showlocation', handleShowLocation);

    return () => {
      map.removeControl(searchControl);
      map.off('geosearch/showlocation', handleShowLocation);
    };
  }, [map, searchLabel, onLocationSelected, drawnItemsRef, selectedProvider]);

  return null;
}

/**
 * Main map component that renders the base layer, drawing tools, STAC footprints, and image overlays.
 * * @param {StacMapProps} props - The properties applied to the map.
 * @returns {JSX.Element} The rendered React-Leaflet MapContainer.
 */
export default function StacMap({ onAoiDrawn, onLocationSelected, zoomBounds, searchResults = [], selectedFootprints = {}, onFeatureClick, activeThumbnails = {}, clearAoiTrigger, setBbox }: StacMapProps) {
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const { language, locationSearchProvider, baseMapLayer, t } = useContext(AppContext)!; 
  const [coordinateDialogOpen, setCoordinateDialogOpen] = useState(false);
  const [coordinateValues, setCoordinateValues] = useState(['', '']);
  const [coordinateError, setCoordinateError] = useState(false);
  const [coordinateZoomBounds, setCoordinateZoomBounds] = useState<[number, number, number, number] | null>(null);
  const coordinateLabels = [t('longitude'), t('latitude')];
  const handleOpenCoordinateEntry = () => {
    setCoordinateValues(['', '']);
    setCoordinateError(false);
    setCoordinateDialogOpen(true);
  };
  const handleCoordinateSubmit = () => {
    const coordinates = coordinateValues.map(value => value.trim() === '' ? NaN : Number(value));
    const [longitude, latitude] = coordinates;
    const buffer = 0.1;
    if (!coordinates.every(Number.isFinite) || longitude < -180 + buffer || longitude > 180 - buffer || latitude < -90 + buffer || latitude > 90 - buffer) {
      setCoordinateError(true);
      return;
    }

    const bbox: [number, number, number, number] = [
      Number((longitude - buffer).toFixed(10)),
      Number((latitude - buffer).toFixed(10)),
      Number((longitude + buffer).toFixed(10)),
      Number((latitude + buffer).toFixed(10)),
    ];
    const rectangle = L.rectangle([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
    drawnItemsRef.current?.clearLayers();
    drawnItemsRef.current?.addLayer(rectangle);
    setBbox(bbox.join(','));
    setCoordinateZoomBounds(bbox);
    setCoordinateDialogOpen(false);
    onAoiDrawn(bbox);
  };
  
  return (
    <MapContainer center={[56.13, -106.34]} zoom={4} style={{ height: '100%', width: '100%' }}>
      { baseMapLayer ? (
        baseMapLayer.type === "tile" ? (
          <TileLayer key={baseMapLayer.name + language} url={baseMapLayer.url} attribution={getBaseMapAttribution(baseMapLayer, language)} />
        ) : baseMapLayer.type === "vectortile" ? (
          <VectorTileLayer key={baseMapLayer.name + language} url={baseMapLayer.url} attribution={getBaseMapAttribution(baseMapLayer, language)} />
        ) : (
          <></> // Invalid layer type
        )
      ) : (
        <></> // No layer found
      )
      }
      <SearchControl onLocationSelected={onLocationSelected} searchLabel={t('locationPlaceholder')} drawnItemsRef={drawnItemsRef} selectedProvider={locationSearchProvider}/>
      <DrawControl onAoiDrawn={onAoiDrawn} onOpenCoordinateEntry={handleOpenCoordinateEntry} coordinateEntryLabel={t('coordinateEntry')} drawnItemsRef={drawnItemsRef} setBbox={setBbox}/>
      <ClearAoiController trigger={clearAoiTrigger} drawnItemsRef={drawnItemsRef} />
      <MapZoomController bounds={zoomBounds} />
      <MapZoomController bounds={coordinateZoomBounds} />

      <Dialog open={coordinateDialogOpen} onClose={() => setCoordinateDialogOpen(false)}>
        <DialogTitle>{t('coordinateEntry')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('coordinateBuffer')}</DialogContentText>
          {coordinateError && <Alert severity="error" sx={{ mb: 2 }}>{t('invalidCoordinates')}</Alert>}
          {coordinateLabels.map((label, index) => (
            <TextField
              key={label}
              autoFocus={index === 0}
              margin="dense"
              label={label}
              type="number"
              slotProps={{ htmlInput: { step: 'any' } }}
              value={coordinateValues[index]}
              onChange={event => setCoordinateValues(values => values.map((value, valueIndex) => valueIndex === index ? event.target.value : value))}
              fullWidth
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCoordinateDialogOpen(false)}>{t('cancel')}</Button>
          <Button onClick={handleCoordinateSubmit} variant="contained">{t('apply')}</Button>
        </DialogActions>
      </Dialog>

      {searchResults.map(item => {
        const isSelected = !!selectedFootprints[item.id];
        const color = isSelected ? selectedFootprints[item.id] : '#888888';
        return (
          <GeoJSON
            key={`footprint-${item.id}-${isSelected}`}
            data={item}
            style={{ color, weight: isSelected ? 3 : 1, opacity: 0.6, fillColor: color, fillOpacity: isSelected ? 0.3 : 0.05 }}
            onEachFeature={(_, layer) => { layer.on('click', () => onFeatureClick?.(item.id)); }}
          />
        );
      })}

      {Object.entries(activeThumbnails).map(([id, url]) => {
        const item = searchResults.find(s => s.id === id);
        if (!item || !item.geometry) return null;

        const coords = getLatLonCoordsFromGeometry(item.geometry);
        
        if(coords) {
          return (
            <RotatedImageOverlay
              imgSrc={url}
              bottomleft={new LatLng(coords[1][0], coords[1][1])}
              topleft={new LatLng(coords[0][0], coords[0][1])}
              topright={new LatLng(coords[3][0], coords[3][1])}
              options={{ zIndex: 1000, opacity: 0.9 }}
            />
          );
        }
      })}
    </MapContainer>
  );
}