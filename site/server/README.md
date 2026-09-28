# Local AAA Proxy

The local server is used only by Vite development mode. It proxies the same
relative AAA routes used in production, avoiding browser CORS requirements.

```cmd
cd site\server
npm install
npm run start
```

It listens on port `5000` and accepts these routes from the Vite proxy:

- `POST /aaa/v1/login`
- `GET /aaa/v1/refresh`

It is not part of the production frontend build. The production host must
provide the corresponding `/aaa/v1/...` endpoints.