## Source Tree
```plaintext
syncal/
├── package.json                       # when Node packages are added
├── package.json (workspaces optional) # npm workspaces if monorepo is used
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── web/
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (dashboard)/
│   │       │   ├── (connectors)/
│   │       │   ├── (calendars)/
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── lib/
│   │       └── styles/
│   ├── api/
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── app/
│   │       │   ├── auth/
│   │       │   ├── connectors/
│   │       │   ├── calendars/
│   │       │   ├── pairs/
│   │       │   └── jobs/
│   │       ├── config/
│   │       ├── middlewares/
│   │       ├── repositories/
│   │       ├── services/
│   │       └── routes/
│   └── worker/
│       ├── package.json
│       └── src/
│           ├── main.ts
│           ├── consumers/
│           ├── executors/
│           ├── schedulers/
│           └── telemetry/
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   └── src/
│   │       ├── domain/
│   │       ├── dtos/
│   │       ├── validation/
│   │       └── utils/
│   ├── connectors/
│   │   ├── package.json
│   │   └── src/
│   │       ├── adapters/
│   │       │   ├── google/
│   │       │   ├── microsoft/
│   │       │   ├── html-ics/
│   │       │   └── imap/
│   │       ├── clients/
│   │       ├── tokens/
│   │       └── registry.ts
│   ├── ui/
│   │   ├── package.json
│   │   └── src/
│   │       ├── components/
│   │       ├── theme/
│   │       └── hooks/
│   ├── config/
│   │   ├── package.json
│   │   └── src/
│   │       ├── env/
│   │       ├── logging/
│   │       └── security/
│   └── testing/
│       ├── package.json
│       └── src/
│           ├── factories/
│           ├── fixtures/
│           └── mocks/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── seed.ts
│   └── migrate-and-seed.ts
└── docs/
    ├── architecture.md
    ├── front-end-architecture.md
    └── qa/
        └── testing-strategy.md
```
```
