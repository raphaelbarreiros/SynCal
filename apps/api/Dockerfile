# syntax=docker/dockerfile:1.7

FROM node:22.17.0-alpine AS base
WORKDIR /srv/syncal

RUN apk add --no-cache python3 make g++ curl

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build --workspace @syncal/api

FROM node:22.17.0-alpine AS runner
WORKDIR /srv/syncal
ENV NODE_ENV=production

RUN apk add --no-cache curl

COPY --from=base /srv/syncal/package.json ./package.json
COPY --from=base /srv/syncal/package-lock.json ./package-lock.json
COPY --from=base /srv/syncal/node_modules ./node_modules
COPY --from=base /srv/syncal/apps/api/dist ./apps/api/dist
COPY --from=base /srv/syncal/packages ./packages
COPY --from=base /srv/syncal/prisma ./prisma

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
