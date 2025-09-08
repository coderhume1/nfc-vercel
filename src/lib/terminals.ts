import { prisma } from "./prisma";
import { getEnv } from "./env";

export async function nextTerminalForStore(storeCode: string) {
  const seq = await prisma.terminalSequence.upsert({
    where: { storeCode },
    update: { last: { increment: 1 } },
    create: { storeCode, last: 1 },
  });
  const { TERMINAL_PREFIX, TERMINAL_PAD } = getEnv();
  const n = String(seq.last).padStart(TERMINAL_PAD, "0");
  return `${storeCode}-${TERMINAL_PREFIX}${n}`;
}
