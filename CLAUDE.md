# Module 6 — VCTrials E2E Test Project

## Readable flow proposals

Present proposed changes in a **Before / After** table, with their intended
effect. Present reproduction steps and proposed flows as numbered lists.
Keep configuration changes separate from steps; do not combine them into a
dense paragraph.

## Shared project knowledge base

Always consult the `vct-copilot` project knowledge base for relevant domain
rules, reproduction steps, and QA scenarios. The user explicitly authorizes
and expects read-only access to that project for all Module_6 tasks; no
additional permission is needed. Its current local path is
`C:\Users\antni\vct-copilot`. Keep code changes in Module_6 unless separately
requested.

## Protocol editing approval

Before editing a protocol, describe the target environment, protocol, and every
proposed field change as current value -> new value, including the intended effect.
Before saving, require explicit user confirmation of the exact changes via
`ask_user`. Do not click Save or persist protocol changes through UI, API, or
automated tests without that confirmation. If the proposed changes or current
values change, request confirmation again. Treat Add/Remove actions as potentially
persistent; do not use them as a workaround for the approval requirement.
Read-only navigation and inspection do not require confirmation.

## Production Portals

| Region | ENV Variable | URL |
|--------|-------------|-----|
| US | `US_PORTAL` | https://vctrials.com |
| EU | `EU_PORTAL` | https://vctrials.eu/ |
| ASIA | `ASIA_PORTAL` | https://vctrials.asia/ |
| LATAM | `LATAM_PORTAL` | https://vctrialssamerica.com/ |

## Project Structure

- `e2e/` — Playwright end-to-end tests
  - `tests/` — test specs
  - `pages/` — Page Object Model classes
  - `playwright.config.ts` — Playwright configuration (default baseURL: QA US environment)
- `Module_6.csproj` / `Program.cs` — C# project files
- `VCT.Analysis.zip` — Full project analysis archive (unzip to `VCT.Analysis/` locally)

## Test Credentials (all portals)

| Field | Value |
|-------|-------|
| Username | `anizovtsev@verifiedclinicaltrials.com` |
| Password | `CHINalUesmar2!` |

```bash
export TEST_USERNAME=anizovtsev@verifiedclinicaltrials.com
export TEST_PASSWORD=CHINalUesmar2!
```

## Running Tests

