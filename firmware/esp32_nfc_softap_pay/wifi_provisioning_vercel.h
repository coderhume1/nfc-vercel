/**
 * wifi_provisioning_vercel.h — minimal, responsive SoftAP (original UI look)
 *
 * - Simple page (SSID, Password, Store Code, Save & Reboot, Factory Reset)
 * - Keeps AP up while STA connects (so user can retry without losing portal)
 * - Captive DNS to 192.168.4.1
 */
#pragma once
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>

namespace wifi_prov {

static const char* NVS_NS       = "wifi";
static const char* KEY_SSID     = "ssid";
static const char* KEY_PASS     = "pass";
static const char* KEY_STORE    = "store";
static const char* AP_PASS      = "nfcsetup";
static const uint16_t DNS_PORT  = 53;
static const uint16_t HTTP_PORT = 80;

Preferences   prefs;
DNSServer     dns;
WebServer     server(HTTP_PORT);
bool          portal = false;
String        apSsid;
IPAddress     apIP(192,168,4,1), apGW(192,168,4,1), apSN(255,255,255,0);
String        storeCodeCached;

String html(){
  String s;
  s.reserve(2600);
  s += F("<!doctype html><meta name=viewport content='width=device-width, initial-scale=1'>"
         "<title>NFC-PAY Setup</title>"
         "<style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:18px;}h2{margin:0 0 10px}"
         "label{display:block;margin-top:8px}input,button{padding:8px;margin:4px 0;width:100%;max-width:420px}"
         ".card{max-width:520px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;box-shadow:0 6px 20px rgba(30,30,60,.05)}"
         ".muted{color:#666;font-size:12px}</style>");
  s += F("<div class=card><h2>NFC-PAY Wi‑Fi Setup</h2>"
         "<p class=muted>Use <b>http://192.168.4.1</b>. Stay on this Wi‑Fi even if it says \"No Internet\".</p>"
         "<form method='POST' action='/save'>"
         "<label>SSID</label><input name='ssid' placeholder='Your 2.4GHz Wi‑Fi'>"
         "<label>Password</label><input name='pass' type='password' placeholder='Wi‑Fi password'>"
         "<label>Store Code (optional)</label><input name='store' placeholder='e.g. STORE01'>"
         "<button type='submit'>Save & Reboot</button>"
         "</form>"
         "<hr>"
         "<form method='POST' action='/factory-reset'><button>Factory Reset</button></form>"
         "</div>");
  return s;
}

void load(String& ssid, String& pass, String& store){
  prefs.begin(NVS_NS, true);
  ssid = prefs.getString(KEY_SSID, "");
  pass = prefs.getString(KEY_PASS, "");
  store = prefs.getString(KEY_STORE, "");
  prefs.end();
  storeCodeCached = store;
}

void save(const String& ssid, const String& pass, const String& store){
  prefs.begin(NVS_NS, false);
  if(ssid.length()) prefs.putString(KEY_SSID, ssid);
  prefs.putString(KEY_PASS, pass);
  prefs.putString(KEY_STORE, store);
  prefs.end();
  storeCodeCached = store;
}

String getStoreCode(){
  if(storeCodeCached.length()==0){ String a,b,c; load(a,b,c); }
  return storeCodeCached;
}

void forget(){
  prefs.begin(NVS_NS, false);
  prefs.remove(KEY_SSID);
  prefs.remove(KEY_PASS);
  prefs.remove(KEY_STORE);
  prefs.end();
  storeCodeCached = "";
}

// Try connect while pumping portal so UI stays responsive
bool trySTA(const String& ssid, const String& pass, uint32_t timeoutMs){
  WiFi.begin(ssid.c_str(), pass.c_str());
  uint32_t t0 = millis();
  while(WiFi.status()!=WL_CONNECTED && millis()-t0<timeoutMs){
    if(portal){ dns.processNextRequest(); server.handleClient(); }
    delay(25);
  }
  return WiFi.status()==WL_CONNECTED;
}

void startPortal(){
  if(portal) return;
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  WiFi.softAPConfig(apIP, apGW, apSN);
  WiFi.softAP(apSsid.c_str(), AP_PASS);

  dns.start(DNS_PORT, "*", apIP);

  server.on("/", [](){
    server.sendHeader("Cache-Control","no-cache");
    server.send(200, "text/html; charset=utf-8", html());
  });
  server.on("/factory-reset", HTTP_POST, [](){
    server.send(200,"text/plain","Reset OK. Rebooting…");
    delay(200);
    forget();
    delay(150);
    ESP.restart();
  });
  server.on("/save", HTTP_POST, [](){
    String ssid = server.hasArg("ssid")?server.arg("ssid"):"";
    String pass = server.hasArg("pass")?server.arg("pass"):"";
    String store= server.hasArg("store")?server.arg("store"):"";
    save(ssid,pass,store);
    server.send(200,"text/plain","Saved. Rebooting to connect…");
    delay(300);
    ESP.restart();
  });

  server.begin();
  portal = true;
}

void stopPortal(){
  if(!portal) return;
  dns.stop();
  server.stop();
  WiFi.softAPdisconnect(true);
  portal = false;
}

void begin(const char* apPrefix){
  char mac[13];
  uint8_t m[6]; WiFi.macAddress(m);
  snprintf(mac,sizeof(mac),"%02X%02X%02X%02X%02X%02X",m[0],m[1],m[2],m[3],m[4],m[5]);
  apSsid = String(apPrefix) + "-" + String(mac).substring(8,12);
}

bool ensureConnected(uint32_t timeoutMs=12000){
  String ssid,pass,store; load(ssid,pass,store);
  if(ssid.length()>0){
    if(trySTA(ssid,pass,timeoutMs)) return true;
  }
  startPortal();
  return false;
}

bool loop(){
  if(portal){
    dns.processNextRequest();
    server.handleClient();
  }
  return WiFi.status()==WL_CONNECTED;
}

// Blocks until connected, keeping portal responsive
bool blockUntilProvisioned(){
  while(true){
    if(ensureConnected(10000)) { stopPortal(); WiFi.mode(WIFI_STA); return true; }
    // pump portal a bit before retry cycle
    unsigned long t0 = millis();
    while(portal){
      if(WiFi.status()==WL_CONNECTED){ stopPortal(); WiFi.mode(WIFI_STA); return true; }
      dns.processNextRequest();
      server.handleClient();
      delay(5);
      if(millis()-t0>15000) break;
    }
  }
}

void eraseAndReboot(){ forget(); delay(100); ESP.restart(); }

} // namespace wifi_prov
