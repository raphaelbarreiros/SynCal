# Component Development Workflow (Ladle)

This document describes how we develop and preview UI components in isolation using Ladle (lightweight alternative to Storybook).

## Why Ladle
- Fast startup, minimal overhead, easy integration in monorepos
- Good DX for visual testing and accessibility checks

## Project Setup (when web package lands)
1. Install dev dependencies in `apps/web`:
   ```bash
   npm i -D @ladle/react @ladle/react-context @ladle/react-css @ladle/react-plugin-a11y
   ```
2. Add scripts to `apps/web/package.json`:
   ```json
   {
     "scripts": {
       "ladle": "ladle serve",
       "ladle:build": "ladle build",
       "ladle:preview": "ladle preview"
     }
   }
   ```
3. Create stories next to components using the `.stories.tsx` convention.

## Conventions
- One story per variant/interactive state (loading, error, empty, success)
- Include a11y annotations where relevant
- Co-locate small fixtures next to stories; share larger fixtures under `packages/testing/fixtures`

## Accessibility
- Enable the Ladle a11y plugin for quick checks
- Run Playwright + axe in CI for key flows (see test strategy)

## Visual Testing (Optional)
- Integrate Playwright screenshot tests for critical components; keep thresholds tight and stable

## Handoff
- Link story URLs in PRs for reviewer screenshots/videos
- Keep stories updated when components change
