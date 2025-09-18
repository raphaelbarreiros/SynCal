## Introduction
This document outlines the overall project architecture for SynCal, covering backend services, shared services, and all non-UI specific concerns. Its primary purpose is to act as the canonical blueprint for both human engineers and AI agents, ensuring consistent implementation decisions and adherence to the selected patterns and technologies.

**Relationship to Frontend Architecture:**
A dedicated Frontend Architecture document will complement this blueprint for UI-specific decisions. The technology selections documented here—particularly those captured in the Tech Stack section—apply across the entire project, frontend included.

### Starter Template or Existing Project
SynCal is a true greenfield build. There is no inherited template or prior codebase; the repository will be scaffolded manually to satisfy the PRD’s monorepo requirement (`apps/web`, `apps/api`, `apps/worker`, shared packages) and the Docker-first deployment mandate. Common boilerplates (e.g., create-t3-app, Blitz, Nest starters) were considered but rejected because they presume a single-service runtime or bring opinionated tooling that conflicts with our multi-service Compose deployment. We can optionally introduce task runners such as Turborepo later if build orchestration demands them.

### Change Log
| Date       | Version | Description                     | Author                |
|------------|---------|---------------------------------|-----------------------|
| 2025-09-18 | v0.1    | Initial backend architecture draft. | Codex Architect (AI) |

