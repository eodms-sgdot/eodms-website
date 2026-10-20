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

Vite proxies `/aaa` to the local AAA proxy and `/search` to the EODMS Search
service. Production builds retain those relative paths; the production host is
responsible for serving them.

For local development, copy `.env.example` to `.env.local`:

```cmd
cd site
copy .env.example .env.local
```

`EODMS_TARGET_ENV=staging` selects the upstream for local AAA, search, DDS, and
processing requests. Change it to `production` to switch those routes to the
production domain. `/napl` always targets staging. Restart Vite and the local
AAA proxy after changing the setting. Local environment files are ignored by
Git; update `.env.example` when adding configuration variables. Staging builds
and deployments use the relative `/napl/v1` URL directly and do not need the
local proxy or domain variables.

The app automatically shows the `PROXY` badge when running through the local
Vite development server. No environment setting is needed.

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

User profile viewing, editing, and password changes are disabled by default.
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
