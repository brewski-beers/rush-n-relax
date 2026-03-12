# Rush N Relax — Web App Architecture

> Living engineering reference. 10,000 ft view of the platform — phases, layers, environment routing, and dev workflow.
> Style governed by [mermaid-standard.md](./mermaid-standard.md).

---

## Phase Roadmap

Current delivery status across all planned platform phases.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

flowchart LR

    P0["Phase 0\nNext.js Migration\nVite SPA → App Router"]:::complete
    P1["Phase 1\nData-driven Storefront\nFirestore + Admin CMS"]:::complete
    P2["Phase 2\nInventory System\nClover ↔ Firestore Sync"]:::active
    P3A["Phase 3A\nAccessories E-commerce\nStandard processor"]:::pending
    P3B["Phase 3B\nConsumable Shipping\nPaymentCloud + BlueCheck"]:::pending
    P4["Phase 4\nCompliance Logging\nAudit trail + weekly scan"]:::pending
    P5["Phase 5\nMulti-tenant\nFranchisee expansion"]:::pending

    P0 --> P1 --> P2
    P2 --> P3A
    P2 --> P3B
    P3A --> P4
    P3B --> P4
    P4 --> P5

    classDef complete fill:#166534,color:#fff;
    classDef active fill:#713f12,color:#fff;
    classDef pending fill:#1e3a5f,color:#ccc;
```

### Legend

| Abbrev | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| SPA    | Single-Page Application (previous Vite architecture)      |
| ADC    | Application Default Credentials (Firebase auth in Vercel) |
| CMS    | Content Management System (admin UI)                      |
| POS    | Point of Sale (Clover integration target)                 |

### Key Paths

- Phase 0 and 1 are complete and in production.
- Phase 2 (Clover sync) is the active next milestone.
- Phase 3A/3B can run in parallel once inventory is stable.
- Compliance logging (Phase 4) gates the multi-tenant rollout.

---

## Current Architecture

Full layer view of the web app post Phase 0 + Phase 1.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

graph TB

    subgraph CLIENT["Browser — Client Components"]
        CSK["src/firebase.ts\nClient SDK singleton"]
        CC["Client Components\nAgeGate · AmbientOverlay\nPromoClient · LoginPage"]
    end

    subgraph NEXT["Next.js 15 App Router"]
        MW["middleware.ts\nCanonical + legacy redirects\nNoindex headers"]
        subgraph SF["(storefront)"]
            SFP["/ · /about · /locations · /products\n/contact · /locations/slug\n/products/slug · /promo/slug"]
        end
        subgraph ADM["(admin)"]
            ADMP["/admin/login · /admin/dashboard\n/admin/locations · /admin/products\n/admin/promos"]
        end
        SITE["sitemap.ts · robots.ts"]
    end

    subgraph LIB["src/lib — Server-side"]
        ENV["firebase/env.ts\nisEmulator ← single source of truth"]
        ADMIN["firebase/admin.ts\nAdmin SDK singleton · ADC"]
        REPO["repositories/\nlocation · product · promo"]
        SEO["seo/\nmetadata.factory · schemas/"]
        COMP["compliance/\nvalidator · phrase-detector\nschema-guard · api-guard"]
    end

    subgraph GCP["Firebase — GCP"]
        FS[("Firestore\nlocations · products · promos\ninventory · location-reviews\ncontact-submissions")]
        AUTH["Firebase Auth"]
        FN["Cloud Functions v2\nfetchLocationReviews"]
    end

    CC --> CSK
    CSK --> AUTH
    CSK --> FN
    SFP --> REPO
    SFP --> SEO
    SFP --> COMP
    ADMP --> REPO
    SITE --> REPO
    REPO --> ADMIN
    ADMIN --> ENV
    ADMIN --> FS
    MW --> SEO

    classDef title fill:#020617,color:#e6edf3,stroke:#22d3ee,stroke-width:2px;
```

### Legend

