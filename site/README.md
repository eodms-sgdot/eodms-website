# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Local Development

Install dependencies once:

```cmd
cd site
npm install
cd server
npm install
```

From the repository root, start the AAA proxy and frontend in separate
terminals with:

```cmd
site\dev.cmd
```

Or, from this directory:

```cmd
dev.cmd
```

The launcher runs `npm run start` in `site\server` and `npm run dev` in `site`.
To stop each process, close its terminal window or press `Ctrl+C` there.

Vite proxies `/aaa` through the local API proxy and routes `/search`, `/dds`,
and `/processing` to the selected target. In `proxy` mode, all four API families
use the same `EODMS_PROXY_PORT`. Production builds retain the relative paths;
the production host is responsible for serving them.

For local development, copy `.env.example` to `.env.local`:

```cmd
cd site
copy .env.example .env.local
```

`EODMS_TARGET_ENV=staging` selects the upstream for local AAA, search, DDS, and
processing requests. Change it to `production` to switch those routes to the
production domain. Set it to `proxy` with `EODMS_PROXY_PORT` to route all four
through one local port-forwarded endpoint that serves the same API paths.
`/napl` always targets staging. Restart Vite and the local API proxy after
changing the setting. Local environment files are ignored by
Git; update `.env.example` when adding configuration variables. Staging builds
and deployments use the relative `/napl/v1` URL directly and do not need the
local proxy or domain variables.

The NAPL experience is available whenever the app shows the `STAGING` badge, and
always on the local Vite development server (including `EODMS_TARGET_ENV=production`).
The staging check is determined at runtime from the active STAC endpoint, so the
same build can be deployed to staging and production. On production deployments,
`/napl` redirects to the main experience.

The app automatically shows the `PROXY` badge when running through the local
Vite development server. No environment setting is needed.

## Basemaps

Preferences offers OpenStreetMap, Canada Basemap - Transportation, and Arctic
SDI. Arctic SDI uses the `arctic_cascading` WMTS layer with the Canada-centered
EPSG:3573 tile matrix (zoom levels 0-10), rather than Web Mercator.
The map supports overzoom through level 18 for small result footprints: beyond
level 10 it scales the highest-resolution WMTS tiles without requesting
unsupported tile levels. This enlarges the map without adding source detail.

Switching between Arctic SDI and a Web Mercator basemap recreates the map,
including its drawing layers and interaction handlers. Search results, selected
items, and the current area of interest are retained. Every basemap change fits
the selected map's advertised native extent: the global Web Mercator tile grid
for OpenStreetMap and Canada Basemap, or the EPSG:3573 grid advertised by Arctic
SDI. This takes priority over previous result/AOI zooms on switching; subsequent
result and coordinate zoom actions still work normally. On initial load, result
zooms take priority over the saved area of interest. Arctic result extents are
fitted at fractional zoom levels in projected coordinates, including the curvature
of polar parallels. Density checks likewise
use projected coordinates. Zoom transitions are disabled so finite polar
coordinates are not extrapolated during animation, and pending zoom callbacks
cannot target a map removed by a basemap switch. Arctic panning is constrained
to the service's projected grid, with a viewport-dependent minimum zoom to
keep viewport corners inside the finite projection's inverse domain while
allowing the full advertised extent to fit.

Map layers are keyed by result ID and page position because a search response
can repeat an item ID. Numbered labels retain their result-list positions and
are removed on deselection or when switching to Points mode, without leaving
stale markers behind.

## GeoJSON Areas of Interest

The map's import button reads `.geojson` or `.json` files entirely in the browser.
It accepts all seven WGS84 longitude/latitude GeoJSON geometry types: Point,
MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, and
GeometryCollection, including Features and mixed FeatureCollections. It preserves
polygon holes and dissolves overlapping polygons in polygon-only collections.
The import replaces the current AOI and fits the map to the result.
Importing does not execute a search. Imported AOIs support the existing edit and
delete controls and survive basemap projection changes.

Search and Copy Search URL use CQL2 `S_INTERSECTS(geometry, <WKT>)` predicates for
the actual imported geometry, not its bounding box. Multiple parts are joined
with a parenthesized `OR`: results may intersect any imported point, line, or
polygon. The API rejects GeometryCollection WKT literals, so these are expanded
into individual predicates. Imported points and lines are not buffered.
Selecting a location or drawing
a rectangle replaces the imported AOI with the existing bounding-box workflow.
Only the geometry is sent when searching; the source file and its properties are
not uploaded. Imported AOIs are session-only and are not saved across page reloads.

