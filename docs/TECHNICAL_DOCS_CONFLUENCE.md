# LuthierApp - Technical Wiki (Confluence Format)

## 📖 Introduction

**Product Name:** LuthierApp
**Domain:** SaaS Ecosystem for Musical Instrument Repair Businesses (Luthiers).
**Objective:** Provide a centralized hub for managing clients, track equipment repairs, compile financial reports, and maintain dynamic communication streams with leads (Retention CRM).

---

## 🏗 System Architecture Diagram

_For Confluence / Draw.io Embeds:_

- **Layer 1 (Client):** Vue 3 SPA + Vite + Vanilla CSS
- **Layer 2 (Middleware):** Custom ES6 Service Contracts (`/src/services/*`)
- **Layer 3 (Storage & Identity):** Supabase (PostgreSQL, Auth GoTrue, Storage)

## 🧩 Architectural Decisions & Rationale

### 1. The Migration to a Service Layer Model

Historically, the UI `.vue` components communicated directly with the Supabase client. This raised two structural warnings:

1.  **Code Duplication:** Frequent re-implementations of error boundaries and auth-bindings.
2.  **Security Risks:** Without a hardened boundary, payloads could be spoofed (e.g., Mass Assignment) or queries ran heavily causing Memory Leaks.

**Decision:** The application now embraces an isolated Service Layer mapping (`src/services/`). All requests sent to the remote DB must cross `.js` controllers that validate schemas and enforce `user_id` context.

### 2. Rendering Optimization

- `v-show` vs `v-if`: Used intentionally across modules. Component structures that rarely toggle state (like the Master Layouts) use `v-if` to liberate DOM memory. Modals relying on persistent cache rely on `v-show`.
- **Dashboard Queries:** Previously, analytics engines performed Javascript mapping pulling the entire history table. Now, queries incorporate `time-series` filtering constraints directly via PostgREST to safeguard mobile processing layers.

---

## 🛠 Feature & Controller Dictionary

### A. The "Bancada" Workflow (`DashboardAtividades` + `osService`)

The entry point layout.
**Functions:**

- `buscarPendenciasDash()`: Retrieves OS cards where status isn't Finished.
- `buscarOportunidadesPosVenda()`: CRM algorithm identifying clients delivered > 6 months ago for contact engagement.

### B. Client & CRM Entities (`clienteService` + `instrumentoService`)

Hierarchical parentship: `Client -> [Instrument 1, Instrument 2] -> [OS 1, OS 2]`.
**Functions:**

- `salvarCliente(client)`: Checks for existence to UPDATE, else INSERT.
- `buscarInstrumentosDoCliente()`: Relational JOIN handling cross-table parameters.

### C. Financial Modules (`Financeiro` + `RelatoriosDashboard`)

**Functions:**

- `salvarDespesa(payload)`: Inserts negative transactions with `user_id` protection.
- `buscarTransacoes(dateStart, dateEnd)`: Protected read pipeline tracking cash flow (both Incoming specific OS payments and static shop spending). Charts automatically map this aggregate.

### D. Cloud Bucket Files (Storage)

Uses `Supabase Storage` for image hosting (Diário repairs, Workstation Logos).
Implementation enforces front-end image compression (HTML5 Canvas approach via `imageUtils.js`) truncating image weight to < 800px arrays prior to chunk uploads.

---

## 🔒 Security Summary & Best Practices

1.  **Row Level Security:** Frontend components never manually inject `uuid`. Service layer executes `auth.getUser()`, resolving user IDs programmatically on INSERT/UPDATE.
2.  **No Arbitrary Data:** Protected DB procedures such as `salvarObservacoes()` are heavily sanitized passing via an arbitrary `allowed_fields` JavaScript whitelist mapped dynamically.
3.  **Cross-Tenant Isolation:** Supabase API logic inherently validates `JWT` on edge; ensuring shop A cannot infer metrics from shop B.

## 🚀 Deployment Playbook

- Environment required: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Standard command: `npm run build`. Note: PWA compilation acts passively to trigger `service-workers` on manifest discovery.
