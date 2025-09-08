/**
 * ESP32 NFC Pay (Vercel-aligned, debug v6)
 * - Fixes "LEDC is not initialized" by explicitly configuring LEDC for the buzzer.
 * - Adds WS2812B (NeoPixel) status LED: pending (breathing yellow), paid (solid green + chime), error (blinking red).
 * - Keeps robust NTAG213 erase+rewrite verify flow and server checkoutUrl preference.
 *
 * Requires: Adafruit NeoPixel library
 *   Arduino IDE -> Library Manager -> "Adafruit NeoPixel" by Adafruit
 */

#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_PN532.h>
#include <Adafruit_NeoPixel.h>
#include "wifi_provisioning_vercel.h"

// ====== Pins ======
#define PN532_SCK   18
#define PN532_MOSI  23
#define PN532_MISO  19
#define PN532_SS     5
#define PN532_RST   27

#define LED_PIN       2      // builtin (optional debug)
#define BUZZER_PIN    4
#define BUZZER_CH     0      // LEDC channel for buzzer
#define BUZZER_RES    10     // bits
#define BUZZER_DUTY   512    // ~50% at 10-bit
#define WS_PIN       13      // your WS2812B DIN
#define WS_COUNT      1      // number of pixels on your device
#define FACTORY_PIN  34

// ====== Backend config (EDIT THESE) ======
const char* BASE_URL = "https://nfc-pay-vercel-w4ii.vercel.app"; // no trailing slash
const char* API_KEY  = "esp32_test_api_key_123456";

// ====== Globals ======
Adafruit_PN532 nfc(PN532_SS);
WiFiClientSecure tls;
HTTPClient http;
String terminalId, sessionId, checkoutUrl;

// NeoPixel
Adafruit_NeoPixel strip(WS_COUNT, WS_PIN, NEO_GRB + NEO_KHZ800);
uint8_t brightness = 32;

// Status machine
enum class PayState { STARTING, WRITING, PENDING, PAID, ERROR };
PayState payState = PayState::STARTING;
unsigned long lastAnimMs = 0;
bool paidChimePlayed = false;

// ====== Utils ======
String normBase(){ String b=String(BASE_URL); while(b.endsWith("/")) b.remove(b.length()-1); return b; }
String joinUrl(const char* base, const char* path){ String b(base),p(path); while(b.endsWith("/")) b.remove(b.length()-1); if(!p.startsWith("/")) p="/"+p; return b+p; }
String snippet(const String& s, size_t n=160){ return s.length()<=n? s : s.substring(0,n)+"..."; }
String extractJsonValue(const String& body, const String& key){ String pat="\""+key+"\":\""; int i=body.indexOf(pat); if(i<0) return ""; i+=pat.length(); int j=body.indexOf("\"",i); if(j<0) return ""; return body.substring(i,j); }

void setupHttp(HTTPClient& hc){
  hc.useHTTP10(true);
  hc.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  hc.setTimeout(12000);
  hc.addHeader("Connection","close");
  hc.addHeader("X-API-Key", API_KEY);
  hc.addHeader("X-Device-Id", WiFi.macAddress());
  if (wifi_prov::getStoreCode().length() > 0) hc.addHeader("X-Store-Code", wifi_prov::getStoreCode());
}

// ====== Buzzer (LEDC) ======
void buzzerInit(){
  ledcSetup(BUZZER_CH, 2000 /*Hz*/, BUZZER_RES);
  ledcAttachPin(BUZZER_PIN, BUZZER_CH);
  ledcWrite(BUZZER_CH, 0);
}

void buzzTone(uint16_t freqHz, uint16_t ms, uint16_t duty=BUZZER_DUTY){
  ledcWriteTone(BUZZER_CH, freqHz);
  ledcWrite(BUZZER_CH, duty);
  delay(ms);
  ledcWrite(BUZZER_CH, 0);
}

// ====== NeoPixel helpers ======
void pixelSolid(uint8_t r,uint8_t g,uint8_t b){
  strip.setBrightness(brightness);
  for(uint16_t i=0;i<WS_COUNT;i++) strip.setPixelColor(i, strip.Color(r,g,b));
  strip.show();
}

void pixelBlink(uint8_t r,uint8_t g,uint8_t b, uint16_t periodMs=500){
  unsigned long now = millis();
  if (now - lastAnimMs >= periodMs){
    lastAnimMs = now;
    static bool on=false; on=!on;
    if(on) pixelSolid(r,g,b); else pixelSolid(0,0,0);
  }
}

