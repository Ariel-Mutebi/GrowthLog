# The GrowthLog Rest API: Architecture

### Design direction
The GrowthLog REST API is fully containerized: every component of the system, including the API service, is exclusively run on Docker containers within an isolated network. This is in comparison to a hybrid deployment where underlying services such as PostgreSQL and Redis are run in Docker containers, with each being exposed to the host network so that the API service running on the host can access them.

<table>
  <thead>
    <tr>
      <th>Approach</th>
      <th>Advantages</th>
      <th>Disadvantages</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Fully-containerized application + isolated internal container network</strong></td>
      <td>
        <ul>
          <li>Near-perfect parity between development, staging, and production environments</li>
          <li>Reproducible deployments across machines and infrastructure providers</li>
          <li>Strong dependency and runtime isolation</li>
          <li>Reduced attack surface because databases and internal services are not exposed to the host network</li>
          <li>Easier migration between environments and hosting platforms</li>
          <li>Centralized startup and orchestration of application components through Docker Compose</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Additional container networking and storage concepts to understand and maintain</li>
          <li>Debugging often requires interacting with containers rather than directly attaching to processes</li>
          <li>Development feedback loops can be slower when images must be rebuilt</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td><strong>Hybrid deployment + host-exposed container network</strong></td>
      <td>
        <ul>
          <li>No application container rebuilds during development</li>
          <li>Easier debugging with native IDE tooling and debuggers</li>
          <li>Infrastructure services such as PostgreSQL and Redis can still be managed consistently through Docker</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Greater risk of environment drift between development and production</li>
          <li>Host machine dependencies can conflict with project requirements</li>
          <li>Larger attack surface because supporting services are exposed to the host network</li>
          <li>No single orchestration layer for all application components</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

This design choice keeps the system boundary clean: everything that is part of the application stack runs the same way everywhere, and nothing depends on the host environment to “fill in the gaps”. It also makes the deployment model easier to reason about, since service interactions are always constrained to the same internal network layout.

### Container system

The container setup differs between development and production. Development prioritises fast feedback: source files are mounted directly into containers and TypeScript is compiled continuously in the background. Production prioritises a clean, self-contained artifact: TypeScript is compiled once at image build time, and the resulting image carries everything the API needs.

#### Development

Six containers are orchestrated by `compose.yaml`:

| Container | Image | Role |
|---|---|---|
| GrowthLogClean | node:25-alpine | Removes stale build output before the watch compiler starts |
| GrowthLogBuild | node:25-alpine | Compiles TypeScript source to JavaScript in watch mode |
| GrowthLogApi | node:25-alpine | Runs the compiled JavaScript API server |
| GrowthLogCaddy | caddy:2-alpine | Handles TLS termination and reverse proxies requests to the API |
| GrowthLogPostgres | postgres:18 | Primary relational database |
| GrowthLogRedis | redis:8 | In-memory session and cache store |

**The TypeScript compilation pipeline**

The API container does not compile TypeScript itself. Compilation is delegated to a dedicated build container running `tsc --build --watch` as its sole process. Both containers mount the project directory via the same bind mount (`.:/app`), so compiled output written to `dist/` by the build container is immediately visible to the API container.

The API container runs `node --watch dist/server.js`, which monitors `dist/` for changes and restarts the Node.js process when they appear. Because `tsc --build --watch` maintains an incremental compilation cache (`.tsbuildinfo`), subsequent compilations only process changed files and their affected dependents. This reduces the feedback loop from a source change to a running server from around a minute to a few seconds.

**Clean output without a startup race**

Build output must be fresh on every cold start — a stale `dist/server.js` left over from a previous run should never be served. The natural way to express this is `tsc --build --clean`, which removes exactly what the build graph produced (`dist/`, `.tsbuildinfo`, declaration maps, and composite project outputs) rather than blunt-deleting a directory.

The subtlety is *when* the clean runs relative to the build container's health check. If the clean is the first step of the same long-lived command the health check observes (`tsc --build --clean && tsc --build --watch`), the container is alive and health-check-eligible the instant it starts, before `--clean` has executed. A stale `dist/server.js` present at second 0 can pass the health check immediately, opening the API container's gate — and then `--clean` deletes the file out from under the freshly started `node --watch` process, producing a `MODULE_NOT_FOUND` crash. The process parks itself waiting for the file to reappear, but the gate has already opened on output that no longer exists.

The fix makes the ordering structural rather than timing-dependent. The clean is hoisted into its own one-shot container, `GrowthLogClean`, which runs `tsc --build --clean` to completion and exits. The build container declares `depends_on` it with `condition: service_completed_successfully`, so the watch compiler does not start until the clean has finished. By the time the build container's health check can poll anything, `dist/` is already empty — there is no stale file to pass against, ever. The health check correctly reports unhealthy until `--watch` writes a genuinely fresh, non-empty `server.js`, at which point the API container's gate opens on a file that is fresh and persistent.