Files are limited to 2 MiB and 500 input positions in total across all features,
including polygon holes and repeated ring-closing coordinates. Nested geometry
collections are limited to 16 levels. The 500-position cap is a conservative
starting point for main-thread topology checks and Leaflet editing, not a
guarantee of a particular device's performance. A separate 6,000-character limit
on the URL-encoded spatial filter applies because searches currently use GET URLs;
high-precision coordinates or many separate parts can reach it before 500 positions.
Detailed
geometries must be simplified before import; there is no silent simplification.
Malformed JSON, unsupported geometry, explicit CRS declarations, invalid
coordinates, open or self-intersecting rings, and invalid holes are rejected
without replacing the active AOI. Export older or projected datasets as RFC 7946
GeoJSON first. Empty/null geometries, KML, shapefiles, GeoPackage, and reprojection
are not included. The mixed example is available at
`public/examples/ottawa-all-geometries.geojson`.

Run `node --test tests/GeoJsonAoi.test.ts` for import-validation regression tests.

## Flexible Date Searches

The custom date range uses React Aria's segmented date/time fields. Enter a
year and optionally month, day, hour, minute, and second. Trailing blank parts
set the precision; missing intermediate parts are invalid. A start year of
`1985` and an end year of `1985` includes that entire year. Start/end endpoints
expand to the beginning/end of the entered period, inclusive to the second.
An entirely blank endpoint is open; two blank endpoints omit the date restriction.
Dates use the browser's local timezone and are converted to UTC for STAC.
Times skipped by daylight-saving changes show an error rather than being shifted.

Day limits respect month lengths and leap years. Changing month/year clamps an
existing day to the last valid day without filling any blank parts. The calendar
sets year/month/day and preserves time parts, including blanks. Delete clears a
segment; Backspace removes a digit. The inline info note explains these controls
in English and French.

Partial values persist with the existing search preferences, including missing
intermediate parts so invalid input is not silently lost. Validation blocks
invalid/reversed ranges before sending requests or clearing the previous results.
Date-type collection filters share the same controls and endpoint normalization.
Run `npm run test:dates` with Node.js 22.18+ for normalization regression tests.

### Development preview

Open `http://127.0.0.1:5173/#/date-prototype` to try React Aria's segmented
date/time editing using the same shared control as search. Diagnostic values
report unset parts as `null`. This preview makes no requests and does not persist
dates. EN/FR and light/dark buttons use existing application preferences.

## NAPL Orders

The NAPL basket stores separate order lines, including repeated catalog UUIDs.
Each line has independent media type, file format, resolution, and positive
integer quantity. Existing saved basket entries default to quantity 1. Duplicate
and remove controls operate on line IDs, not catalog UUIDs. Quantities persist
with the basket, are sent as `items[].quantity`, and appear in the confirmation
summary. The service counts total units toward its hourly limit. The displayed
Order ID prefers the API's integer `order_number`, with a UUID fallback for
older responses.

The service's `media_type_options` rules drive the per-line format and resolution
controls. Digital uses the existing digital formats; Paper Print offers Contact
Print and Enlargement, with no resolution. Only Digital requires resolution.
Other media disable and omit format and resolution fields. Switching media resets incompatible choices while
retaining compatible ones; saved Contact Print/Enlargement media entries are
converted to Paper Print with the corresponding print format when the service
advertises the new rules. Older services without these rules retain their
previous all-fields behavior until upgraded.

Each line also has an optional Flight Line Index Map selector: Not requested,
PDF, or Paper. The selectable formats come from the service's
`flight_line_index_maps` list; the control is disabled until the service
advertises this capability. Selections persist in the basket and are copied
with duplicated lines. The request carries `items[].options.flight_line_index_map`
only when selected, using `PDF` or `Paper` even in the French UI. The confirmation
summary shows each line's choice. Older saved lines have no assumed map format.

## Production Build

User registration, profile viewing, editing, and password changes are disabled by default.
Their implementation is preserved behind `VITE_ENABLE_USER_PROFILE=true`.
Only enable it once the AAA users API is ready. This is a build-time setting:
restart Vite for development, or rebuild and redeploy for production.
Login, token refresh, and logout are unaffected.

Build the frontend with:

```cmd
cd site
npm run build
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
