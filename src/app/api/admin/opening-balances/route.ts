import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { formatCop, parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { openingBalancePatchSchema } from "@/lib/validation";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ message: "Solo ADMIN puede consultar saldos iniciales" }, { status: 403 });
  }

  try {
    const catalogs = await readCatalogs();
    const accounts = catalogs.accounts.map((item) => ({
      code: item.code,
      label: item.name
    }));

    const controls = await prisma.accountBalanceControl.findMany({
      select: {
        accountCode: true,
        openingBalance: true,
        openingBalanceSetAt: true
      }
    });

    const controlMap = new Map(
      controls.map((item) => [
        item.accountCode,
        {
          openingBalance: Number(item.openingBalance),
          openingBalanceSetAt: item.openingBalanceSetAt
        }
      ])
    );

    const items = accounts.map((account) => ({
      accountCode: account.code,
      accountLabel: account.label,
      openingBalance: controlMap.get(account.code)?.openingBalance ?? 0,
      openingBalanceFormatted: formatCop(controlMap.get(account.code)?.openingBalance ?? 0),
      openingBalanceSetAt: controlMap.get(account.code)?.openingBalanceSetAt ?? null,
      isConfigured: Boolean(controlMap.get(account.code)?.openingBalanceSetAt)
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: "No fue posible consultar saldos iniciales" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ message: "Solo ADMIN puede registrar saldo inicial" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = openingBalancePatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const accountCode = normalizeCode(parsed.data.accountCode);
    const openingBalance = parseCopInput(parsed.data.openingBalanceInput);

    if (openingBalance === null || openingBalance < 0) {
      return NextResponse.json({ message: "Saldo inicial inválido" }, { status: 400 });
    }

    const catalogs = await readCatalogs();
    const validAccounts = new Set(catalogs.accounts.map((item) => normalizeCode(item.code)));

    if (!validAccounts.has(accountCode)) {
      return NextResponse.json({ message: "Cuenta inválida" }, { status: 400 });
    }

    const existing = await prisma.accountBalanceControl.findUnique({
      where: { accountCode },
      select: {
        id: true,
        openingBalanceSetAt: true
      }
    });

    if (existing?.openingBalanceSetAt) {
      return NextResponse.json(
        { message: "El saldo inicial de esta cuenta ya fue configurado y no se puede volver a registrar." },
        { status: 409 }
      );
    }

    const now = new Date();
    const saved = await prisma.accountBalanceControl.upsert({
      where: { accountCode },
      create: {
        accountCode,
        openingBalance,
        openingBalanceSetAt: now
      },
      update: {
        openingBalance,
        openingBalanceSetAt: now
      }
    });

    return NextResponse.json({
      message: "Saldo inicial registrado",
      item: {
        accountCode: saved.accountCode,
        openingBalance: Number(saved.openingBalance),
        openingBalanceSetAt: saved.openingBalanceSetAt
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible registrar saldo inicial" }, { status: 500 });
  }
}
