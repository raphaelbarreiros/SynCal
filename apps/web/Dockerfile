# syntax=docker/dockerfile:1.7

FROM node:22.17.0-alpine AS base
WORKDIR /srv/syncal

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json

RUN npm ci

COPY . .

RUN npm run build --workspace @syncal/web

FROM node:22.17.0-alpine AS runner
WORKDIR /srv/syncal
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /srv/syncal/package.json ./package.json
COPY --from=base /srv/syncal/package-lock.json ./package-lock.json
COPY --from=base /srv/syncal/node_modules ./node_modules
COPY --from=base /srv/syncal/apps/web/.next ./apps/web/.next
COPY --from=base /srv/syncal/apps/web/public ./apps/web/public
COPY --from=base /srv/syncal/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=base /srv/syncal/apps/web/package.json ./apps/web/package.json

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@syncal/web"]