void pixelBreathe(uint8_t r, uint8_t g, uint8_t b, uint16_t periodMs=1600){
  // simple triangle wave brightness
  unsigned long t = millis() % periodMs;
  uint16_t half = periodMs/2;
  uint8_t scale = (t<half) ? map(t,0,half,8,brightness) : map(t-half,0,half,brightness,8);
  strip.setBrightness(scale);
  for(uint16_t i=0;i<WS_COUNT;i++) strip.setPixelColor(i, strip.Color(r,g,b));
  strip.show();
}

// ====== NFC helpers ======
bool rfFieldOn(bool on){
  uint8_t cmd[] = { PN532_COMMAND_RFCONFIGURATION, 0x01, (uint8_t)(on ? 0x01 : 0x00) };
  return nfc.sendCommandCheckAck(cmd, sizeof(cmd), 100);
}
bool readPage(uint8_t page, uint8_t out[4]){
  for(int a=0;a<3;a++){
    if(nfc.mifareultralight_ReadPage(page, out)) return true;
    delay(6);
    uint8_t uid[7], uidLen=0;
    (void)nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 120);
  }
  return false;
}
void dumpPages(uint8_t fromPg, uint8_t toPg){
  for(uint8_t pg=fromPg; pg<=toPg; pg++){
    uint8_t b[4];
    if(readPage(pg,b)){
      Serial.printf("P%u: %02X %02X %02X %02X\n", pg, b[0],b[1],b[2],b[3]);
    } else {
      Serial.printf("P%u: <read err>\n", pg);
    }
  }
}
void dumpLocks(){
  uint8_t p2[4]={0}, p40[4]={0};
  if(readPage(2,p2)) Serial.printf("[LOCK] P2 (static lock) : %02X %02X %02X %02X\n", p2[0],p2[1],p2[2],p2[3]); else Serial.println("[LOCK] P2 read err");
  if(readPage(40,p40)) Serial.printf("[LOCK] P40 (dyn lock)  : %02X %02X %02X %02X\n", p40[0],p40[1],p40[2],p40[3]); else Serial.println("[LOCK] P40 read err");
}
uint8_t uriPrefixCode(const String& url, String& rem) {
  struct { const char* pre; uint8_t code; } map[] = {
    {"http://www.", 0x01},{"https://www.",0x02},{"http://",0x03},{"https://",0x04}
  };
  for (auto &m: map) { size_t L=strlen(m.pre); if(url.startsWith(m.pre)){ rem=url.substring(L); return m.code; } }
  rem = url; return 0x00;
}
size_t buildURI_TLV(const String& url, uint8_t* out, size_t maxlen) {
  String rem; uint8_t id = uriPrefixCode(url, rem);
  size_t payloadLen = 1 + rem.length();
  size_t ndefLen = 4 + payloadLen;          // D1 01 len 55 + payload
  size_t tlvLen  = 2 + ndefLen + 1;         // TLV + terminator
  if (tlvLen > 255 || tlvLen > maxlen) return 0;
  size_t i=0;
  out[i++]=0x03; out[i++]=(uint8_t)ndefLen;
  out[i++]=0xD1; out[i++]=0x01; out[i++]=(uint8_t)payloadLen;
  out[i++]=0x55; out[i++]=id;
  for(size_t k=0;k<rem.length();k++) out[i++]=(uint8_t)rem[k];
  out[i++]=0xFE;
  return i;
}
bool writePagesPaced(const uint8_t* data, size_t len, uint8_t startPage=4, uint16_t ms=18) {
  uint8_t pageBuf[4]; size_t idx=0; uint8_t page=startPage;
  while(idx<len){
    memset(pageBuf,0x00,4);
    for(uint8_t k=0;k<4 && idx<len;k++) pageBuf[k]=data[idx++];
    if(!nfc.mifareultralight_WritePage(page,pageBuf)) return false;
    delay(ms);
    page++;
  }
  memset(pageBuf,0x00,4);
  nfc.mifareultralight_WritePage(page,pageBuf);
  delay(ms);
  return true;
}
bool readRangeToBuf(uint8_t startPage, size_t byteCount, uint8_t* out){
  size_t got=0; uint8_t page=startPage;
  while(got<byteCount){
    if(!readPage(page, &out[got])) return false;
    got += 4; page++;
  }
  return true;
}
bool verifyTLVExactWithRetries(const uint8_t* tlv, size_t tlvLen){
  for(int attempt=1; attempt<=4; attempt++){
    rfFieldOn(false); delay(200);
    rfFieldOn(true);  delay(30);
    uint8_t uid[7], uidLen=0;
    (void)nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 200);

    uint8_t buf[192];
    if(!readRangeToBuf(4, tlvLen, buf)){
      Serial.printf("[NDEF] verify read failed (attempt %d)\n", attempt);
      continue;
    }
    bool same=true;
    for(size_t i=0;i<tlvLen;i++){ if(buf[i]!=tlv[i]){ same=false; Serial.printf("[NDEF] mismatch @%u: wrote %02X read %02X\n",(unsigned)i,tlv[i],buf[i]); break; } }
    if(same) return true;
  }
  return false;
}

