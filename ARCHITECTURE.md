# Architecture Overview

This is a map of how the codebase is organized and why, plus the non-obvious
conventions and gotchas that aren't visible from reading any single file.
See [README.md](README.md) for the feature list and local setup, and
[DEPLOY.md](DEPLOY.md) for production deployment.

## Stack & deployment topology

- **Frontend:** React 18 + TypeScript, built with Vite, deployed to **Vercel**.
  Vercel auto-deploy on push is **not** configured for this project — deploy
  with `vercel --prod` from the repo root after pushing frontend changes.
- **Backend:** FastAPI (Python) + PyMongo (sync), deployed to **Railway**.
  Railway's GitHub integration *is* wired up — every push to `main` rebuilds
  and redeploys automatically.
- **Database:** MongoDB Atlas.

Because the two deploy pipelines are asymmetric, a change that touches both
frontend and backend needs a `git push` (backend ships itself) **and** a
manual `vercel --prod` (frontend doesn't).

## Backend layout (`backend/app/`)

```
routers/     One file per domain (products.py, orders.py, ...). Each file
             exports a public `router` and, for domains with an admin
             surface, a second `admin_router` — see below.
services/    Business logic + all MongoDB access. Routers stay thin: parse
             the request, call a service function, return its result.
models/      Pydantic request/response schemas (this project doesn't use a
             separate models/ vs schemas/ split — one folder does both).
middleware/  Starlette HTTP middleware (security headers, Mongo-injection
             guard, cache-control) — registered in main.py in a specific
             order that must be preserved (see the comment there).
utils/       Shared helpers with no business logic of their own: ObjectId
             validation (mongo.py), slug generation (slug.py), the APScheduler
             wrapper (scheduler.py), password/JWT helpers (security.py),
             index creation (db_init.py).
dependencies.py   FastAPI Depends() functions — get_db, get_current_user,
                  require_admin, require_driver, get_optional_user. Read this
                  file first if you're new to the auth model.
```

There is no repository/data-access layer between services and PyMongo —
services call `db.<collection>.find(...)` directly. This was a deliberate
choice to keep here: with one MongoDB driver and no plan to swap databases,
a repository abstraction would add a layer of indirection with no real
consumer, for a codebase this size.

### The `admin_router` pattern

Admin endpoints for a domain live in the **same file** as that domain's
public router, as a second `APIRouter` with no path prefix and fully
explicit paths:

```python
# app/routers/coupons.py
router = APIRouter(prefix="/coupons", tags=["Coupons"])       # public
admin_router = APIRouter(tags=["Admin"])                       # admin

@router.get("/coupons")                       # → GET /coupons
def list_coupons(...): ...

@admin_router.get("/admin/coupons")           # → GET /admin/coupons
def admin_list_coupons(user: dict = Depends(require_admin), ...): ...
```

Both routers are registered in `main.py`:
```python
app.include_router(coupons.router)
app.include_router(coupons.admin_router)
```

Two domains with no public counterpart (`admin_products.py`,
`admin_analytics.py`) are admin-only files with just a `router`. This
replaced a single 1,328-line `admin.py` that held every domain's admin
routes in one file — split apart so each domain's public and admin logic
live together instead of in two unrelated places.

### Shared query helpers

- `app.utils.mongo.get_object_id(id_str, label)` — validates and converts a
  string to a `bson.ObjectId`, raising a 400 with a clear message on failure.
  Use this for any strict "must be a valid ID or reject the request" case.
  A few call sites deliberately do **not** use it — where an invalid ID
  should be silently skipped or ignored rather than rejected (e.g. a filter
  parameter, or a bulk operation that skips bad rows) — check the surrounding
  comment before "cleaning up" a bare `try/except ObjectId(...)` you find.
- `app.utils.slug.slugify(text)` / `unique_slug(db, collection, base, exclude_id)`
  — shared slug generation + collision handling (appends `-1`, `-2`, ...).

## Frontend layout (`src/`)

```
pages/       One folder per route (Home, Products, Admin/Products, ...).
features/    Cross-cutting feature modules with their own hooks/components
             (currently: auth, cart, wishlist) — bigger than a single
             component but not a full page.
components/
  ui/        Generic, presentational primitives with no business logic:
             Button, Modal, Pagination, Input, Badge, Spinner.
  shared/    Business-aware components reused across pages (ProductCard,
             ImageUploader, RecipeCard, ErrorBoundary, ...).
  layout/    Page chrome: RootLayout, AdminLayout, Navbar, Footer.
hooks/       Shared custom hooks not tied to one feature.
services/api/  One file per backend domain, wrapping axiosInstance calls.
types/       Shared TypeScript types.
utils/       Formatting helpers (currency, dates), pure functions.
constants/   Routes, static config.
```

### The `Modal` tone system

`components/ui/Modal.tsx` was originally built for the storefront's
navy/gold "premium" design system (used by `Button`, `Input`, `Badge`, and
the customer-facing pages) and had no real consumers for a long time. Every
`Admin/*` page instead hand-rolled its own modal, each with its own copy of
the backdrop/portal/escape-key/scroll-lock/animation logic.

`Modal` now supports both, via a `tone` prop:
```tsx
<Modal isOpen onClose={onClose} title="Edit Coupon" size="md" tone="admin">
```
- `tone="premium"` (default) — navy/gold, for any future storefront modal.
- `tone="admin"` — ocean/mint, matching every existing Admin/* page.

`size` matches Tailwind's own scale directly (`sm`/`md`/`lg`/`xl`/`2xl` →
`max-w-sm`/`md`/`lg`/`xl`/`2xl`) rather than an arbitrary 3-step scale, so it
can express whatever width a given modal actually needs.

Two modals were deliberately **not** migrated onto this shared component,
and shouldn't be forced onto it later without redesigning them first:
- `Admin/Products`' product-edit panel is a genuine full-height side drawer,
  not a centered dialog.
- `Admin/Dashboard`'s order-detail modal has an internal fixed-header /
  fixed-tabs / independently-scrolling-body / fixed-footer layout that
  `Modal`'s single-scrollable-body contract can't express without breaking
  the sticky tabs and footer.

### The `Pagination` component

`components/ui/Pagination.tsx` consolidates what used to be 7 near-identical
hand-rolled "Page X of Y" + prev/next blocks. It takes `variant` (`bordered`
default / `centered`) and `buttons` (`icons` default / `text`) so each
existing call site keeps its own visual style exactly — the component
removes duplicated logic, it doesn't restyle anything.

## Testing

- Backend: `cd backend && python -m pytest -q` — 550+ tests against a real
  local MongoDB (not mocked). **Never run pytest concurrently in two
  terminals** — both runs share the same local test database and will
  stomp on each other's data mid-run. Check for a stray `python.exe`
  running pytest before starting a new run.
- Frontend: `npx vitest run` (589+ tests) and `npx tsc -b` (typecheck).
  The dev server (`npm run dev` / `uvicorn --reload`) can run at the same
  time as tests without conflict — only concurrent *test* runs are unsafe.

## Known gotchas

- **`uvicorn --reload` can serve stale bytecode** after large/non-editor
  file edits (e.g. a scripted find-and-replace across many files, or a git
  operation). If behavior doesn't match the code you just changed, kill the
  process, delete `__pycache__` directories, and restart — don't assume the
  reload watcher caught everything.
- **Unique MongoDB indexes need a duplicate check first.** `db_init.py`'s
  `create_indexes()` isn't wrapped in error handling in `connect_to_mongo()`
  — if you add a new `unique=True` index and a duplicate value already
  exists in that collection (locally or in production), the app will crash
  on startup. Check for duplicates before adding one.
- **Razorpay is still in test-mode keys in production** — a known, tracked
  blocker before real payments can go live (see DEPLOY.md's "Going live
  with Razorpay" section).
- **MongoDB Atlas is likely still on the M0 free tier**, which has no
  continuous backup. See DEPLOY.md Step 6 before real orders depend on this
  data being recoverable.
- **The scheduled background jobs (abandoned-cart reminders, low-stock
  digest) are already safe to run across multiple worker processes** —
  `app/utils/scheduler.py`'s `claim_daily_run()` and the abandoned-cart
  job's per-cart atomic claim both exist specifically so this doesn't
  double-send if you ever run more than one instance/worker. If you add a
  new scheduled job, give it the same kind of atomic claim — don't assume
  single-process.
- **MongoDB connection pooling uses PyMongo's default (100 per process)** —
  fine for the single Railway instance running today. If this is ever
  horizontally scaled to N replicas, budget N × pool-size against your
  Atlas tier's total connection limit (M0 caps at 500) and tune
  `MongoClient(..., maxPoolSize=...)` in `app/database.py` accordingly.
