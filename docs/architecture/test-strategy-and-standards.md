## Test Strategy and Standards

### Testing Philosophy
- **Approach:** Test-after with automation gates; critical flows may follow TDD when fixing regressions.
- **Coverage Goals:** 80% line coverage for API/worker packages; 60% for portal due to UI complexity.
- **Test Pyramid:** 60% unit, 30% integration, 10% end-to-end to balance depth and runtime.

### Test Types and Organization
#### Unit Tests
- **Framework:** Vitest 3.2.4
- **File Convention:** `*.test.ts`
- **Location:** Colocated next to source files
- **Mocking Library:** Built-in Vitest mocks with `vi.fn`
- **Coverage Requirement:** ≥80% per package
- **AI Agent Requirements:**
  - Generate tests for public functions/services
  - Include edge cases (empty windows, throttled providers)
  - Follow Arrange–Act–Assert structure
  - Stub external adapters via dependency injection

#### Integration Tests
- **Scope:** API route + database interactions; worker job execution against Postgres and provider stubs
- **Location:** `apps/api/tests/integration`, `apps/worker/tests/integration`
- **Test Infrastructure:**
  - **Database:** Testcontainers Postgres 16 image
  - **External APIs:** WireMock/Mock Service Worker simulators for Google/Microsoft endpoints

#### End-to-End Tests
- **Framework:** Playwright 1.55.0
- **Scope:** Portal flows (login, connector setup, calendar pairing, dashboard status)
- **Environment:** Staging Compose stack with seeded data and mocked provider responses
- **Test Data:** Factories seeded via shared `scripts/seed.ts`
 - **Accessibility:** Integrate axe scans on key pages and flows; fail CI on critical violations

### Test Data Management
- **Strategy:** Deterministic factory functions in `packages/testing` provide seeded admin, connector, calendars.
- **Fixtures:** JSON fixtures for provider responses stored in `packages/testing/fixtures`.
- **Factories:** Modular factory helpers using Faker to generate realistic titles/IDs.
- **Cleanup:** Jest-style `afterEach` hooks reset database via transaction rollback in unit tests; integration tests use Testcontainers lifecycle + truncation scripts.

### Continuous Testing
- **CI Integration:**
  - Pull Requests: run `lint` + `unit` + `integration`
  - Main branch merges: repeat `integration` and build images
  - Nightly/Staging: run `e2e` against staging stack
- **Performance Tests:** Deferred to post-MVP; baseline worker throughput measured via synthetic job suite.
- **Security Tests:** Dependabot + `npm audit` in CI; manual quarterly security review incorporating SAST.
