# Suraksha LMS — Production Architecture & Cost-Optimized Deployment

**Goal:** Run the NestJS backend reliably for **50,000 registered users, ~500 concurrent
average**, with the **critical path being attendance marking** — 20,000 students marked
across 100 devices in a 30-minute morning window (07:00–07:30), while keeping
infrastructure cost low and ensuring the attendance burst never starves the rest of the API.

---

## 1. The real load (size it honestly, don't over-provision)

| Metric | Value | Notes |
|---|---|---|
| Registered users | 50,000 | mostly idle at any moment |
| Concurrent active (avg) | ~500 | normal browsing/API |
| Attendance burst | 20,000 marks / 30 min | the one thing that must not fail |
| Average mark rate | ~11 marks/sec | 20000 ÷ 1800s |
| **Realistic peak mark rate** | **~50–150 req/s** | bursty: kids tap in clusters at the gate |
| Devices marking | 100 | each typically sends **batches**, not 1-by-1 |

**Key insight:** ~150 req/s is *small* for one tuned Node process. You do **not** need a big
cluster. The failure modes here are not raw throughput — they are:

1. **Notification fan-out blocking the mark** (SMS/WhatsApp/email per student).
2. **DB connection-pool exhaustion** when the burst opens more connections than the pool allows.
3. **One feature's load starving another** (your `100 users → $5` concern — see §6).
4. **Cost creep** from autoscaling on the wrong signal or running always-on big instances.

---

## 2. Recommended topology (lowest viable cost, room to grow)

```
                     ┌────────────────────────────────────────────┐
   Devices / Web ──► │  Cloudflare (free tier)                     │
                     │  - DNS, TLS, CDN for static assets          │
                     │  - WAF + basic DDoS + rate-limit rules      │
                     └───────────────┬────────────────────────────┘
                                     │
                     ┌───────────────▼────────────────────────────┐
                     │  Load balancer / Cloud Run / single VM+Nginx│
                     └───────────────┬────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
     ┌────────▼────────┐   ┌─────────▼────────┐   (autoscale 1→N
     │ API instance #1 │   │ API instance #2  │    on CPU, min=1/2)
     │ NestJS (Node)   │   │ NestJS (Node)    │
     └───┬─────────┬───┘   └────┬────────┬────┘
         │         │            │        │
         │         └──────┬─────┘        │
         │                │              │
   ┌─────▼─────┐   ┌──────▼──────┐  ┌────▼─────────────┐
   │  MySQL    │   │   Redis     │  │ Notification     │
   │ (primary) │   │ (cache +    │  │ worker (async)   │
   │ +1 read   │   │  queue +    │  │ - consumes queue │
   │  replica  │   │  rate-limit)│  │ - SMS/WA/email   │
   └───────────┘   └─────────────┘  └──────────────────┘
```