The build container's health check enforces correct startup ordering:

```yaml
healthcheck:
  test: ["CMD-SHELL", "[ -s /app/dist/server.js ]"]
  start_period: 30s
  start_interval: 1s
  interval: 24h
  retries: 30
```

The test uses `-s` rather than `-f` so that a zero-byte or partially-written file produced mid-compile does not satisfy the check prematurely. During startup, Docker polls every second (`start_interval: 1s`) throughout the 30-second `start_period`. A failing check during the `start_period` neither marks the container healthy nor counts against `retries`, so the window in which `dist/` is empty before the first compile completes is handled gracefully. The API container's `depends_on` condition of `service_healthy` means it only starts once `dist/server.js` exists and is non-empty. The 24-hour recheck interval is deliberate — once `dist/server.js` exists, there is no reason to keep checking if it still does.

**Bind mounts**

| Container | Host path | Container path | Purpose |
|---|---|---|---|
| GrowthLogClean | `.` | `/app` | Source access and `dist/` write access to remove stale output |
| GrowthLogBuild | `.` | `/app` | Source file access and `dist/` write access for the compiler |
| GrowthLogApi | `.` | `/app` | Access to compiled output in `dist/`, `node_modules`, and runtime-read files |
| GrowthLogCaddy | `./Caddyfile.dev` | `/etc/caddy/Caddyfile` | Dev Caddy config (localhost + self-signed certs) |
| GrowthLogCaddy | `./.local/certs` | `/etc/caddy/certs` | Self-signed TLS certificates for local HTTPS |
| GrowthLogCaddy | `./.local/caddy-data` | `/data` | Caddy's persistent data directory |
| GrowthLogCaddy | `./.local/caddy-config` | `/config` | Caddy's runtime configuration cache |
| GrowthLogPostgres | `./.local/postgres-data` | `/var/lib/postgresql` | Persists the database across container restarts |
| GrowthLogRedis | `./.local/redis-data` | `/data` | Persists sessions across container restarts |

`GrowthLogClean` and `GrowthLogBuild` share the same `.tsbuildinfo` via the bind mount. Since `--clean` removes it and `--watch` regenerates it from scratch.

Dev uses bind mounts under `.local/` rather than named volumes, so database contents and other local state land in the project directory where they can be inspected or wiped easily.

Redis is configured with `--appendonly yes`, which logs every write to disk. Without this flag, Redis operates in-memory only and data is lost on restart regardless of the volume mount. Persistence is necessary because sessions are stored in only in Redis.

**Service dependencies**

```
GrowthLogCaddy
    └── GrowthLogApi
            ├── GrowthLogBuild    (waits for: service_healthy)
            │       └── GrowthLogClean (waits for: service_completed_successfully)
            ├── GrowthLogPostgres (waits for: service_started)
            └── GrowthLogRedis    (waits for: service_started)
```

Caddy waits for the API before accepting traffic. The API waits for the build container to pass its health check and for Postgres and Redis to have started. The build container, in turn, waits for the clean container to run to completion and exit successfully, guaranteeing `dist/` is empty before the watch compiler — and therefore the health check — begins. Both Postgres and Redis have `logging: driver: none` to suppress their verbose output from the Compose log stream. Postgres is exposed to the host on port 5432 so that Prisma migrations can be run from the host machine against the containerised database.

#### Production

In production, a single image built from `Dockerfile` is used. Running `docker compose -f compose.prod.yaml up --build` installs dependencies, compiles TypeScript once at build time and bakes the output into the image — no bind mounts, no compiler watch process, no `--watch` flag. Because compilation happens once into a clean image layer, the stale-output and health-check-ordering concerns of the development setup do not apply, and no separate clean step is needed.

```dockerfile
FROM node:25-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The dependency layer is ordered deliberately: `package*.json` is copied and all dependencies installed before source files are added. Dev dependencies are needed at compile time for TypeScript type declarations, so `npm ci` installs everything. `npm prune --omit=dev` runs immediately after the build to strip them out, leaving the final image with a production-only footprint. A source-only change skips the `npm ci` step and reuses the cached dependency layer, keeping image rebuild times short.

Production uses named volumes rather than bind mounts. Docker manages these independently of the project directory, which is appropriate since there is no reason to inspect raw database or session files from the host.

| Volume | Container path | Purpose |
|---|---|---|
| `postgres-data` | `/var/lib/postgresql` | Persists the database |
| `redis-data` | `/data` | Persists sessions |
| `caddy-data` | `/data` | Stores Let's Encrypt certificates |
| `caddy-config` | `/config` | Caddy's runtime configuration cache |

Caddy handles TLS automatically in production via Let's Encrypt, storing issued certificates in `caddy-data`. The self-signed certificate mount from dev is absent. Postgres is not exposed to the host.