bool eraseUserArea(){
  Serial.println("[NDEF] Erasing pages 4..39");
  uint8_t zero[4] = {0,0,0,0};
  for(uint8_t pg=4; pg<=39; pg++){
    if(!nfc.mifareultralight_WritePage(pg, zero)){
      Serial.printf("[NDEF] erase failed at page %u\n", pg);
      return false;
    }
    delay(16);
  }
  return true;
}
bool writeNdefUrlVerified(const String& url){
  Serial.printf("[NDEF] write url: %s\n", url.c_str());
  // Set CC
  uint8_t cc[4] = { 0xE1, 0x10, 0x12, 0x00 };
  if(!nfc.mifareultralight_WritePage(3, cc)) { Serial.println("[NDEF] CC write failed"); return false; }
  delay(16);
  // TLV
  uint8_t tlv[192];
  size_t tlvLen = buildURI_TLV(url, tlv, sizeof(tlv));
  if(tlvLen==0){ Serial.println("[NDEF] TLV too long"); return false; }
  // First attempt
  if(!writePagesPaced(tlv, tlvLen, 4, 18)){ Serial.println("[NDEF] TLV write failed"); return false; }
  delay(120);
  if(verifyTLVExactWithRetries(tlv, tlvLen)) return true;
  // Erase + rewrite
  Serial.println("[NDEF] verify failed; trying erase+rewrite");
  if(!eraseUserArea()){ Serial.println("[NDEF] erase failed"); return false; }
  delay(80);
  if(!writePagesPaced(tlv, tlvLen, 4, 20)){ Serial.println("[NDEF] TLV write failed (after erase)"); return false; }
  delay(160);
  bool ok = verifyTLVExactWithRetries(tlv, tlvLen);
  if(!ok){
    Serial.println("[NDEF] verify still failing. Lock/status dump:");
    dumpLocks(); Serial.println("Dump pages 2..12:"); dumpPages(2,12);
  }
  return ok;
}

// Replace placeholder domain if present
String fixCheckoutUrl(String u){
  int pos = u.indexOf("https://<project>.vercel.app");
  if (pos==0){
    String path = u.substring(strlen("https://<project>.vercel.app"));
    return normBase() + path;
  }
  if (u.indexOf("<project>")>=0){
    u.replace("<project>.vercel.app", normBase().substring(String("https://").length()));
  }
  return u;
}

// ====== Backend calls ======
bool doBootstrap(String& outTerminalId, String& outCheckoutUrl){
  const char* paths[] = { "/api/v1/bootstrap", "/api/bootstrap" };
  for(int i=0;i<2;i++){
    String url = joinUrl(BASE_URL, paths[i]);
    http.begin(tls, url);
    setupHttp(http);
    int code = http.GET();
    String body = http.getString();
    Serial.printf("[BOOTSTRAP] GET %s => %d\n", url.c_str(), code);
    if (body.length()) Serial.printf("[BOOTSTRAP] body: %s\n", snippet(body).c_str());
    if (code==200){
      String term = extractJsonValue(body, "terminalId");
      String chk  = extractJsonValue(body, "checkoutUrl");
      if(term.length()){ outTerminalId=term; outCheckoutUrl=chk; http.end(); return true; }
    }
    http.end();

    http.begin(tls, url);
    setupHttp(http);
    http.addHeader("Content-Type","application/json");
    code = http.POST("{}");
    body = http.getString();
    Serial.printf("[BOOTSTRAP] POST %s => %d\n", url.c_str(), code);
    if (body.length()) Serial.printf("[BOOTSTRAP] body: %s\n", snippet(body).c_str());
    if (code==200){
      String term = extractJsonValue(body, "terminalId");
      String chk  = extractJsonValue(body, "checkoutUrl");
      if(term.length()){ outTerminalId=term; outCheckoutUrl=chk; http.end(); return true; }
    }
    http.end();
  }
  return false;
}
bool createSession(const String& term, String& outSessionId){
  String url = joinUrl(BASE_URL, "/api/v1/sessions");
  http.begin(tls, url);
  setupHttp(http);
  http.addHeader("Content-Type","application/json");
  String payload = String("{\"terminalId\":\"") + term + "\"}";
  int code = http.POST(payload);
  String body = http.getString();
  Serial.printf("[SESSION.CREATE] %s => %d\n", url.c_str(), code);
  if (body.length()) Serial.printf("[SESSION.CREATE] body: %s\n", snippet(body).c_str());
  if(code==200 || code==201){
    String sid = extractJsonValue(body, "id");
    if(sid.length()){ outSessionId=sid; http.end(); return true; }
  }
  http.end();
  return false;
}
String getSessionStatus(const String& sid){
  String url = joinUrl(BASE_URL, (String("/api/v1/sessions/")+sid).c_str());
  http.begin(tls, url);
  setupHttp(http);
  int code = http.GET();
  String body = http.getString();
  String status = "";
  if (code==200) status = extractJsonValue(body, "status");
  else {
    Serial.printf("[SESSION.STATUS] %s => %d\n", url.c_str(), code);
    if (body.length()) Serial.printf("[SESSION.STATUS] body: %s\n", snippet(body).c_str());
  }
  http.end();
  return status;
}

