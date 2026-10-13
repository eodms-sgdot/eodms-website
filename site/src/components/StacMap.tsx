import { useEffect, useMemo, useRef, useContext, useState } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON, Marker } from 'react-leaflet'; 
import L, { LatLng, type LeafletEvent } from 'leaflet';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, GlobalStyles, TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AppContext } from '../AppContext';
import { getHighlightColor } from '../theme';
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
  selectedFootprints?: ReadonlySet<string>;
  /** Callback fired when a user clicks on a rendered GeoJSON footprint */
  onFeatureClick?: (id: string) => void;
  /** The ID of the item currently hovered on the map or in the results list */
  hoveredItem?: string | null;
  /** Callback fired when the pointer enters or leaves a footprint */
  onHoverItem?: (id: string | null) => void;
  /** Added to each result's list position to number it across pages */
  numberOffset?: number;
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
      // On mobile the results panel closes in the same update, so the map was 0px wide until now.
      map.invalidateSize({ animate: false });
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
    const deleteButton = drawControl.getContainer()?.querySelector<HTMLAnchorElement>('.leaflet-draw-edit-remove');
    const updateDeleteButtonState = () => {
      deleteButton?.classList.toggle('stac-delete-available', drawnItems.getLayers().length > 0);
    };
    drawnItems.on('layeradd layerremove', updateDeleteButtonState);
    updateDeleteButtonState();

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
      drawnItems.off('layeradd layerremove', updateDeleteButtonState);
      map.removeControl(drawControl); 
      map.off(L.Draw.Event.CREATED, onDrawCreated); 
      map.off(L.Draw.Event.DELETED, onDrawDeleted);
    };
  }, [map, onAoiDrawn, onOpenCoordinateEntry, coordinateEntryLabel, drawnItemsRef, setBbox]);
  
  return null;
}

const POINT_BUFFER_DEG = 0.1;

/**
 * Drops a crosshair with a "Search here" chip wherever the user clicks on empty map.
 * Ignores clicks that finish a draw, edit or delete gesture.
 */
