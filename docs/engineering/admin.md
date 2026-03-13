# Admin CMS — Module Architecture

> Server-side admin interface for managing Rush N Relax content and inventory.
> Auth is enforced at the middleware layer via Firebase session cookies.
> Style governed by [mermaid-standard.md](./mermaid-standard.md).

---

## Auth Flow

How an admin session is established and protected.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

flowchart TD

    REQ(["Admin request\n/admin/*"]):::title

    REQ --> MW{"__session cookie\npresent?\nmiddleware.ts"}

    MW -->|"No"| LOGIN["/admin/login\nLogin page"]:::warn
    MW -->|"Yes"| PASS["Pass through\nto route handler"]:::complete

    LOGIN --> FORM["Email + password\nform submit"]
    FORM --> FBA["Firebase Client Auth\nsignInWithEmailAndPassword"]
    FBA -->|"Auth failed"| ERR["Show error message"]:::warn
    FBA -->|"Auth success"| TOKEN["user.getIdToken()"]
    TOKEN --> SAPI["POST /api/auth/session\n{ idToken }"]
    SAPI --> ADMIN["firebase-admin\ncreateSessionCookie\n5-day expiry"]
    ADMIN --> COOKIE["Set-Cookie: __session\nHttpOnly · SameSite=Strict"]:::complete
    COOKIE --> DASH["/admin/dashboard"]:::complete

    classDef title    fill:#020617,color:#e6edf3,stroke:#22d3ee,stroke-width:2px;
    classDef complete fill:#166534,color:#fff;
    classDef warn     fill:#7f1d1d,color:#fff;
```

### Legend

| Abbrev | Meaning                                       |
| ------ | --------------------------------------------- |
| MW     | `src/middleware.ts` — Edge runtime auth guard |
| FBA    | Firebase Client Auth (`firebase/auth`)        |
| SAPI   | `src/app/api/auth/session/route.ts`           |
| ADMIN  | Firebase Admin SDK (`firebase-admin/auth`)    |

### Key Paths

- All `/admin/*` routes except `/admin/login` require the `__session` cookie.
- The cookie is set server-side (HTTP-only) — not accessible to client JS.
- Firebase Client Auth and the session cookie are separate: Client Auth is for the ID token exchange only; the session cookie is the actual server gate.
- Phase 4 can upgrade to full JWT verification in middleware by switching to `runtime = 'nodejs'`.

---

## CMS Module Map

All admin routes and their data sources.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'background': '#0b0f17', 'primaryColor': '#111827', 'primaryTextColor': '#e6edf3', 'primaryBorderColor': '#22d3ee', 'lineColor': '#94a3b8', 'secondaryColor': '#0f172a', 'tertiaryColor': '#111827', 'clusterBkg': '#0f172a', 'clusterBorder': '#22d3ee', 'fontFamily': 'Avenir Next, Avenir, Segoe UI, sans-serif'}}}%%

flowchart LR

    DASH["/admin/dashboard\nHub"]:::title

    DASH --> LOC["/admin/locations\nLocations table"]
    DASH --> PROD["/admin/products\nProducts table"]
    DASH --> PROMO["/admin/promos\nPromos table"]
    DASH --> INV["/admin/inventory\nLocation picker"]

    INV --> HUB["/admin/inventory/hub\nRnR Hub"]:::active
    INV --> RETAIL["/admin/inventory/locationId\nRetail location"]

    HUB --> HUB_COLS["In-Stock toggle\nAvailable Online toggle"]
    RETAIL --> RETAIL_COLS["In-Stock toggle\nAvailable Pickup toggle"]

    subgraph FS["Firestore"]
        FS_LOC["locations/{slug}"]
        FS_PROD["products/{slug}"]
        FS_PROMO["promos/{slug}"]
        FS_INV["inventory/{locationId}/items/{productId}"]
    end

    LOC --> FS_LOC
    PROD --> FS_PROD
    PROMO --> FS_PROMO
    HUB --> FS_INV
    RETAIL --> FS_INV

    classDef title    fill:#020617,color:#e6edf3,stroke:#22d3ee,stroke-width:2px;
    classDef complete fill:#166534,color:#fff;
    classDef active   fill:#713f12,color:#fff;
    classDef pending  fill:#1e3a5f,color:#ccc;
```

### Legend

| Abbrev | Meaning                                                               |
| ------ | --------------------------------------------------------------------- |
| DASH   | `/admin/dashboard` — navigation hub                                   |
| LOC    | Locations CMS page                                                    |
| PROD   | Products CMS page                                                     |
| PROMO  | Promos CMS page                                                       |
| INV    | Inventory module — Phase 2                                            |
| HUB    | RnR Hub — non-physical warehouse location (`HUB_LOCATION_ID = 'hub'`) |
| FS     | Firestore database                                                    |

### Key Paths

- Dashboard is the entry point after login — all CMS modules link from here.
- Inventory is the only module with a nested route (`[locationId]`).
- Hub inventory items have an `availableOnline` flag — toggles online shipping availability (Phase 3A).
- Retail inventory items have an `availablePickup` flag — toggles buy-online / pick-up-in-store (Phase 3A).
- Compliance guard: setting either flag is blocked if the product's status is `compliance-hold`.
- All admin pages use `export const dynamic = 'force-dynamic'` — no static prerender at build time.
- Writes go through Server Actions (`actions.ts`) which call the repository layer directly.
- Repository upserts sanitize `undefined` optional fields before Firestore `set(..., { merge: true })` to prevent runtime write errors from sparse form payloads.
- Inventory semantics are strict and derived at repository level:
  `inStock = quantity > 0`, and `availableOnline`/`availablePickup` are forced `false` whenever quantity is `0`.
- Inventory writes now append an immutable adjustment log at
  `inventory/{locationId}/items/{productId}/adjustments/{adjustmentId}` in the same batch as the item write.
- Adjustment payload includes before/after snapshots (`previous*`/`next*`), computed delta (`deltaQuantity`), `changedFields`, `reason`, `source`, `updatedBy`, and `createdAt`.
