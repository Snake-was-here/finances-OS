import { createHmac, timingSafeEqual } from "crypto";

const password = process.env.FINANCES_PASSWORD;
const secret = process.env.FINANCES_AUTH_SECRET;

function configured() { return Boolean(password && secret); }

export function validPassword(value: unknown) {
  if (!configured() || typeof value !== "string") return false;
  const incoming = Buffer.from(value);
  const expected = Buffer.from(password!);
  return incoming.length === expected.length && timingSafeEqual(incoming, expected);
}

export function sessionValue() {
  if (!secret) return "";
  return `open.${createHmac("sha256", secret).update("finances-os").digest("hex")}`;
}

export function validSession(value?: string) {
  if (!configured() || !value) return false;
  const expected = Buffer.from(sessionValue());
  const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