### What each piece is and why
- **Cloudflare (free):** absorbs DDoS, terminates TLS, caches static frontend assets, and
  lets you write a **rate-limit rule per route** at the edge (your "block other resource
  APIs, not this one" requirement — §6). Costs $0 at this scale.
- **2 small API instances behind a balancer** (not 1): redundancy + zero-downtime deploys.
  Each instance handles your peak easily. Autoscale up only on real CPU pressure.
- **MySQL primary + 1 read replica:** writes (attendance marks) go to primary; heavy reads
  (reports, dashboards, "who's present") go to the replica so the morning report traffic
  doesn't compete with the mark writes.
- **Redis:** already in use — cache, plus a **lightweight queue** for notifications, plus
  the **per-feature rate limiter** (§6).
- **Notification worker:** a separate process (or the same image with a `WORKER=true` flag)
  that drains the notification queue. **Marking attendance must never wait on SMS/WhatsApp.**

---

## 3. Concrete sizing & cost (monthly, rough, USD)

This fits comfortably on modest hardware. Two viable shapes:

> **Your DB is already Cloud SQL (Google managed MySQL), separate from the app.** Good —
> that's exactly right. Keep it. The only additions needed are a **read replica** and the
> **Cloud SQL Auth Proxy** on each app instance (your `.env.example` already documents the
> proxy on 127.0.0.1:3306). Stay in the **same GCP region** as the app to avoid cross-region
> latency + egress cost on every query.

### Option A — Compute Engine VM + Cloud SQL (cheapest, simplest) ✅ recommended to start
| Component | Spec | ~Cost/mo |
|---|---|---|
| 1 Compute Engine VM (API + worker, PM2 2 procs) | e2-medium (2 vCPU / 4 GB) | $25–35 |
| Cloud SQL MySQL (you already have this) | db-custom-2-4096 | $50–70 |
| Cloud SQL read replica | same tier | $50–70 |
| Memorystore Redis | 1 GB basic | $35 |
| Cloudflare | Free | $0 |
| Cloud Storage (GCS) | pay-per-use | $5–20 |
| **Total** | | **~$165–230/mo** |

> If cost is tight, the **read replica is the one optional line** — skip it initially and add
> it the moment morning report traffic starts competing with mark writes. Without the replica
> you're at **~$115–160/mo**.

Handles 500 concurrent + the 150 req/s burst with headroom. Add a second VM ($24–40) when
you want HA. **This is the right starting point — do not buy more until metrics say so.**

### Option B — Cloud Run + Cloud SQL (pay-per-use, scales down off-peak)
| Component | Config | ~Cost/mo |
|---|---|---|
| Cloud Run (API) | min=1, max=5, 1 vCPU / 1 GB | $20–60 (usage-based) |
| Cloud Run (worker) | min=1, max=3 | $10–30 |
| Cloud SQL MySQL + replica | db-custom-2-4096 | $100–140 |
| Memorystore Redis | 1 GB basic | $35 |
| **Total** | | **~$165–265/mo** |

Cloud Run fits your traffic shape well (idle most of the day, one 07:00 burst) — it scales the
API down between bursts so you pay for usage, not idle. **But `min=1` is mandatory** (see §5
cold-start warning) and connect to Cloud SQL via the built-in Cloud SQL connector. Since you're
already on GCP + Cloud SQL, Option B is a natural fit — but Option A is cheaper and has zero
cold-start risk on the morning burst, so start there.

> **Recommendation:** Start with **Option A**. It's cheaper, has no cold-start risk on the
> attendance burst, and 50k users at this concurrency genuinely does not need more.

---

## 4. The attendance critical path — make it bulletproof & cheap

This is the one operation that must not fail at 07:00. Four rules:

### 4.1 Marking must be a fast, non-blocking write
The code already does this correctly: `scheduleAttendanceNotification()` is **fire-and-forget**
([attendance.service.ts:1782](../lms-api-suraksha-lk/src/modules/attendance/attendance.service.ts#L1782)),
and ad matching is pre-computed daily, not per-scan. **Keep it that way.** The HTTP response
should return as soon as the attendance row is written — never await SMS/WhatsApp/email.

### 4.2 Push notifications through a queue, not inline
Today each mark spawns its own concurrent SMS/WhatsApp/email HTTP calls. At 150 marks/s that's
hundreds of concurrent outbound calls — socket exhaustion + provider rate-limit trips.

**Fix:** marks enqueue a job to Redis; the **notification worker** drains it with a bounded
concurrency (e.g. 10–20 in flight) and respects provider limits. This:
- keeps the mark path instant,
- smooths the burst (the worker can take 10 minutes to send 20k messages — parents don't need them in the same second),
- isolates provider failures from attendance.

### 4.3 Devices should send BATCHES, not one request per student
You already built `POST /api/external/v1/attendance/sessions/:id/mark-bulk`. **Use it.**
100 devices × 200 students batched = a few hundred bulk requests total instead of 20,000
individual ones. This single change removes ~95% of the request volume on the critical path.

### 4.4 Tune the Cloud SQL connection pool for the burst
`.env` has `DB_POOL_SIZE=20`, `DB_CONNECTION_LIMIT=25`. With 2 instances that's 40–50
connections. **Cloud SQL has a `max_connections` flag that scales with the instance tier** —
a db-custom-2-4096 defaults to a few hundred, which is plenty here, but verify:
`total app connections (pool × instances) + replica + admin headroom < max_connections`.
Raising the app pool blindly causes "Too many connections" errors that look like an outage.
Keep the pool modest, rely on **batching + fast writes** to return connections quickly, and
connect through the **Cloud SQL Auth Proxy** (already in `.env.example`) rather than a public
IP — it's more secure and pools/keeps connections warm for the burst.

### 4.5 Pre-create sessions before 07:00
Don't let the 07:00 burst also trigger session creation. Generate the day's sessions in a
05:00 cron (the daily-ad-assignment cron already runs at 05:00 — co-locate this). At 07:00 the
devices only do `mark-bulk` against an existing session: pure inserts, no setup.

---

## 5. Things that will bite you (from your codebase specifically)

| Risk | Why | Mitigation |
|---|---|---|
| **WhatsApp 24h session window is in-memory** (`whatsappSessionWindow` Map) | Resets on restart; wrong across multiple instances | Move it to Redis (shared) before running >1 instance |
| **In-process notification fan-out** | Burst opens hundreds of outbound sockets | Redis queue + bounded-concurrency worker (§4.2) |
| **Cloud Run `min=0` cold start** | First mark at 07:00 hits a cold container → timeout | Set `min=1` (or `min=2`); or use Option A (always-on) |
| **Reports on the primary DB** | Morning "who's present" dashboards compete with mark writes | Route reads to the **replica** |
| **Two ad-delivery paths** (one re-runs live matching per student) | Extra DB hit on the hot path via `class-attendance-session.service.ts` | Route it through the pre-assigned `getAssignedAd` path |
| **`apiCache` always-on, `secureCache` flag-gated** | Inconsistent cache behavior | Keep `CACHE_ENABLED=true`; ensure Redis is the cache backend, not in-memory, once multi-instance |

---

## 6. Per-feature rate limiting — "don't let one API block the others"

Your concern: *"if 100 users hit one API it shouldn't cost $5 / block other endpoints."*
This is **fairness + cost isolation**, solved at two layers:

### Layer 1 — Edge (Cloudflare, free)
Write rate-limit rules **per path**. Example intent:
- `/api/external/v1/attendance/*` → generous (this is the critical burst, allow it)
- `/api/reports/*`, `/api/advertisements/*`, bulk/export endpoints → tight cap
- everything else → moderate default

So a flood on reports/exports gets throttled at the edge **before** it ever reaches Node or
the DB — the attendance path stays free. This is the cheapest possible isolation ($0).

### Layer 2 — App (already partly built)
- The global throttler is layered (3/s, 20/10s, 100/min per IP).
- The new `ApiKeyThrottlerGuard` rate-limits **per API key**, not per IP — so one institute's
  migration script can't exhaust everyone's budget.
- Add **per-route throttle overrides** (`@Throttle`) on expensive endpoints (reports, exports,
  bulk sends) so they get a *smaller* budget than cheap reads. The attendance mark endpoint
  gets a *larger* budget.

### Layer 3 — Protect the DB from any single feature
- Expensive aggregate endpoints (attendance grid for 500 students × 20 lectures, analytics)
  should: (a) hit the **read replica**, (b) be **cached in Redis** with a short TTL, (c) be
  **paginated** (the grid can OOM — known issue). One heavy report must not lock the pool the
  attendance writes need.

**Net effect:** a spike on any non-critical feature is throttled at the edge, isolated by
per-route budgets, and served from cache/replica — it cannot block or inflate the cost of
attendance marking.

---

## 7. Cost-reduction checklist (do these, they're free wins)

1. **Batch attendance** (§4.3) — biggest single lever; ~95% fewer requests.
2. **Cache hot reads in Redis** — institute/features/RBAC/active-ads are already cached; make
   sure TTLs are sane so you're not re-querying MySQL every request (the API-dedup work already
   helps here).
3. **Read replica for reports** — keeps the primary small (= cheaper) instead of scaling it up
   to absorb report load.
4. **Autoscale on CPU with a floor**, not a fixed large fleet — `min=1–2`, scale to 3–5 only
   during the 07:00 window, back down after. With Option A, just run 2 small VMs always-on.
5. **Notifications async + batched** — fewer, pooled outbound connections; provider costs
   (SMS especially) become predictable, not spiky.
6. **Cloudflare cache for the 3 frontends** — static assets served from edge, $0 egress from origin.
7. **Don't over-provision MySQL** — 2 vCPU/4GB + replica is plenty here; measure before upsizing.

---

## 8. Suggested rollout order

1. **Now:** keep Option A (single VM + managed MySQL + Redis), 2 PM2 processes (API + worker).
2. **Before multi-instance:** move the WhatsApp session window and any in-memory cache to Redis.
3. **Before the first big morning:** confirm sessions are pre-created at 05:00, devices use
   `mark-bulk`, notifications go through the queue, reports hit the replica.
4. **Edge rate rules:** add Cloudflare per-path limits (tight on reports/exports, loose on
   attendance).
5. **Load test** the 07:00 scenario: simulate 100 devices × batched 200 students in a 10-minute
   window and watch DB connections, p95 latency, and queue depth. Tune pool/worker concurrency
   from real numbers, not guesses.
6. **Add the 2nd VM / raise autoscale max** only if the load test shows you need it.

---

## 9. One-line summary

At 50k users / 500 concurrent / a 20k-mark morning burst, this is a **small-to-medium**
workload: **two small always-on API instances + managed MySQL (with a read replica) + Redis +
an async notification worker, fronted by Cloudflare for free edge rate-limiting** runs it
reliably for **~$95–180/month** — provided you **batch the marks, send notifications
asynchronously through a queue, serve reports from the replica/cache, and rate-limit expensive
endpoints at the edge** so no single feature can block or inflate the cost of attendance marking.
