import { SignJWT, jwtVerify } from "jose";

export type AppRole = "ADMIN" | "OPERATOR";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AppRole;
  iat?: number;
  exp?: number;
};

const encoder = new TextEncoder();

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return encoder.encode(secret);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }

    if (payload.role !== "ADMIN" && payload.role !== "OPERATOR") {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
