# Growth Log REST API: Tech Stack
A series of architecture decision records pertaining to the core parts of the API's tech stack.

## ADR 1: Web Framework — Fastify

**Status:** Accepted

### Context
GrowthLog needed a Node.js web framework. Express was the natural default — used in a prior project (Eureka) and recommended by The Odin Project. However, Express's minimal, unopinionated design requires manually wiring together services and writing validation boilerplate, and its lack of enforced structure means conventions must be defined from scratch — choices that accumulate into maintenance debt in a production-grade API.

### Decision
Fastify. Its plugin architecture, built-in schema validation, and performance-first design address production concerns without reaching for third-party middleware.

- Plugin architecture eliminates singletons; services registered as plugins and accessed via `app` in any route handler
- Plugins initialize in declared order, preventing race conditions in service dependency chains
- Schemas pre-compiled at startup via `fast-json-stringify`: 2–3× faster serialization than Express's per-request `JSON.stringify`
- `find-my-way` radix tree router: ~3× faster route matching than Express's linear scan — gap widens with route count
- Pino logger uses worker threads for I/O, keeping the event loop unblocked

### Consequences
**Tradeoffs accepted:**
- Schema definitions add upfront verbosity compared to Express's minimal setup
- The performance advantage narrows significantly in DB-bound workloads, where the bottleneck is the query, not the framework

---

## ADR 2: Database ORM — Prisma

**Status:** Accepted

### Context
GrowthLog needed an ORM for PostgreSQL. Drizzle was the alternative from professional experience (Mapka). There, Drizzle's SQL-first philosophy required creating an abstraction layer of a custom DB function per request-handler.

### Decision
Prisma. Its high-level, GraphQL-inspired API prioritizes developer experience and development velocity over marginal performance gains.

- Higher-level abstraction than Drizzle's SQL-mirroring approach improves development velocity
- Auto-generates complex nested relation input types; Drizzle requires manual construction
- Migration system more battle-tested for complex scenarios: type changes, multi-step schema migrations

### Consequences
**Tradeoffs accepted:**
- Requires migration *and* client regeneration on every schema change, adding friction.
- Less control over generated SQL; can only optimize queries via a raw SQL escape hatch.
- Heavier runtime footprint than Drizzle (~7.4 KB)

---

## ADR 3: Containerization — Docker

**Status:** Accepted

### Context
GrowthLog required PostgreSQL, Redis for session storage, and HTTPS. Without containerization, these would either be hosted externally (adding network latency and third-party dependencies) or installed directly on the host (creating environment inconsistencies and making the stack harder to reproduce).

### Decision
Docker with Docker Compose. All services run on the same machine within an isolated internal network, with Caddy as a reverse proxy handling HTTPS.

- Same-machine DB via Docker Compose eliminates internet round-trip latency of an external host
- Removes dependency on third-party database hosting providers
- Redis keeps API containers stateless; sessions survive restarts
- Caddy provides automatic HTTPS and reverse-proxies to the internal Docker network
- Entire stack declared in `docker-compose.yml` — reproducible across environments with clean teardown

### Consequences
**Tradeoffs accepted:**
- More moving parts than a bare deployment; Docker networking knowledge required to diagnose container communication issues
- Running multiple containers on one machine increases resource consumption
- Local HTTPS setup (via `mkcert`) adds a one-time configuration step not present in a plain HTTP development server