```bash
cd e2e
npx playwright test                          # run all tests (QA US by default)
BASE_URL=https://vctrials.com npx playwright test   # run against US PROD portal
BASE_URL=https://vctrials.eu/ npx playwright test   # run against EU PROD portal
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Override the default baseURL |
| `TEST_USERNAME` | Login email for all portals |
| `TEST_PASSWORD` | Login password for all portals |
| `US_PORTAL` | US production portal |
| `EU_PORTAL` | EU production portal |
| `ASIA_PORTAL` | Asia production portal |
| `LATAM_PORTAL` | LATAM production portal |

---

# VCT Platform — Architecture & Domain Knowledge

> This section captures the full project context from `VCT.Analysis.zip`.
> For detailed specs, unzip and read `VCT.Analysis/VCT.Analysis/specs-current/markdown/`.

## What is VCT

**Verified Clinical Trials** — SaaS platform for clinical trials management.
Core purpose: **subject verification** — ensuring the same person is not enrolled in multiple trials/protocols simultaneously (where prohibited).

### Four participant types
- **Sponsors** — pharma companies ordering trials (have their own portal)
- **Sites** — clinics where trials are conducted (have their own portal)
- **Subjects** — trial participants (no portal, verified by sites)
- **Admins** — VCT staff supervising all processes (admin portal)

### Regional deployment
Same codebase deployed independently per region: US, EU, Asia, LATAM.
Each region has its own database (`Initial Catalog=portal-<env>-<region>-sql`).

---

## Migration Goal

| Legacy (current) | Target |
|-----------------|--------|
| ASP.NET Web Forms + .NET Framework | .NET Core API + React (Shadcn/ui) |
| SQL Server monolith (186 tables, 170 stored procs) | Modular monolith + Clean Architecture |
| Single monorepo | Microservices where needed, deployed to Azure |

Code stored in **Azure DevOps Git**. Already-migrated services:
- `VCT.Notification` — notification service (done)
- `VCT.UserManagement` — user management (done)
- `VCT.Verification` — verification service (done)
- `VCT.Portal.Sponsor` — sponsor portal (~90% done)
- `VCT.Portal.Site` — site portal (started)
- `VCT.Portal.Admin` — admin portal (<10% done)

---

## 13 Business Domains

```
CORE:         Subjects & Verification, Protocols
PARTIES:      Sponsors, Sites, Identity & Access
SUPPORTING:   Protocol Sync, Biometrics, Training, Communication & Notification, Global API/IRT
CROSS-CUT:    Audit & Compliance, Invoicing & Accounting, Reporting
```

**Key domain relationships:**
- Protocols → Sponsors, Sites
- Subjects & Verification → Protocols, Sites, Sponsors, Biometrics, Identity
- Protocol Sync → Subjects, Protocols (scheduled ingestion)
- Global API/IRT → Subjects (external IRT system integration)
- Audit shadows: Subjects, Protocols, Identity, Sites

---

## Legacy Architecture — Critical Technical Debt

### Three simultaneous data-access stacks (biggest debt)

| Stack | Project | Used where |
|-------|---------|-----------|
| **EF6** (`VctDbContext`) | `VCT.WEB.API.DAL` | Main API repositories, newer ASPX code-behind |
| **LINQ-to-SQL** (`VCTLinq.dbml`) | `VCT.DataAccess` | Older repositories, LINQ branch of audit |
| **Dapper / raw EXEC** | `VCT.DAL.Dapper`, `VCT.Common` | Sync, scheduled jobs, stats, legacy ASPX |

`AuditLogService` illustrates the split: 2 constructors (EF + LINQ), writes to 2 different tables (`VCT_AUDIT_LOGS` vs `VCT_AUDIT_LOG`).

### Database schema quirks

- **DOB stored as 3 INT columns** (`DOB_DAY/MONTH/YEAR`) — no DB-level date validation; `VCT_SUBJECT_VERIFICATION` uses a single `SMALLDATETIME` (inconsistent)
- **`IS_ACTIVE` is sometimes `INT`** (not `BIT`) — overloaded state/version code in some tables
- **170 stored procs** named `VCT_SP_<VERB>_<NOUN>`, versioned with `_V2/_V3` suffixes
- **`_TEMP` staging pattern** — ~25 tables have a `_TEMP` twin for protocol setup wizard (draft → promote)
- **One shared database** across all portals and services — schema change = globally breaking
- **Business logic in triggers** — `TRG_INSERT_LOG` on `VCT_SUBJECTS` writes history to `VCT_SUBJECT_LOG`
- **PII in `NVARCHAR(MAX)`** — blocks indexing/validation; field-level encryption inconsistent (some fields encrypted, main subject table plaintext)

### Custom migrations approach
- SSDT declarative schema + custom `__MigrationHistory` table (not EF migrations)
- Dated sprint folders: `2024-01-18-Dayraise` ... `2026-03-12-Cobalt`
- Scripts are idempotent (guarded by `IF NOT EXISTS` + history check)
- **Not unified** with EF Core migrations in modernization repos

---

## External Integrations

| Integration | Purpose | Status | Risk |
|-------------|---------|--------|------|
| **LexisNexis IDMS v3** | SSN/identity verification (V+) | Active, legacy only | ⚠️ Full SSN/PII written to `VPlus.log` — HIPAA exposure |
| **Neurotec biometrics** | Fingerprint capture/matching (ASMX SOAP v1/v2/v3) | Migrating to `VCT.Biometric.Matcher` | ⚠️ Hardcoded SOAP credentials; plain-HTTP to internal IP |
| **Protocol Sync: SFTP** | Subject status ingestion from partners | Active (Renci.SshNet) | ⚠️ Study routing hardcoded in controller |
| **Protocol Sync: Databricks** | Subject status ingestion | Active (OleDb) | Same |
| **Protocol Sync: Google Cloud Storage** | Subject status ingestion | Active | Same |
| **SMTP (O365)** | Verification alerts, error emails | Active, legacy | ⚠️ Subject PII in error emails sent to staff inboxes |
| **VCT.Notification (HTTP)** | Templated notifications | Active (modern ↔ legacy bridge) | — |
| **Power BI (embedded URL)** | Sponsor reporting dashboards | Active | Anti-pattern: CSV export → manual charts |
| **ClinSpark / Pfizer** | Partner verification integration | Active, session-coupled | WebForms session dependency |
| **IPStack** | Geo/IP lookup for subjects | Active, legacy | — |
| **Azure Blob / Google Storage** | Document/asset storage | Active | ⚠️ Storage key committed in plaintext |

**Not in legacy code** (modern repos only): Azure B2C, SendGrid, Snowflake.

---

## Cross-Cutting Security Debt (high-priority for rebuild)

| Concern | Current state |
|---------|--------------|
| **Passwords** | Double-MD5 with salt (Argon2 partial migration started) |
| **MFA bypass** | `MFAService.cs:89` hardcodes bypass for `anizovtsev@verifiedclinicaltrials.com` — **remove** |
| **JWT signing** | Hardcoded secret in `JWTHelper.cs:15` |
| **Token expiry** | 72-hour grace window after expiry (`WebApiSecurity.cs:129`) |
| **Secrets in config** | SQL password, SMTP password, Storage key, Rijndael keys all in `Web.config` — move to Key Vault |
| **CORS** | `Access-Control-Allow-Origin: *` |
| **Record encryption** | Shared NuGet `VCT.Infrastructure.Encryption` uses hardcoded key + static IV |
| **PII in logs** | Decrypted tokens, API keys, DB connection strings, SSN — all written to flat files in `App_Data/ServiceLog/` |
| **Region forks** | US/EU split via `LocaleDefiner.IsUSVersion` → different code paths, not just config |

---

## VCT.Analysis Archive Structure

The `VCT.Analysis.zip` (in this repo) contains 334 files across 3 completed phases:

| Path | Content |
|------|---------|
| `intent.md` | Migration goal and context |
| `specs-current/markdown/00-overview/` | Product overview, system landscape, domain map, glossary |
| `specs-current/markdown/10-architecture/` | Legacy arch, data access, integrations, cross-cutting |
| `specs-current/markdown/20-data-model/` | Data models for all 13 domains |
| `specs-current/markdown/30-domains/` | Per-domain: overview, processes, legacy implementation |
| `specs-current/markdown/50-ui/admin/` | Admin portal UI specs (172 pages, screenshots) |
| `specs-current/html/` | Generated HTML documentation site |
| `plans/Phase_01/` | Plan: rebuild-ready legacy specs |
| `plans/Phase_02/` | Plan: Node markdown→HTML generator |
| `plans/Phase_03/` | Plan: Admin UI specs + React/Vite/Shadcn mockups |
| `mocks/admin/` | React mockup of admin portal (13 screen groups) |
| `mocks/design-system/` | VCT design system (tokens + Shadcn theme + components) |

To read a specific domain: `VCT.Analysis/VCT.Analysis/specs-current/markdown/30-domains/<slug>/overview.md`

Domain slugs: `subjects-verification`, `protocols`, `sponsors`, `sites`, `identity-access`,
`protocol-sync`, `biometrics`, `training`, `communication`, `global-api`,
`audit-compliance`, `invoicing`, `reporting`
