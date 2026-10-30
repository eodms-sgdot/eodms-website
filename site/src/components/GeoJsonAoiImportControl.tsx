import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, CircularProgress, IconButton, Snackbar, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { AppContext } from '../AppContext';
import { AoiImportError, MAX_AOI_FILE_BYTES, parseGeoJsonAoi, type AoiErrorKey, type AoiGeometry } from '../utils/GeoJsonAoi';

interface GeoJsonAoiImportControlProps {
  container: HTMLElement;
  onImport: (geometry: AoiGeometry, bounds: [number, number, number, number]) => void;
}

export default function GeoJsonAoiImportControl({ container, onImport }: GeoJsonAoiImportControlProps) {
  const map = useMap();
  const theme = useTheme();
  const { t } = useContext(AppContext)!;
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AoiErrorKey | null>(null);

  useEffect(() => {
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return () => {
      requestRef.current = -1;
    };
  }, [container]);

  return createPortal(<>
    <Tooltip title={t('importGeoJsonAoiTooltip')} placement="right" slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line' } } }}>
      <span>
        <IconButton aria-label={t('importGeoJsonAoi')} disabled={loading} onClick={() => inputRef.current?.click()}
          sx={{ width: 30, height: 30, borderRadius: 0, color: 'text.primary', bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover } }}>
          {loading ? <CircularProgress size={18} /> : <FileUploadOutlinedIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
    <input ref={inputRef} type="file" accept=".geojson,.json,application/geo+json,application/json" hidden
      aria-label={t('importGeoJsonAoi')}
      onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        const request = ++requestRef.current;
        setLoading(true);
        setError(null);
        try {
          if (file.size > MAX_AOI_FILE_BYTES) throw new AoiImportError('aoiFileTooLarge');
          const geometry = parseGeoJsonAoi(await file.text());
          if (request !== requestRef.current) return;
          const bounds = L.geoJSON(geometry).getBounds();
          onImport(geometry, [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
        } catch (failure) {
          if (request === requestRef.current) setError(failure instanceof AoiImportError ? failure.translationKey : 'aoiInvalidGeoJson');
        } finally {
          if (request === requestRef.current) setLoading(false);
        }
      }} />
    <Snackbar open={error !== null} autoHideDuration={8000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="error" onClose={() => setError(null)}>{error && t(error)}</Alert>
    </Snackbar>
  </>, container);
}