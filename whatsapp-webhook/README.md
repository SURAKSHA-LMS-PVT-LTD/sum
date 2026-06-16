# Suraksha LMS — WhatsApp Webhook

Lightweight, **independent** Node.js service (Express + mysql2). It does not
depend on the main NestJS backend at runtime — it talks directly to the same
MySQL database.

## What it does

1. **Greeting → attendance** (`hi/hello/me/මෙ/හායි/හෙලෝ`):
   - Looks the sender up **by phone number only**.
   - Not registered → `You are not registered.`
   - Student (`USER` / `USER_WITHOUT_PARENT`) → last 7 days attendance.
   - Parent (`USER_WITHOUT_STUDENT`) → lists children → user picks a number →
     that child's last 7 days. No children → "no students linked".
2. **Reverse-OTP confirmation** (`OTP 123456`):
   - Confirms a pending WhatsApp OTP in `user_otps` / `password_reset_tokens`.
   - **Security:** the code must match AND the WhatsApp sender's phone must
     equal the phone the OTP was issued for. Leaked codes from another phone are
     rejected. 5 failed attempts invalidates the code.

## Environment

Copy `.env.example` → `.env` and fill in:

| Var | Notes |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number id |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verify token (matches Meta dashboard) |
| `WHATSAPP_BUSINESS_NUMBER` | The number users send OTPs TO (digits). **Must match the main backend's `WHATSAPP_BUSINESS_NUMBER`.** |
| `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` | Same DB as the LMS backend |
| `PORT` | Local only — **Cloud Run sets this automatically** (8080) |

## Run locally

```bash
npm install
cp .env.example .env   # fill values
node index.js
```

## Deploy to Google Cloud Run

The service is containerized (`Dockerfile`) and listens on `$PORT` (Cloud Run
injects `8080`).

```bash
# Build & deploy from this directory
gcloud run deploy suraksha-wa-webhook \
  --source . \
  --region <your-region> \
  --allow-unauthenticated \
  --set-env-vars "WHATSAPP_ACCESS_TOKEN=...,WHATSAPP_PHONE_NUMBER_ID=...,WHATSAPP_VERIFY_TOKEN=...,WHATSAPP_APP_SECRET=...,WHATSAPP_BUSINESS_NUMBER=947...,DB_USERNAME=...,DB_PASSWORD=...,DB_DATABASE=..." \
  --add-cloudsql-instances <project:region:instance>
```

### ⚠️ Important Cloud Run notes

- **The service is fully stateless — it can scale freely** (no `--max-instances 1`
  needed). The parent → child step uses a tappable WhatsApp list whose row id
  carries the child's id; on tap the bot re-verifies access by the sender's
  phone and re-queries the DB. Nothing is kept in memory between messages, so
  any instance can handle any message. The OTP flow is likewise fully DB-backed.
- **Cloud SQL:** connect via the Cloud SQL connector (`--add-cloudsql-instances`)
  and set `DB_HOST=127.0.0.1` / `DB_PORT=3306` (or the unix socket path), the
  same way the main backend connects.
- **Webhook URL in Meta:** point the WhatsApp Business webhook to
  `https://<cloud-run-url>/webhook`, set the verify token to
  `WHATSAPP_VERIFY_TOKEN`, and subscribe to the `messages` field.
- **Health check:** `GET /health` returns `{ "status": "ok" }`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/webhook` | Meta verification challenge |
| POST | `/webhook` | Incoming messages (returns 200 immediately, processes async) |
| GET | `/health` | Health check |
