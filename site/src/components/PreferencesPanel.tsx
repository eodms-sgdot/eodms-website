import { useContext } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Button,
  IconButton,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  FormControl,
} from "@mui/material";
import { AppContext } from "../AppContext";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { getBaseMap, getBaseMaps, getBaseMapTitle, type BaseMapId } from "../basemaps";
import Blind from "./Blind";
// import SyncIcon from "@mui/icons-material/Sync";

interface PreferencesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function PreferencesPanel({
  open,
  onClose,
}: PreferencesPanelProps) {
  const {
    displayMode,
    setDisplayMode,
    locationSearchProvider,
    setLocationSearchProvider,
    language,
    setLanguage,
    baseMapId,
    setBaseMapId,
    setBaseMapLayer,
    t,
  } = useContext(AppContext)!;
  const availableLayers = getBaseMaps();

  return (
    <Blind open={open} onClose={onClose} align="right" width={500}>
      <Box sx={{ px: 2, pb: 1 }}>
        <Typography variant="h6" color="primary" gutterBottom>
          {t("preferences")}
        </Typography>
        <Table size="small">
          <TableBody>
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
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1, textAlign: "right" }}>
          {t("version")} {import.meta.env.VITE_APP_VERSION} | {t("buildId")} {import.meta.env.VITE_BUILD_ID}
        </Typography>
      </Box>
    </Blind>
  );
}
