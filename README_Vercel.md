# NFC Pay Starter (Vercel)

**Deploy in minutes on Vercel + Neon.**

## 1) Neon
- Create a project; copy the **pooled** connection URL (has `-pooler`) and append `?sslmode=require`.

## 2) Vercel
- Create a new project from this repo.
- Set environment variables (Project Settings → Environment Variables):
  - `DATABASE_URL=postgresql://USER:PASS@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`
  - `API_KEY=esp32_test_api_key_123456`
  - `ADMIN_KEY=admin_demo_key_123456`
  - `PUBLIC_BASE_URL=https://<project>.vercel.app`
  - `DEFAULT_STORE_CODE=STORE01`
  - `DEFAULT_AMOUNT=0`
  - `DEFAULT_CURRENCY=USD`
  - `TERMINAL_PREFIX=`
  - `TERMINAL_PAD=4`
- Build command is overridden in `vercel.json` to run Prisma migrations before Next build.

## 3) Test
- Visit `/admin` → login with `ADMIN_KEY`.
- Visit `/p/ADMIN_TEST` → use Approve (Sandbox) button.
- Device bootstrap: call `/api/v1/bootstrap` with headers `X-API-Key`, `X-Device-Id`.

## 4) ESP32
- Point firmware to `BASE_URL=https://<project>.vercel.app` and use the same `API_KEY`.

## Notes
- Schema lives in `prisma/schema.prisma`; migration in `prisma/migrations/0001_init`.
- If migrations fail at build, check `DATABASE_URL` is pooled + SSL. You can also run migrations once locally:
  - `npm i && cp .env.example .env` (fill DB) → `npx prisma migrate deploy`

---

## 🧾 Admin: Generate Payment (UI)
- Go to **/admin** → Use the **Generate Payment** form
- Enter **Terminal ID**, optional **Amount** & **Currency**
- You’ll be redirected to the checkout page `/p/<terminalId>` to test the flow

### Operator Tools on Checkout Page
- If you are logged in as admin (cookie set via `/admin` login), the checkout page `/p/<terminalId>` shows an **Operator Tools** panel.
- Use it to **Generate Payment** for that terminal without leaving the page.

## 🧼 Factory Reset (ESP32)
- **Hardware**: Wire a momentary button from **GPIO 34** to **GND**, use an **external pull‑up** (GPIO 34 is input-only).
- **Trigger**: Hold the button **LOW for 3 seconds at boot** → device clears saved Wi‑Fi & store code and reboots.
- **Portal reset**: SoftAP page also has a **Factory Reset** button.

## 🏪 Auto‑Enroll: Stores & Devices
- **Devices**: `GET /api/v1/bootstrap` upserts a `Device` row keyed by `X-Device-Id` (ESP32 MAC).
- **Stores**: Send `X-Store-Code: STORE01` (or use `?store=STORE01`). If it’s a new store, a `TerminalSequence` row is created automatically.
- **Terminal IDs**: The next terminal number is assigned per store (e.g., `STORE01-0001`, padding configured via `TERMINAL_PAD`; optional prefix via `TERMINAL_PREFIX`).

## 📶 SoftAP Store Code
- The SoftAP provisioning page now lets you save an optional **Store Code**. The firmware will pass this as `X-Store-Code` during bootstrap.


## Pending Sessions
- Only the **newest** pending session per terminal can be approved.
- Approving the newest **auto-cancels** all older pendings.
- Admin tools on `/p/{terminalId}`: Cancel single older, Cancel All Older Pending, and Cancel Newest.

## Device
- ESP32 polls `/api/v1/sessions` and acts only on the newest pending for its terminal.

### Sandbox Customer URL
- Public test endpoint (NO AUTH): `/api/sandbox/customer-pay?terminalId={terminalId}`
- Approves the **newest** pending for that terminal and cancels older ones.
- Intended for demo only.
