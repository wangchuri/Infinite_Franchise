import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";

const SALT_ROUNDS = 10;
const ACCESS_TTL = "7d";
const REFRESH_DAYS = 30;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short. Add it to backend/.env (min 16 chars).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_DAYS);
  return d;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(input: {
  username?: unknown;
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}): { ok: true; data: {
  username: string;
  email: string;
  password: string;
  displayName: string;
} } | { ok: false; error: string } {
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const displayNameRaw =
    typeof input.displayName === "string" ? input.displayName.trim() : "";
  const displayName = displayNameRaw || username;

  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "username must be 3-32 chars: letters, numbers, underscore",
    };
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return { ok: false, error: "invalid email" };
  }
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: "password must be 8-72 characters" };
  }
  if (displayName.length < 1 || displayName.length > 64) {
    return { ok: false, error: "displayName must be 1-64 characters" };
  }

  return {
    ok: true,
    data: { username, email, password, displayName },
  };
}
