# NFC Pay (Vercel)

## Pending Sessions
- Only the **newest** pending session per terminal can be approved.
- When a session is approved, **older pending** sessions are **auto-canceled**.
- Admin can manage pendings on `/p/{terminalId}`:
  - Cancel individual older entries
  - Cancel All Older Pending

## Device
- ESP32 polls `/api/v1/sessions` and reacts only to the newest pending.
- Tag is written once per new session; paid status triggers LED/buzzer success.
