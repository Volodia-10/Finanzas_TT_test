import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/constants";
import { SessionPayload, signToken, verifyToken } from "@/lib/token";

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return signToken(payload);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  return verifyToken(token);
}

export function setSessionCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
