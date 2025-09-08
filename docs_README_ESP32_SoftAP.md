# ESP32 SoftAP Provisioning — NFC Pay Starter (Vercel)

This guide shows how to put your ESP32 into **SoftAP mode**, connect from a phone/laptop, enter Wi‑Fi + optional Store Code, and complete first‑time provisioning.

> Firmware path in repo: `firmware/esp32_nfc_softap_pay/esp32_nfc_softap_pay.ino`  
> Default UART: **115200 baud**

---

## What SoftAP does
When no Wi‑Fi credentials are saved (first boot or after factory reset), the ESP32 starts its own Wi‑Fi network (access point). You connect to it from your phone or laptop, open a tiny web page on the device, and save your real Wi‑Fi credentials. The device then reboots and connects to the Internet.

- **AP SSID:** `NFC-PAY-Setup-XXXX` (last 4 hex of MAC)  
- **AP password:** `nfcsetup`  
- **Portal address:** `http://192.168.4.1` (use **http**, not https)
- **Wi‑Fi picker:** The page shows a dropdown list populated by a live scan. Tap **Refresh** to rescan; you can also type a custom SSID.
- **Optional:** Store Code (e.g., `STORE01`) — used to auto-enroll the device to a specific store on the backend

LED while in SoftAP: **fast blink** = not connected to Internet / setup mode.

---

## Step-by-step (phone or laptop)

1) **Power up** the ESP32. On **first boot** or after **factory reset**, it will start SoftAP automatically.  
   If already provisioned, perform a factory reset (see below) to re-enter SoftAP.

2) On your **phone/laptop**, open Wi‑Fi settings and connect to the network:  
   - **SSID:** `NFC-PAY-Setup-XXXX`  
   - **Password:** `nfcsetup`

3) Your device may warn **“No internet”** — **stay connected**:
   - **iOS:** Tap **Use Without Internet** if prompted.
   - **Android:** If it auto-switches to mobile data, **disable mobile data** for the setup or allow “Stay connected”.

4) Open a browser and go to: **`http://192.168.4.1`**
   - If a captive portal pops up, great.
   - If you only see a search engine or nothing happens, **type the address exactly** with **http**, not https.

5) **Fill the portal form**:
   - **SSID**: your 2.4GHz Wi‑Fi network name
   - **Password**: your Wi‑Fi password
   - **Store Code (optional)**: e.g. `STORE01` (used by backend to allocate terminal numbers per store)
   - Click **Save & Reboot**

6) The ESP32 reboots and joins your Wi‑Fi. LED will switch from error-fast‑blink to the **payment state** patterns (see below).

7) Behind the scenes:
   - Device calls `GET /api/v1/bootstrap` (headers include `X-Device-Id` = MAC, and `X-Store-Code` if provided).
   - Backend **auto-enrolls** device; if the **store** doesn’t exist yet, it creates it automatically and assigns the next **terminal number** (`STORE01-0001`, padding via `TERMINAL_PAD`).  
   - Device creates a **session** (`POST /api/v1/sessions`), gets a **checkout URL**, writes it to the NFC tag (NDEF URI), and begins polling session status.

---

## LED & Buzzer meaning (default firmware)

- **Pending** (awaiting payment): LED **slow blink** (~0.5s), soft chirp occasionally.
- **Paid**: LED **solid ON**, 3 quick **chirps**.
- **Error / Not connected**: LED **fast blink** (~120ms).

> You can adjust patterns in the sketch: `ledPatternPending()`, `ledPatternPaid()`, `ledPatternError()` and `buzz(ms)`.

---

## Factory Reset (to re-provision)

You have two options:

### A) **Hardware** (recommended for the field)
- Wire a momentary button from **GPIO 34** → **GND** and add a **10kΩ pull‑up** to **3.3V** (GPIO 34 is input-only; no internal pull‑up).
- **Hold the button LOW while powering on** (or resetting) for **3 seconds**.  
- The device clears saved **Wi‑Fi** and **Store Code** from NVS and reboots back into **SoftAP**.

### B) **Portal button**
- Connect to the SoftAP (`NFC-PAY-Setup-XXXX` → `http://192.168.4.1`).
- Tap **Factory Reset** → the device clears settings and reboots to SoftAP.

---

## Tips & Troubleshooting

- **Can’t see the AP?** Ensure your phone/laptop supports **2.4GHz**; many ESP32 boards don’t do 5GHz.
- **Portal doesn’t open automatically:** Manually browse to **`http://192.168.4.1`** (with **http**). Disable mobile data temporarily if your phone keeps switching away.
- **ESP32 never connects to Wi‑Fi:** Double-check SSID/password; some routers hide 2.4GHz or isolate AP clients. Try a phone hotspot for testing.
- **NFC write fails:** Move tag closer/centered on antenna, try a new **NTAG213/215/216** tag, ensure it’s not password-locked.
- **Backend not assigning terminal:** Verify **Vercel env vars** and **Neon DB URL**. See `README_Vercel.md → Troubleshooting`.
- **Security (demo vs prod):** The sample uses `client.setInsecure()` (no TLS pinning) for speed. For production, pin the Vercel cert or add the ISRG Root CA and validate.

---

## Serial logs
Open the Serial Monitor at **115200 baud** to see:
- Wi‑Fi connect status / IP
- Bootstrap response (`terminalId`, `checkoutUrl`)
- Session creation + ID
- NFC write result
- Polling status (`pending` → `paid`)

---

## Quick End‑to‑End Test
1) Provision via SoftAP and let device connect to Wi‑Fi.  
2) In Vercel, open `/admin` → ensure device shows under **Devices** (or use the **Operator Tools** on `/p/<terminalId>`).  
3) Tap the tag with an iPhone/Android → it opens `/p/<terminalId>`.  
4) On that page, click **Approve (Sandbox)** → device LED turns **solid** and buzzes 3× (status `paid`).

---

## Default Credentials & Headers (for reference)
- **SoftAP SSID:** `NFC-PAY-Setup-XXXX`  
- **SoftAP password:** `nfcsetup`  
- API headers sent by firmware:
  - `X-API-Key: <your API_KEY env value>`
  - `X-Device-Id: <ESP32 MAC>`
  - `X-Store-Code: <Store Code>` (if provided in portal)