function ClickToSearch({ onSearchHere, label, color }: { onSearchHere: (longitude: number, latitude: number) => void; label: string; color: string }) {
  const map = useMap();
  const [point, setPoint] = useState<LatLng | null>(null);

  const icon = useMemo(() => L.divIcon({
    className: 'stac-search-here',
    // Zero size so the crosshair centre sits exactly on the clicked point.
    iconSize: [0, 0],
    html: `<span class="target" style="color:${color}"><svg width="28" height="28" viewBox="-14 -14 28 28" fill="none" stroke="currentColor" stroke-width="2">`
      + `<circle class="pulse" r="8"/><circle r="8" fill="rgba(255,255,255,0.35)"/>`
      + `<path d="M0 -13V-9M0 9V13M-13 0H-9M9 0H13"/><circle r="1.5" fill="currentColor" stroke="none"/></svg></span>`
      + `<span class="chip" style="background:${color}">${label} &rarr;</span>`,
  }), [label, color]);

  useEffect(() => {
    let toolActive = false;
    let toolStoppedAt = 0;
    const onToolStart = () => { toolActive = true; setPoint(null); };
    const onToolStop = () => { toolActive = false; toolStoppedAt = Date.now(); };
    // The click that ends a rectangle drag arrives just after draw:drawstop.
    const onClick = (e: L.LeafletMouseEvent) => {
      if (!toolActive && Date.now() - toolStoppedAt > 300) setPoint(e.latlng.wrap());
    };
    const onKeyDown = (e: L.LeafletKeyboardEvent) => {
      if (e.originalEvent.key === 'Escape') setPoint(null);
    };

    const startEvents = [L.Draw.Event.DRAWSTART, L.Draw.Event.EDITSTART, L.Draw.Event.DELETESTART];
    const stopEvents = [L.Draw.Event.DRAWSTOP, L.Draw.Event.EDITSTOP, L.Draw.Event.DELETESTOP];
    startEvents.forEach(ev => map.on(ev, onToolStart));
    stopEvents.forEach(ev => map.on(ev, onToolStop));
    map.on('click', onClick);
    map.on('keydown', onKeyDown);
    return () => {
      startEvents.forEach(ev => map.off(ev, onToolStart));
      stopEvents.forEach(ev => map.off(ev, onToolStop));
      map.off('click', onClick);
      map.off('keydown', onKeyDown);
    };
  }, [map]);

  if (!point) return null;
  return (
    <Marker
      position={point}
      icon={icon}
      title={label}
      alt={label}
      zIndexOffset={2000}
      eventHandlers={{ click: () => { onSearchHere(point.lng, point.lat); setPoint(null); } }}
    />
  );
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
      retainZoomLevel: false,
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
        map.fitBounds(bounds, { padding: [50, 50], animate: true });

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
const FOOTPRINT_STAGGER_MS = 35;
const FOOTPRINT_STAGGER_MAX_MS = 700;
// Reusing icon instances stops Leaflet re-rendering chips (and replaying their animation) on every render.
const chipIconCache = new Map<string, L.DivIcon>();
const EMPTY_SET: ReadonlySet<string> = new Set();

const footprintStyles = (
  <GlobalStyles styles={{
    '@keyframes stacFootprintIn': {
      from: { opacity: 0, transform: 'scale(0.85)' },
      to: { opacity: 1, transform: 'none' },
    },
    '.stac-footprint': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      animation: 'stacFootprintIn 450ms cubic-bezier(0.2, 0.8, 0.2, 1.2) both',
      transition: 'fill-opacity 150ms ease, stroke-opacity 150ms ease, stroke-width 150ms ease',
    },
    '.stac-footprint-chip span': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      borderRadius: '12px',
      border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
      font: '700 12px/1 "Helvetica Neue", Helvetica, Arial, sans-serif',
      animation: 'stacFootprintIn 250ms ease-out both',
    },
    '@keyframes stacSearchPulse': {
      from: { transform: 'scale(1)', opacity: 0.8 },
      to: { transform: 'scale(2.2)', opacity: 0 },
    },
    '.stac-search-here': { overflow: 'visible', cursor: 'pointer' },
    '.stac-search-here .target': { position: 'absolute', left: -14, top: -14, width: 28, height: 28, display: 'block' },
    '.stac-search-here .pulse': { transformBox: 'fill-box', transformOrigin: 'center', animation: 'stacSearchPulse 1.6s ease-out infinite' },
    '.stac-search-here .chip': {
      position: 'absolute',
      left: 18,
      top: -13,
      height: 26,
      padding: '0 10px',
      display: 'flex',
      alignItems: 'center',
      borderRadius: 13,
      color: '#fff',
      whiteSpace: 'nowrap',
      font: '600 13px/1 "Helvetica Neue", Helvetica, Arial, sans-serif',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      transformOrigin: 'left center',
      animation: 'stacFootprintIn 200ms ease-out both',
      transition: 'filter 120ms ease',
    },
    '.leaflet-draw-toolbar .leaflet-draw-edit-remove.stac-delete-available': {
      backgroundImage: 'none',
      position: 'relative',
    },
    '.leaflet-draw-toolbar .leaflet-draw-edit-remove.stac-delete-available::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 18,
      height: 18,
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#d32f2f',
      maskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 9h2v9H8zm6 0h2v9h-2zM18 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 7v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6z'/%3E%3C/svg%3E\")",
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      maskSize: 'contain',
      WebkitMaskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 9h2v9H8zm6 0h2v9h-2zM18 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 7v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6z'/%3E%3C/svg%3E\")",
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      WebkitMaskSize: 'contain',
    },
    '.stac-search-here:hover .chip, .stac-search-here:focus-visible .chip': { filter: 'brightness(1.15)' },
    '@media (prefers-reduced-motion: reduce)': {
      '.stac-footprint, .stac-footprint-chip span, .stac-search-here .chip, .stac-search-here .pulse': { animation: 'none', transition: 'none' },
    },
  }} />
);

