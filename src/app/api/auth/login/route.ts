import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, signSessionToken } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);

    if (!validPassword) {
      return NextResponse.json({ message: "Credenciales inválidas" }, { status: 401 });
    }

    const token = await signSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible iniciar sesión" }, { status: 500 });
  }
}
