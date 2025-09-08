# NFC Pay — Complete Setup & ESP32 Guide

A demo NFC checkout system that pairs a **Next.js + Prisma** backend with an **ESP32 + PN532** tag writer. Operators generate payments; a customer taps the tag to open the checkout page and (in demo mode) “approve” the payment. The device auto-writes/updates the NDEF tag and tracks payment state.

> **Demo only.** This repo is intentionally simplified and includes a public “sandbox approve” URL. Do not deploy to production without hardening.

---

## Features

- **Operator Tools** on `/p/{terminalId}`  
  - Generate Payment (amount optional)  
  - **Pending Session Manager** (admin): list/cancel older pendings, **Cancel Newest**, **Cancel All Older Pending**
- **Session rules**  
  - Only the **newest** pending for a terminal can be approved  
  - Approving newest → **auto-cancels all older** pendings
- **ESP32 firmware**  
  - SoftAP Wi-Fi provisioning portal  
  - Auto-bootstrap from server → write verified NDEF URL (`/p/{terminalId}`)  
  - Poll newest pending → auto-write & track until paid  
  - WS2812B + buzzer status cues (starting, writing, pending, paid, error)
- **Admin**  
  - `/admin` dashboard: recent sessions, live status (`paid` / `pending` / `canceled`)
- **Demo customer approval**  
  - Public endpoint for tests: `/api/sandbox/customer-pay?terminalId=...`

---

## Project Structure

```
app/
  admin/                    # admin dashboard + devices
  api/
    admin/sessions/         # cancel, cancel-older
    sandbox/                # sandbox customer-pay
    v1/                     # bootstrap, sessions, (ack stub)
  p/[terminalId]/page.tsx   # checkout page + operator tools + pending manager
firmware/
  esp32_nfc_softap_pay/esp32_nfc_softap_pay.ino
prisma/
  schema.prisma
src/
  lib/ (prisma, auth, env, etc.)
README_OneTime_Deploy.md (optional for clients)
```

---

## Requirements

- **Node** ≥ 18  
- **Postgres** (e.g., Neon)  
- **Vercel** (recommended)  
- **Arduino IDE** for ESP32 firmware  
  - ESP32 board support (Espressif)  
  - Libraries: **Adafruit PN532**, **Adafruit NeoPixel**

---

## Environment Variables

| Key                 | Example / Notes                         |
|---------------------|------------------------------------------|
| `DATABASE_URL`      | Postgres connection string               |
| `PUBLIC_BASE_URL`   | `https://your-project.vercel.app`        |
| `API_KEY`           | Any random secret (also used by device)  |
| `ADMIN_KEY`         | Password for admin cookie login          |
| `DEFAULT_STORE_CODE`| `STORE01` (used at bootstrap)            |
| `DEFAULT_AMOUNT`    | `0`                                      |
| `DEFAULT_CURRENCY`  | `USD`                                    |
| `TERMINAL_PREFIX`   | `STORE01-`                               |
| `TERMINAL_PAD`      | `5` (zero-pad width for terminal seq)    |

---

## Quick Start (Cloud App)

1. **Create** a new Vercel project from this repo.  
2. **Configure** the environment variables above.  
3. **Deploy**. (Prisma migrations run automatically.)  
4. **Admin login:** open `/admin`, log in with `ADMIN_KEY` (sets `admin` cookie).  
5. **Enroll device:** `/admin → Manage Devices`  
   - Add ESP32 MAC (uppercase `AA:BB:CC:DD:EE:FF`)  
   - Assign a `storeCode` → a `terminalId` is created

---

## ESP32 — Setup & Firmware

### Hardware (defaults in the sketch)

| Purpose       | Define         | GPIO |
|---------------|----------------|------|
| PN532 **SCK** | `PN532_SCK`    | 18   |
| PN532 **MOSI**| `PN532_MOSI`   | 23   |
| PN532 **MISO**| `PN532_MISO`   | 19   |
| PN532 **SS**  | `PN532_SS`     | 5    |
| PN532 **RST** | `PN532_RST`    | 27   |
| **WS2812B DIN** | `WS_PIN`    | 13   |
| **WS2812B count** | `WS_COUNT`| 1    |
| **Buzzer**    | `BUZZER_PIN`   | 4    |
| **LED**       | `LED_PIN`      | 2    |
| (Spare input) | `FACTORY_PIN`  | 34   |

> Set the PN532 board to **SPI** mode (jumpers on the breakout).

### Arduino IDE

