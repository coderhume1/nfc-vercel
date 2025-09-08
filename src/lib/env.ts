export function getEnv() {
  const {
    DATABASE_URL,
    API_KEY,
    ADMIN_KEY,
    PUBLIC_BASE_URL,
    DEFAULT_STORE_CODE = "STORE01",
    DEFAULT_AMOUNT = "0",
    DEFAULT_CURRENCY = "USD",
    TERMINAL_PREFIX = "",
    TERMINAL_PAD = "4",
  } = process.env;

  if (!DATABASE_URL) throw new Error("DATABASE_URL missing");
  if (!API_KEY) throw new Error("API_KEY missing");
  if (!ADMIN_KEY) throw new Error("ADMIN_KEY missing");
  if (!PUBLIC_BASE_URL) throw new Error("PUBLIC_BASE_URL missing");

  return {
    DATABASE_URL,
    API_KEY,
    ADMIN_KEY,
    PUBLIC_BASE_URL,
    DEFAULT_STORE_CODE,
    DEFAULT_AMOUNT: parseInt(DEFAULT_AMOUNT, 10) || 0,
    DEFAULT_CURRENCY,
    TERMINAL_PREFIX,
    TERMINAL_PAD: parseInt(TERMINAL_PAD, 10) || 4,
  };
}
