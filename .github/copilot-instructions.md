# Frontend repository instructions

Run commands from this repository root:

| Purpose | Command |
| --- | --- |
| Start Vite | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Test | `npm test` |

This is the Vite/React application. Configure its API through `VITE_API_URL` in `.env`; keep the local value empty to use the development proxy. The URL is embedded at build time.

Use `api()` from `src/lib/api.ts` for API requests and `apiUrl()` for backend media and download URLs. Validate quote totals and authoritative prices on the backend, not in this client.