| Abbrev | Meaning                                             |
| ------ | --------------------------------------------------- |
| CSK    | Client SDK — `src/firebase.ts`                      |
| CC     | Client Components (React `'use client'`)            |
| MW     | Next.js middleware                                  |
| SF     | `(storefront)` Next.js route group                  |
| ADM    | `(admin)` Next.js route group                       |
| LIB    | `src/lib/` — server-only modules                    |
| ENV    | `src/lib/firebase/env.ts` — emulator flag           |
| ADMIN  | `src/lib/firebase/admin.ts` — Admin SDK singleton   |
| REPO   | `src/lib/repositories/` — all Firestore access      |
| SEO    | `src/lib/seo/` — metadata factory + schema builders |
| COMP   | `src/lib/compliance/` — content validation          |
| GCP    | Google Cloud Platform / Firebase                    |
| FS     | Firestore database                                  |
| FN     | Cloud Functions v2                                  |

### Key Paths

- All Firestore reads go through `REPO → ADMIN → FS`. Pages never import `firebase/firestore` directly.
- `ENV` is the single gating point for emulator vs. production routing.
- Client SDK (`CSK`) only reaches Auth and Functions directly — never Firestore.
- `COMP` validates content at the server layer before it reaches SEO or the response.

---

## Firebase Environment Routing

How `isEmulator` routes SDK calls at runtime.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

flowchart TD

    START(["Request arrives"])

    START --> CHECK{"isEmulator?\nsrc/lib/firebase/env.ts"}

    CHECK -->|"NODE_ENV = development\nOR NEXT_PUBLIC_USE_EMULATORS = true"| EMU
    CHECK -->|"else"| PROD

    subgraph EMU["Local Emulator Stack"]
        E1["Firestore → localhost:8080"]
        E2["Storage → localhost:9199"]
        E3["Functions → localhost:5001"]
        E4["Auth → localhost:9099"]
    end

    subgraph PROD["Production Firebase"]
        P1["Firestore — rush-n-relax project"]
        P2["Storage — firebasestorage.app"]
        P3["Functions — us-central1"]
        P4["Auth — firebaseapp.com"]
    end

    subgraph CREDS["Admin SDK Credential Source"]
        C1{"FIREBASE_SERVICE_ACCOUNT_JSON set?"}
        C1 -->|"yes"| SC["Service Account JSON\n(CI / local override)"]
        C1 -->|"no"| ADC["Application Default Credentials\n(Vercel prod · gcloud local)"]
    end

    EMU --> CREDS
    PROD --> CREDS

    classDef title fill:#020617,color:#e6edf3,stroke:#22d3ee,stroke-width:2px;
    classDef complete fill:#166534,color:#fff;
    classDef warn fill:#7f1d1d,color:#fff;
```

### Legend

| Abbrev | Meaning                         |
| ------ | ------------------------------- |
| ADC    | Application Default Credentials |
| EMU    | Firebase Local Emulator Suite   |
| PROD   | Production Firebase on GCP      |
| SC     | Service Account JSON credential |

### Key Paths

- `isEmulator` is evaluated once at module load in `src/lib/firebase/env.ts`.
- Both the Admin SDK and Client SDK import from that single file — no scattered inline checks.
- Admin SDK credential source is separate from the emulator/prod routing decision.

---

## Dev Workflow

End-to-end local development sequence.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

sequenceDiagram
    participant Dev as Developer
    participant NPM as npm scripts
    participant Emu as Firebase Emulators
    participant Next as Next.js Dev Server
    participant Seed as Seed Scripts

    Dev->>NPM: npm run dev:all
    NPM->>Emu: firebase emulators:start (8080/9099/5001/9199)
    NPM->>Next: next dev (port 3000)
    Note over Emu,Next: Parallel via concurrently

    Dev->>NPM: npm run dev:seed
    NPM->>Seed: seed-emulators.cjs → locations/ products/ promos/ location-reviews/
    NPM->>Seed: seed-from-constants.ts → locations/ products/ promos/
    Note over Seed,Emu: FIRESTORE_EMULATOR_HOST=localhost:8080

    Dev->>Next: http://localhost:3000
    Next->>Emu: Admin SDK reads locations/
    Emu-->>Next: Location documents
    Next-->>Dev: Server-rendered page with Firestore data
```

