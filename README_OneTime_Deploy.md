# One-Time Deployment (Minimal)

## 1) Vercel
- Create project from this repo.
- Env vars:
  - `DATABASE_URL` (Postgres)
  - `API_KEY`, `ADMIN_KEY`
  - `PUBLIC_BASE_URL` (https://…)
  - `DEFAULT_STORE_CODE`, `DEFAULT_AMOUNT`, `DEFAULT_CURRENCY`
  - `TERMINAL_PREFIX`, `TERMINAL_PAD`
- Deploy (Prisma migrates automatically).

## 2) Admin
- Open `/admin` → login with `ADMIN_KEY`.
- Admin → Devices: add ESP32 MAC and choose store; a terminalId is assigned.

## 3) ESP32
- Open `firmware/esp32_nfc_softap_pay/esp32_nfc_softap_pay.ino`.
- Set `BASE_URL`, `API_KEY`. Flash.
- Connect via SoftAP portal; device writes tag for `/p/{terminalId}` and waits.

## 4) Demo
- Visit `/p/{terminalId}` → Generate Payment.
- Tap tag / open link → Approve (Sandbox).
- Only newest pending can be approved; older pendings are auto-canceled.
