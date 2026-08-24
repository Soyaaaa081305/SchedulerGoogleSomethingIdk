import { createHmac } from "crypto";

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

export function signIcalToken(userId: string): string {
  const sig = createHmac("sha256", secret()).update(userId).digest("hex").slice(0, 32);
  return `${userId}.${sig}`;
}

export function verifyIcalToken(token: string): string | null {
  const [userId, sig] = token.split(".");
  if (!userId || !sig) return null;
  const expected = createHmac("sha256", secret()).update(userId).digest("hex").slice(0, 32);
  // timing-safe compare
  if (sig.length !== expected.length) return null;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0 ? userId : null;
}
