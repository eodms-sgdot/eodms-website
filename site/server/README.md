# Local API Proxy

The local server is used only by Vite development mode. It proxies the same
relative AAA routes used in production, avoiding browser CORS requirements. It
reads `../.env.local`; set `EODMS_TARGET_ENV` to `staging` or `production` to
choose the shared upstream for AAA, search, DDS, and processing. Restart the
server after changing the environment.

For a local SSM port-forwarded endpoint, set `EODMS_TARGET_ENV=proxy` and
`EODMS_PROXY_PORT` to its local port (for example, `5445`). The same endpoint
must serve `/aaa`, `/search`, `/dds`, and `/processing`. Keep the SSM session
open while using proxy mode. Staging and production modes route all four APIs
to their selected EODMS domain. `EODMS_AAA_TUNNEL_PORT` is no longer supported
because it could send AAA to a different environment than the other APIs.

```cmd
cd site\server
npm install
npm run start
```

It listens on port `5000` and accepts these routes from the Vite proxy:

- `POST /aaa/v1/login`
- `GET /aaa/v1/refresh`
- `POST /aaa/v1/users`
- `GET /aaa/v1/users/{username}`
- `PATCH /aaa/v1/users/{username}`

It is not part of the production frontend build. The production host must
provide the corresponding `/aaa/v1/...` endpoints.