export default function StacMap({ onAoiDrawn, onLocationSelected, zoomBounds, searchResults = [], selectedFootprints = EMPTY_SET, onFeatureClick, hoveredItem = null, onHoverItem, numberOffset = 0, activeThumbnails = {}, clearAoiTrigger, setBbox }: StacMapProps) {
  const theme = useTheme();
  const brandColor = theme.palette.primary.main;
  const highlightColor = getHighlightColor(theme.palette.mode);
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
    const buffer = POINT_BUFFER_DEG;
    if (!coordinates.every(Number.isFinite) || longitude < -180 + buffer || longitude > 180 - buffer || latitude < -90 + buffer || latitude > 90 - buffer) {
      setCoordinateError(true);
      return;
    }

    setCoordinateDialogOpen(false);
    searchAroundPoint(longitude, latitude, true);
  };

  const searchAroundPoint = (longitude: number, latitude: number, zoom: boolean) => {
    const buffer = POINT_BUFFER_DEG;
    const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit + buffer), limit - buffer);
    const lon = clamp(longitude, 180);
    const lat = clamp(latitude, 90);
    const bbox: [number, number, number, number] = [
      Number((lon - buffer).toFixed(10)),
      Number((lat - buffer).toFixed(10)),
      Number((lon + buffer).toFixed(10)),
      Number((lat + buffer).toFixed(10)),
    ];
    const rectangle = L.rectangle([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
    drawnItemsRef.current?.clearLayers();
    drawnItemsRef.current?.addLayer(rectangle);
    setBbox(bbox.join(','));
    if (zoom) setCoordinateZoomBounds(bbox);
    onAoiDrawn(bbox);
  };
  
  return (
    <>
    {footprintStyles}
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
      <ClickToSearch onSearchHere={(lon, lat) => searchAroundPoint(lon, lat, false)} label={t('searchHere')} color={brandColor} />

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

      {searchResults.map((item, index) => {
        const isSelected = selectedFootprints.has(item.id);
        const isHovered = item.id === hoveredItem;
        const color = isSelected ? highlightColor : brandColor;
        const style: L.PathOptions = { className: 'stac-footprint', ...(isSelected
          ? { color, weight: isHovered ? 4 : 3, opacity: 0.9, fillColor: color, fillOpacity: isHovered ? 0.35 : 0.25 }
          : isHovered
            ? { color, weight: 2, opacity: 1, fillColor: color, fillOpacity: 0.25 }
            : { color, weight: 1, opacity: 0.3, fillColor: color, fillOpacity: 0.08 }) };
        const delay = Math.min(index * FOOTPRINT_STAGGER_MS, FOOTPRINT_STAGGER_MAX_MS);
        return (
          <GeoJSON
            key={`footprint-${item.id}`}
            data={item}
            style={style}
            onEachFeature={(_, layer) => {
              layer.on('add', () => {
                const el = (layer as L.Path).getElement() as SVGElement | undefined;
                if (el) el.style.animationDelay = `${delay}ms`;
              });
            }}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); onFeatureClick?.(item.id); },
              mouseover: () => onHoverItem?.(item.id),
              mouseout: () => onHoverItem?.(null),
            }}
          />
        );
      })}

      {searchResults.map((item, index) => {
        const isSelected = selectedFootprints.has(item.id);
        if ((!isSelected && item.id !== hoveredItem) || !item.geometry) return null;
        const color = isSelected ? highlightColor : brandColor;
        const number = numberOffset + index + 1;
        const iconKey = `${number}|${color}`;
        let icon = chipIconCache.get(iconKey);
        if (!icon) {
          icon = L.divIcon({
            className: 'stac-footprint-chip',
            html: `<span style="background:${color};color:${theme.palette.getContrastText(color)}">${number}</span>`,
            iconSize: [number >= 100 ? 32 : 24, 24],
          });
          chipIconCache.set(iconKey, icon);
        }
        return (
          <Marker
            key={`chip-${item.id}-${isSelected}`}
            position={L.geoJSON(item).getBounds().getCenter()}
            icon={icon}
            interactive={isSelected}
            eventHandlers={{
              click: () => onFeatureClick?.(item.id),
              mouseover: () => onHoverItem?.(item.id),
              mouseout: () => onHoverItem?.(null),
            }}
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
    </>
  );
}