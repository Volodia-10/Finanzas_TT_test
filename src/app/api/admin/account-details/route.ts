import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAdmin() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "No autorizado" }, { status: 401 })
    };
  }

  if (user.role !== UserRole.ADMIN) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Solo admin puede gestionar relaciones" }, { status: 403 })
    };
  }

  return { ok: true as const };
}

export async function GET() {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const [accounts, details, mappings] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.detailOption.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.accountDetailMap.findMany({
      include: {
        account: true,
        detailOption: true
      },
      orderBy: [{ account: { code: "asc" } }, { detailOption: { code: "asc" } }]
    })
  ]);

  return NextResponse.json({
    accounts,
    details,
    mappings
  });
}

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    accountCode?: string;
    detailCode?: string;
    isActive?: boolean;
  };

  const accountCode = body.accountCode?.trim().toUpperCase();
  const detailCode = body.detailCode?.trim().toUpperCase();

  if (!accountCode || !detailCode || typeof body.isActive !== "boolean") {
    return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });
  }

  const [account, detail] = await Promise.all([
    prisma.account.findUnique({ where: { code: accountCode } }),
    prisma.detailOption.findUnique({ where: { code: detailCode } })
  ]);

  if (!account || !detail) {
    return NextResponse.json({ message: "Cuenta o detalle inválido" }, { status: 404 });
  }

  const mapping = await prisma.accountDetailMap.upsert({
    where: {
      accountId_detailOptionId: {
        accountId: account.id,
        detailOptionId: detail.id
      }
    },
    update: {
      isActive: body.isActive
    },
    create: {
      accountId: account.id,
      detailOptionId: detail.id,
      isActive: body.isActive
    },
    include: {
      account: true,
      detailOption: true
    }
  });

  return NextResponse.json({ mapping });
}
