CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid on some Neon setups

CREATE TABLE IF NOT EXISTS "Session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "terminalId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Session_terminalId_idx" ON "Session"("terminalId");

CREATE TABLE IF NOT EXISTS "Device" (
  "deviceId" TEXT PRIMARY KEY,
  "storeCode" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "TerminalSequence" (
  "storeCode" TEXT PRIMARY KEY,
  "last" INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_session_updated_at') THEN
    CREATE TRIGGER trg_session_updated_at BEFORE UPDATE ON "Session"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_device_updated_at') THEN
    CREATE TRIGGER trg_device_updated_at BEFORE UPDATE ON "Device"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