// ====== Indicators / main loop ======
void applyVisuals(){
  switch (payState){
    case PayState::STARTING: pixelBreathe(0,0,32,1200); break;            // dim blue
    case PayState::WRITING:  pixelBreathe(0,32,32,800);  break;           // cyan
    case PayState::PENDING:  pixelBreathe(32,32,0,1600); break;           // yellow
    case PayState::PAID:     pixelSolid(0,64,0);                          // green
                              if(!paidChimePlayed){                       // one-time chime
                                buzzTone(1800,120); delay(80);
                                buzzTone(2200,120); delay(80);
                                buzzTone(2600,140);
                                paidChimePlayed=true;
                              }
                              break;
    case PayState::ERROR:    pixelBlink(64,0,0,400);  break;              // red blink
  }
}

void setup(){
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(FACTORY_PIN, INPUT);

  Serial.begin(115200); delay(50);
  Serial.println("\nESP32 NFC Pay (Vercel-aligned, debug v6)");
  Serial.printf("[CONF] BASE_URL=%s\n", BASE_URL);

  // Buzzer LEDC init (prevents "LEDC is not initialized")
  buzzerInit();

  // NeoPixel init
  strip.begin();
  strip.clear();
  strip.setBrightness(brightness);
  strip.show();

  // NFC
  nfc.begin();
  uint32_t ver = nfc.getFirmwareVersion();
  if (!ver) Serial.println("[NFC] PN532 not found");
  else { Serial.print("[NFC] PN532 FW: 0x"); Serial.println(ver, HEX); nfc.SAMConfig(); }
  nfc.setPassiveActivationRetries(0xFF);

  payState = PayState::STARTING;

  // Wi-Fi provisioning
  wifi_prov::begin("NFC-PAY-Setup");
  if(!wifi_prov::ensureConnected(12000)){
    Serial.println("[WiFi] SoftAP portal @ http://192.168.4.1");
    wifi_prov::blockUntilProvisioned();
  }
  Serial.print("[WiFi] IP: "); Serial.println(WiFi.localIP());
  WiFi.setSleep(false);

  tls.setInsecure(); // demo

  // Bootstrap
  String chkTmp;
  if(!doBootstrap(terminalId, chkTmp)){
    Serial.println("[BOOTSTRAP] Failed");
    payState = PayState::ERROR;
    return;
  }
  checkoutUrl = chkTmp;
  Serial.printf("[BOOTSTRAP] terminalId=%s\n", terminalId.c_str());
  if(checkoutUrl.length()) Serial.printf("[BOOTSTRAP] checkoutUrl=%s\n", checkoutUrl.c_str());

  // Write tag
  payState = PayState::WRITING;
  {
    String urlToWrite = checkoutUrl.length() ? fixCheckoutUrl(checkoutUrl)
                                            : joinUrl(BASE_URL, (String("/p/")+terminalId).c_str());
    bool ok = writeNdefUrlVerified(urlToWrite);
    if(ok){
      Serial.printf("[NDEF] wrote & verified %s\n", urlToWrite.c_str());
    } else {
      Serial.println("[NDEF] write/verify failed");
      payState = PayState::ERROR;
    }
  }

  // Start session (if tag write succeeded, keep going anyway)
  if(terminalId.length()){
    if(createSession(terminalId, sessionId)) Serial.printf("[SESSION] %s\n", sessionId.c_str());
    else Serial.println("[SESSION] create failed");
  }
  if (payState != PayState::ERROR) payState = PayState::PENDING;
}

unsigned long lastPoll = 0;
void loop(){
  wifi_prov::loop();
  applyVisuals();

  // Poll payment status every 1.2s
  unsigned long now = millis();
  if (now - lastPoll >= 1200 && sessionId.length()){
    lastPoll = now;
    String st = getSessionStatus(sessionId);
    if(st=="paid"){
      payState = PayState::PAID;
    } else if(st=="pending" || st.length()==0){
      if(payState!=PayState::PAID) payState = PayState::PENDING;
    } else {
      payState = PayState::ERROR;
    }
  }
}
