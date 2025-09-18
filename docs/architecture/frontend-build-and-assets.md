# Frontend Build & Assets

Guidance for the web portal build pipeline, asset optimization, and caching policies.

## Build Pipeline (Next.js)
- Use Next.js App Router (v15) with route-level code splitting by default
- Enable React server components where helpful to reduce client JS
- Keep third-party scripts minimal; avoid blocking resources

## Performance Budgets (MVP)
- LCP ≤ 2.5s, TTI ≤ 2.0s, TBT ≤ 300ms, CLS ≤ 0.1
- Monitor budgets locally with Lighthouse; add CI checks post-scaffold

## Code Splitting & Lazy Loading
- Lazy-load heavy panels: Logs, Sync Timeline, and Settings subsections
- Use dynamic imports with suspense fallbacks (skeletons)

## Images & Media
- Use Next.js `Image` for automatic optimization; provide width/height to prevent CLS
- Prefer SVG for icons; compress PNG/JPEG assets; avoid large hero images in MVP

## Caching & Headers
- Static assets: long `Cache-Control` with content hashing (Next.js default)
- HTML/document responses: short/max-age with revalidation
- API calls: leverage SWR/React Query caching and revalidation policies

## Internationalization (Optional Post‑MVP)
- If added, code-split locale bundles and avoid loading non-current locale at startup

## CDN Stance (MVP)
- No CDN for MVP; portal serves assets directly via Next.js
- Revisit CDN once asset sizes or traffic justify it
