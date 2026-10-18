# SecureAuth — Architecture & Threat Mitigation Design

## 1. System Architecture Overview

SecureAuth is built with a decoupled, defense-in-depth architecture consisting of a React + TypeScript Single Page Application (SPA), a hardened Express REST API, and a PostgreSQL database accessed via Prisma ORM.

```mermaid
graph TD
    User([Browser Client])
    Vite[Frontend SPA: React + Vite + Tailwind]
    API[Backend API: Express + TypeScript]
    DB[(PostgreSQL 16 Database)]
    Audit[AuditEvent Table / Logger]

    User -->|HTTPS / Strict Cookie| Vite
    Vite -->|Credentials: include<br/>X-CSRF-Token| API
    
    subgraph "Backend Defense Layers"
        API --> Helm[Helmet: CSP, HSTS, X-Frame, Nosniff]
        Helm --> Cors[CORS: Strict Origin Whitelist]
        Cors --> Rate[Rate Limiting: Auth & API Tiers]
        Rate --> Csrf[CSRF Double-Submit Validation]
        Csrf --> AuthM[requireAuth: Session Lookup & Expiry]
        AuthM --> RbacM[requirePermission: Matrix RBAC]
        RbacM --> IdorM[requireOwnership: BOLA Mitigation]
        IdorM --> ZodVal[Zod Validation: .strict Schema Enforcement]
    end

    ZodVal --> DB
    API --> Audit
```

## 2. Trust Boundaries & Data Flow

1. **Client / Browser (Untrusted Zone)**:
   - Untrusted environment. Client-side state, form fields, URL parameters, headers, and local storage cannot be relied upon for security decisions.
   - All authorization and validation decisions are strictly enforced on the server.

2. **Transport Layer (Network Boundary)**:
   - In production, protected via TLS 1.3.
   - Session identifiers are carried exclusively in `HttpOnly`, `SameSite=lax`, `Secure` cookies.
   - CSRF tokens are carried via an HMAC-signed cookie and an explicit `X-CSRF-Token` request header for state-changing HTTP operations.

3. **Application Layer (Express / Node.js)**:
   - Enforces rate limiting at the IP and credential level.
   - Validates all request inputs via Zod with `.strict()` mode.
   - Generates and verifies cryptographic session tokens (256-bit entropy).
   - Enforces the RBAC permission matrix (`USER`, `SUPPORT`, `ADMIN`).
   - Verifies resource ownership on all record queries (`WHERE id = :id AND userId = :currentUserId`).

4. **Persistence Layer (PostgreSQL)**:
   - Relational database schema with strict foreign key constraints, cascading deletes, and unique indexes on email.
   - Access parameterized via Prisma query engine, mitigating SQL injection risks.

## 3. Session & Credential Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Browser User
    participant API as Express API
    participant Argon as Argon2id
    participant DB as PostgreSQL

    Client->>API: POST /api/v1/auth/login { email, password }
    API->>DB: Query User by normalized email
    DB-->>API: User record (including passwordHash)
    API->>Argon: verify(password, passwordHash)
    Argon-->>API: Verification Result (true/false)
    
    alt Invalid Credentials
        API->>DB: Log LOGIN_FAILURE audit event
        API-->>Client: 401 Unauthorized ("Invalid email or password")
    else Valid Credentials
        API->>DB: Invalidate old session (if any)
        API->>DB: Create new session (256-bit token, TTL: 24h)
        API->>DB: Log LOGIN_SUCCESS audit event
        API-->>Client: 200 OK + Set-Cookie: secureauth_session (HttpOnly, SameSite) + X-CSRF-Token
    end
```
