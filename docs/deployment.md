# SecureAuth — Deployment & Container Hardening Guide

## 1. Container Security Architecture

All SecureAuth containers are configured according to industry container-hardening standards:

### 1.1 Non-Root User Execution
- **Backend API**: Executes as the unprivileged `node` user (`UID 1000`).
- **Frontend Nginx**: Built on `nginxinc/nginx-unprivileged:1.27-alpine` and executes as the unprivileged `nginx` user (`UID 101`), listening on unprivileged port `8080`.
- **Database**: Runs `postgres:16-alpine` under the internal `postgres` user.

### 1.2 Multi-Stage Builds
Build tools, devDependencies, and raw source code are discarded in earlier build stages. Only compiled production artifacts (`dist/`), pruned dependencies, and runtime engines are copied into final runner images.

### 1.3 Container Health Checks
Each container service implements a continuous healthcheck:
- **db**: `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`
- **backend**: `wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/health || exit 1`
- **frontend**: `wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1`

---

## 2. Environment Variables Reference

| Variable | Description | Default (Local Dev) | Production Recommendation |
| :--- | :--- | :--- | :--- |
| `PORT` | API listening port | `5000` | `5000` |
| `NODE_ENV` | Runtime environment | `development` | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` | Dedicated DB user with least-privilege credentials |
| `SESSION_SECRET`| Cryptographic HMAC key for sessions | Dev fallback | 64+ character random hex from vault |
| `CSRF_SECRET` | Cryptographic HMAC key for CSRF | Dev fallback | 64+ character random hex from vault |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:8080` | Exact production FQDN |
| `COOKIE_SECURE` | Enforces `Secure` flag on cookies | `false` | `true` |
| `LOG_LEVEL` | Pino logging threshold | `info` | `info` / `warn` |

---

## 3. Local Startup via Docker Compose

To boot the complete application stack locally:
```bash
# Build and start all services in the background
docker compose up -d --build

# Inspect running containers and health status
docker compose ps

# Access the running frontend
# URL: http://localhost:8080
```
