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

Five containers are orchestrated by `compose.yaml`:

| Container | Image | Role |
|---|---|---|
| GrowthLogBuild | node:25-alpine | Compiles TypeScript source to JavaScript in watch mode |
| GrowthLogApi | node:25-alpine | Runs the compiled JavaScript API server |
| GrowthLogCaddy | caddy:2-alpine | Handles TLS termination and reverse proxies requests to the API |
| GrowthLogPostgres | postgres:18 | Primary relational database |
| GrowthLogRedis | redis:8 | In-memory session and cache store |

**The TypeScript compilation pipeline**

The API container does not compile TypeScript itself. Compilation is delegated to a dedicated build container running `tsc --build --watch` as its sole process. Both containers mount the project directory via the same bind mount (`.:/app`), so compiled output written to `dist/` by the build container is immediately visible to the API container.

The API container runs `node --watch dist/server.js`, which monitors `dist/` for changes and restarts the Node.js process when they appear. Because `tsc --build --watch` maintains an incremental compilation cache (`.tsbuildinfo`), subsequent compilations only process changed files and their affected dependents. This reduces the feedback loop from a source change to a running server from around a minute to a few seconds.

The build container's health check enforces correct startup ordering:

```yaml
healthcheck:
  test: ["CMD-SHELL", "[ -f /app/dist/server.js ]"]
  start_period: 10s
  start_interval: 1s
  interval: 24h
  retries: 10
```

During startup, Docker polls every second. The API container's `depends_on` condition of `service_healthy` means it only starts once `dist/server.js` exists. The 24-hour recheck interval is deliberate — once `dist/server.js` exists, there is no reason to keep checking if it still does.

**Bind mounts**

| Container | Host path | Container path | Purpose |
|---|---|---|---|
| GrowthLogBuild | `.` | `/app` | Source file access and `dist/` write access for the compiler |
| GrowthLogApi | `.` | `/app` | Access to compiled output in `dist/`, `node_modules`, and runtime-read files |
| GrowthLogCaddy | `./Caddyfile.dev` | `/etc/caddy/Caddyfile` | Dev Caddy config (localhost + self-signed certs) |
| GrowthLogCaddy | `./.local/certs` | `/etc/caddy/certs` | Self-signed TLS certificates for local HTTPS |
| GrowthLogCaddy | `./.local/caddy-data` | `/data` | Caddy's persistent data directory |
| GrowthLogCaddy | `./.local/caddy-config` | `/config` | Caddy's runtime configuration cache |
| GrowthLogPostgres | `./.local/postgres-data` | `/var/lib/postgresql/data` | Persists the database across container restarts |
| GrowthLogRedis | `./.local/redis-data` | `/data` | Persists sessions across container restarts |

Dev uses bind mounts under `.local/` rather than named volumes, so database contents and other local state land in the project directory where they can be inspected or wiped easily.

Redis is configured with `--appendonly yes`, which logs every write to disk. Without this flag, Redis operates in-memory only and data is lost on restart regardless of the volume mount. Because sessions are stored exclusively in Redis, persistence is not optional.

**Service dependencies**

```
GrowthLogCaddy
    └── GrowthLogApi
            ├── GrowthLogBuild    (waits for: service_healthy)
            ├── GrowthLogPostgres (waits for: service_started)
            └── GrowthLogRedis    (waits for: service_started)
```

Caddy waits for the API before accepting traffic. The API waits for the build container to pass its health check and for Postgres and Redis to have started. Both Postgres and Redis have `logging: driver: none` to suppress their verbose output from the Compose log stream. Postgres is exposed to the host on port 5432 so that Prisma migrations can be run from the host machine against the containerised database.

#### Production

In production, a single image built from `Dockerfile` is used. Running `docker compose -f compose.prod.yaml up --build` installs dependencies, compiles TypeScript once at build time and bakes the output into the image — no bind mounts, no compiler watch process, no `--watch` flag.

```dockerfile
FROM node:25-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev          # production dependencies only
COPY . .
RUN npm run build              # compile once, at build time
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The dependency layer is ordered deliberately: `package*.json` is copied and dependencies installed before source files are added. A source-only change skips the `npm ci` step and reuses the cached dependency layer, keeping image rebuild times short.

Production uses named volumes rather than bind mounts. Docker manages these independently of the project directory, which is appropriate since there is no reason to inspect raw database or session files from the host.

| Volume | Container path | Purpose |
|---|---|---|
| `postgres-data` | `/var/lib/postgresql/data` | Persists the database |
| `redis-data` | `/data` | Persists sessions |
| `caddy-data` | `/data` | Stores Let's Encrypt certificates |
| `caddy-config` | `/config` | Caddy's runtime configuration cache |

Caddy handles TLS automatically in production via Let's Encrypt, storing issued certificates in `caddy-data`. The self-signed certificate mount from dev is absent. Postgres is not exposed to the host.
