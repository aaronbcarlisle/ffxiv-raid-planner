# Vite SPA Cache Headers

XIVRaidPlanner uses Vite route-level chunks. Deployments must avoid caching the SPA shell as immutable HTML, otherwise a browser can keep an old shell that points at removed hashed chunks such as `GroupView-*.js`.

Recommended headers:

- `index.html` and SPA route responses: `Cache-Control: no-cache, no-store, must-revalidate`
- `manifest.json`: `Cache-Control: no-cache, must-revalidate`
- service worker files, if one is ever added: `Cache-Control: no-cache, must-revalidate`
- hashed assets under `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`

The Vercel frontend config defines these headers for the current deployment. If the app is moved behind another CDN, keep the same split: HTML should revalidate, hashed assets can stay long-lived.

The frontend also detects stale dynamic import failures and reloads once with a cache-busting `refresh` query parameter. If the reload guard has already fired, the error boundary shows a manual reload prompt instead of looping.
