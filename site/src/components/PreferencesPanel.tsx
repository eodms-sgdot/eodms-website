import { useContext } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Popover,
  Button,
  IconButton,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  TextField,
  FormControl,
} from "@mui/material";
import { AppContext } from "../AppContext";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { getBaseMap, getBaseMaps, getBaseMapTitle, type BaseMapId } from "../basemaps";
// import SyncIcon from "@mui/icons-material/Sync";

interface PreferencesPanelProps {
  /** The anchor element controlling the popover visibility */
  anchorEl: HTMLButtonElement | null;
  /** The Callback fired when clicking outside the popover to close it */
  onClose: () => void;
}

export default function PreferencesPanel({
  anchorEl,
  onClose,
}: PreferencesPanelProps) {
  const {
    stacEndpoint,
    setStacEndpoint,
    displayMode,
    setDisplayMode,
    locationSearchProvider,
    setLocationSearchProvider,
    language,
    setLanguage,
    baseMapId,
    setBaseMapId,
    setBaseMapLayer,
    searchLimit,
    setSearchLimit,
    t,
  } = useContext(AppContext)!;
  const isOpen = Boolean(anchorEl);
  const isEndpointLocked = import.meta.env.VITE_LOCK_STAC_ENDPOINT === 'true';
  const availableLayers = getBaseMaps();

  return (
    <Popover
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <Box sx={{ p: 2, width: "80vw", maxWidth: 500, maxHeight: 400, overflowY: "auto" }}>
        <Typography variant="h6" color="primary" gutterBottom>
          {t("preferences")}
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{p: 1}}>
                <Box sx={{ display: "flex", alignItems: "left", gap: 1, flexDirection:'column' }} >
                  <Tooltip title={t('stacEndpoint')}>
                    <TextField 
                      size="small" 
                      value={stacEndpoint} 
                      onChange={(e) => setStacEndpoint(e.target.value)} 
                      label={t('stacEndpoint')} 
                      disabled={isEndpointLocked} 
                    />
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell
                sx={{
                  p: 1,
                  width: "75%",
                  maxWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <InputLabel>{t("baseMap")}: </InputLabel>
                  <Select
                    value={baseMapId}
                    label={t("baseMap")}
                    onChange={(e) => {
                      setBaseMapId(e.target.value as BaseMapId); 
                      setBaseMapLayer(getBaseMap(e.target.value as BaseMapId));
                    }}
                    size="small"
                  >
                    {availableLayers ? (
                      availableLayers.map((layer) => (
                        <MenuItem value={layer.name}>{getBaseMapTitle(layer, language)}</MenuItem>
                      ))
                    ) : (
                      <></>
                    )}
                  </Select>
                </Box>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{
                  p: 1,
                  width: "75%",
                  maxWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <InputLabel>{t("maxResults")}: </InputLabel>
                  <Select
                    value={searchLimit.toString()}
                    label={t("maxResults")}
                    onChange={(e) => setSearchLimit(Number(e.target.value))}
                    size="small"
                  >
                    <MenuItem value="10">10</MenuItem>
                    <MenuItem value="50">50</MenuItem>
                    <MenuItem value="100">100</MenuItem>
                    <MenuItem value="250">250</MenuItem>
                  </Select>
                </Box>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{
                  p: 1,
                  width: "75%",
                  maxWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <InputLabel>{t("language")}: </InputLabel>
                  <Tooltip title={t("languageEn")}>
                    <span>
                      <Button
                        color="primary"
                        onClick={() => setLanguage("en")}
                        sx={{ minWidth: 0, fontWeight: 900, ml: 1 }}
                        disabled={language === "en"}
                      >
                        EN
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={t("languageFr")}>
                    <span>
                      <Button
                        color="primary"
                        onClick={() => setLanguage("fr")}
                        sx={{ minWidth: 0, fontWeight: 900, ml: 1 }}
                        disabled={language === "fr"}
                      >
                        FR
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{
                  p: 1,
                  width: "75%",
                  maxWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <FormControl sx={{width: "100%"}} >
                  <InputLabel>{t("locationSearchProvider")}: </InputLabel>
                  <Select
                    size="small"
                    value={locationSearchProvider}
                    label={t("locationSearchProvider")}
                    onChange={(e) => setLocationSearchProvider(e.target.value)}
                  >
                    <MenuItem value="osm">{t("providerOsm")}</MenuItem>
                    <MenuItem value="geolocator">
                      {t("providerGeolocator")}
                    </MenuItem>
                  </Select>
                </FormControl>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{
                  p: 1,
                  width: "75%",
                  maxWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <InputLabel>{t("displayMode")}: </InputLabel>
                  <Tooltip title={t("lightMode")}>
                    <span>
                      <IconButton
                        onClick={() => setDisplayMode("light")}
                        color="inherit"
                        disabled={displayMode === "light"}
                      >
                        <Brightness7Icon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t("darkMode")}>
                    <span>
                      <IconButton
                        onClick={() => setDisplayMode("dark")}
                        color="inherit"
                        disabled={displayMode === "dark"}
                      >
                        <Brightness4Icon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {/*
                  <Tooltip title={t("syncSystem")}>
                    <IconButton
                      onClick={() =>
                        setDisplayMode(
                          window.matchMedia("(prefers-color-scheme: dark)")
                            .matches
                            ? "dark"
                            : "light",
                        )
                      }
                      color="inherit"
                    >
                      <SyncIcon />
                    </IconButton>
                  </Tooltip>
                  */}
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Popover>
  );
}