1. Install **esp32** core.  
2. Install libraries **Adafruit PN532** & **Adafruit NeoPixel**.  
3. Open: `firmware/esp32_nfc_softap_pay/esp32_nfc_softap_pay.ino`  
4. Set these at the top:
   ```cpp
   const char* BASE_URL = "https://your-project.vercel.app";
   const char* API_KEY  = "<same value as Vercel API_KEY>";
   ```
5. Select **ESP32 Dev Module**, upload (Serial **115200**).

### Wi-Fi Provisioning (built-in)

- On first boot (or after factory reset), the device starts a **SoftAP** (SSID begins with `NFC-PAY-Setup-…`).  
- Connect to the AP and open the captive portal (or `http://192.168.4.1`).  
- Enter Wi-Fi SSID, password, and optional **Store Code**; save & reboot.  
- The device connects to your Wi-Fi and proceeds to bootstrap.

### What the firmware does

- **Bootstrap** → `GET /api/v1/bootstrap`  
  Receives `terminalId`, optional `checkoutUrl`.
- **Write NDEF** → Writes verified URL (default `/p/{terminalId}`) to the tag.  
- **Poll newest pending** → Every ~2s checks the newest pending session for its terminal.  
  On new pending: **re-writes** the tag and starts tracking that session.  
- **LED & buzzer states**  
  - **Starting**: dim blue (breathing)  
  - **Writing**: cyan (breathing)  
  - **Pending**: yellow (breathing)  
  - **Paid**: solid green + short chime  
  - **Error**: blinking red  
- Confirmed on **NTAG213** (other NDEF tags w/ enough capacity should work).

---

## Using the System (Demo Flow)

1. Open **`/p/{terminalId}`**.  
2. Click **Generate Payment** (optionally set amount).  
3. Customer taps the tag, opens the page, and clicks **Approve (Sandbox)**:
   - **Public test URL** (no auth):  
     `/api/sandbox/customer-pay?terminalId={terminalId}`  
     → Sets the **newest** pending to **paid**, **cancels** older, and redirects back.
4. The device detects **paid** (LED turns green + chime).  
5. Admin dashboard shows up-to-date statuses.

**Rules to prevent cascades**
- Only the **newest** pending can be approved.  
- Approving newest **auto-cancels** older pendings.  
- From the checkout page (admin-only): **Cancel Newest**.  
- From the Pending Manager (admin): cancel any older, or **Cancel All Older**.

---

## API (selected)

> All `/api/v1/*` endpoints expect headers from devices:  
> `X-API-Key: <API_KEY>` and `X-Device-Id: <MAC>` (uppercase).  
> The public sandbox endpoint below **does not** require auth.

- `GET /api/v1/bootstrap` → `{ deviceId, storeCode, terminalId, amount, currency, checkoutUrl }`  
- `GET /api/v1/sessions` → list sessions (newest first)  
- `GET /api/v1/sessions/latest?terminalId=...` → newest pending (optional)  
- `POST /api/admin/sessions/create` (form) → create pending for a terminal  
- `POST /api/admin/sessions/cancel` (form) → cancel a specific session  
- `POST /api/admin/sessions/cancel-older` (form) → cancel all older pendings for a terminal  
- `POST /api/sandbox/pay` (admin/auth) → approve a **specific** session (newest-only guard)  
- `GET  /api/sandbox/customer-pay?terminalId=...` → **public demo** approve newest & cancel older  
- `POST /api/v1/device/ack` → **no-op stub** (kept for compatibility)

---

## Local Development

```bash
# install deps
npm install

# generate prisma client
npx prisma generate

# start dev server
npm run dev

# apply migrations (in CI/Prod)
npx prisma migrate deploy
# (or for local prototyping)
npx prisma db push
```

---

## Security & Production Notes

- The **public** endpoint `/api/sandbox/customer-pay` is for **demo only**.  
  Remove or guard it (auth/signatures) before production.
- Use HTTPS with a valid cert (device uses TLS).  
- Lock down `API_KEY` and device enrollment; validate `X-Device-Id`.
- Rate-limit mutation endpoints; add CSRF for web forms if you keep them.

---

## Troubleshooting

- **Admin shows “pending” after actions**  
  This build renders `/admin` dynamically and revalidates after mutations. Hard refresh if you changed caching policies.
- **Device can’t write the tag**  
  Ensure PN532 is **SPI** and wired to the GPIOs in the table; hold the tag 2–3 cm from the antenna and steady for ~1 s.
- **Unauthorized when approving**  
  Use the **public demo** URL from the checkout page (or `/api/sandbox/customer-pay?terminalId=...` directly).
- **Device not found**  
  Add the MAC in **Admin → Devices** (uppercase). The device logs its MAC on boot (Serial 115200).

---

## License

MIT (or your preference). Replace this section if you require a different license.
