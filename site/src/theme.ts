// src/theme.ts
import { createTheme } from "@mui/material";

export type DisplayMode = "light" | "dark";

export const lightMode = createTheme({
  palette: {
    primary: { main: "#005696", contrastText: "#ffffff" },
    secondary: { main: "#003366" },
    background: { default: "#e9ecef", paper: "#ffffff" },
    text: { primary: "#333333", secondary: "#666666" },
  },
  typography: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    h6: { fontWeight: 700, fontSize: "1.1rem" },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#005696",
          borderBottom: "2px solid #005696",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: "#f8f9fa", borderRight: "1px solid #dee2e6" },
      },
    },
  },
});

export const darkMode = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#0085eb", contrastText: "#000000" },
    secondary: { main: "#0052a5" },
  },
  typography: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    h6: { fontWeight: 700, fontSize: "1.1rem" },
  },
  components: {
    MuiCardContent : {
      styleOverrides: {
        root: {
          backgroundColor: "#000000"
        }
      }
    },
    MuiCardActions : {
      styleOverrides: {
        root: {
          backgroundColor: "#000000"
        }
      }
    },
  },
});