### Key Paths

- `dev:all` starts both services in parallel — no manual ordering required.
- `dev:seed` must be run after emulators are ready (emulators first, then seed).
- All Admin SDK calls in dev automatically route to `localhost:8080` via `isEmulator`.

---

## Migration: Vite SPA → Next.js 15

What changed, what was deleted, and what was added.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

flowchart LR

    subgraph DEL["Deleted"]
        D1["src/main.tsx\nVite entry point"]
        D2["src/layouts/RootLayout.tsx"]
        D3["src/pages/ — all Vite pages"]
        D4["vite.config.ts"]
        D5["src/lib/firebase/client.ts\nDuplicate SDK init"]
    end

    subgraph REP["Replaced"]
        R1["VITE_* env vars\n→ NEXT_PUBLIC_*"]
        R2["React Router\n→ App Router"]
        R3["src/pages/*.tsx\n→ src/app/(storefront)/*/page.tsx"]
        R4["Firebase App Hosting\n→ Vercel (PR previews + prod)"]
        R5["Inline NODE_ENV checks\n→ src/lib/firebase/env.ts"]
    end

    subgraph ADD["Added"]
        A1["src/lib/repositories/\nFirestore data access layer"]
        A2["src/lib/compliance/\n6 modules · 100% unit tested"]
        A3["src/lib/seo/\nmetadata.factory + schemas/"]
        A4["src/app/(admin)/\nLogin + CMS UI"]
        A5["app/sitemap.ts · app/robots.ts"]
        A6["scripts/seed-from-constants.ts"]
    end

    subgraph GATE["Pending Deletion — after prod Firestore confirmed"]
        G1["src/constants/locations.ts"]
        G2["src/constants/products.ts"]
        G3["src/constants/promos.ts"]
    end

    classDef warn fill:#7f1d1d,color:#fff;
    classDef complete fill:#166534,color:#fff;
    classDef pending fill:#1e3a5f,color:#ccc;

    class DEL warn;
    class ADD complete;
    class GATE pending;
```

### Legend

| Abbrev | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| SPA    | Single-Page Application (Vite)                                   |
| ADM    | `(admin)` Next.js route group                                    |
| SF     | `(storefront)` Next.js route group                               |
| GH     | GitHub                                                           |
| GATE   | Files gated for deletion after Firestore production confirmation |

### Key Paths

- `src/constants/` files are not the source of truth anymore — Firestore is. Delete them after prod seed is confirmed.
- `src/lib/firebase/env.ts` replaced 3 separate inline `NODE_ENV` checks that had diverged.
- The Admin SDK path (`firebase/admin.ts`) previously missed `NODE_ENV === 'development'` — now fixed via the shared `isEmulator` flag.

---

## Phase 2 — Inventory Scope Preview

New files for Clover POS ↔ Firestore bidirectional sync.

```
src/lib/clover/
├── client.ts                          # Clover REST API wrapper (server-only)
├── webhook.ts                         # Signature validation + event parsing
└── sync.ts                            # Inventory diff logic

src/app/api/clover/
├── webhook/route.ts                   # POST — receives Clover POS events
└── sync/route.ts                      # POST — manual sync trigger

src/lib/repositories/
└── inventory.repository.ts            # inventory/{locationId}/items/

src/types/
└── inventory.ts                       # CloverItem · InventorySnapshot

src/app/(admin)/admin/
└── inventory/[locationId]/page.tsx    # Admin inventory view + sync button
```

Mermaid sync flow diagram will be added when Phase 2 planning begins.
