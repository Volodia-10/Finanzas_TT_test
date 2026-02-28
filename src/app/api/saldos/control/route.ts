import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { actualBalancePatchSchema } from "@/lib/validation";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ message: "Solo ADMIN puede ajustar saldo real conciliado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = actualBalancePatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const accountCode = normalizeCode(parsed.data.accountCode);
    const actualRaw = parsed.data.actualBalanceInput.trim();
    const actualBalance = actualRaw ? parseCopInput(actualRaw) : null;

    if (actualRaw && actualBalance === null) {
      return NextResponse.json({ message: "Saldo real inválido" }, { status: 400 });
    }

    const catalogs = await readCatalogs();
    const validAccounts = new Set(catalogs.accounts.map((item) => normalizeCode(item.code)));

    if (!validAccounts.has(accountCode)) {
      return NextResponse.json({ message: "Cuenta inválida para conciliación" }, { status: 400 });
    }

    const saved = await prisma.accountBalanceControl.upsert({
      where: { accountCode },
      create: {
        accountCode,
        openingBalance: 0,
        actualBalance
      },
      update: {
        actualBalance
      }
    });

    return NextResponse.json({
      message: "Saldo real conciliado guardado",
      item: {
        accountCode: saved.accountCode,
        openingBalance: Number(saved.openingBalance),
        actualBalance: saved.actualBalance === null ? null : Number(saved.actualBalance)
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible guardar saldo real conciliado" }, { status: 500 });
  }
}
