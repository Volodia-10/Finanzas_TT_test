import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { buildTransferWhere, parseTransferFilters } from "@/lib/transfer-query";
import { createTransferSchema } from "@/lib/validation";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function parseTransferDate(raw: string): Date | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const filters = parseTransferFilters(request.nextUrl.searchParams);
    const where = buildTransferWhere(filters);

    const [total, transfers] = await Promise.all([
      prisma.internalTransfer.count({ where }),
      prisma.internalTransfer.findMany({
        where,
        orderBy: { transferAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          createdBy: {
            select: {
              name: true
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      items: transfers.map((transfer) => ({
        id: transfer.id,
        createdAt: transfer.createdAt,
        transferAt: transfer.transferAt,
        originAccountCode: transfer.originAccountCode,
        destinationAccountCode: transfer.destinationAccountCode,
        amount: Number(transfer.amount),
        fee: Number(transfer.fee),
        note: transfer.note ?? "",
        createdBy: transfer.createdBy.name
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / filters.pageSize))
    });
  } catch {
    return NextResponse.json({ message: "No fue posible consultar transferencias" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const transferAt = parseTransferDate(parsed.data.transferAtInput);
    if (!transferAt) {
      return NextResponse.json({ message: "Fecha de transferencia inválida" }, { status: 400 });
    }

    const originAccountCode = normalizeCode(parsed.data.originAccountCode);
    const destinationAccountCode = normalizeCode(parsed.data.destinationAccountCode);

    if (!originAccountCode || !destinationAccountCode) {
      return NextResponse.json({ message: "Debes seleccionar ORIGEN y DESTINO" }, { status: 400 });
    }

    if (originAccountCode === destinationAccountCode) {
      return NextResponse.json({ message: "ORIGEN y DESTINO no pueden ser iguales" }, { status: 400 });
    }

    const amount = parseCopInput(parsed.data.amountInput);
    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "El monto debe ser mayor a cero" }, { status: 400 });
    }

    const fee = parsed.data.feeInput?.trim()
      ? parseCopInput(parsed.data.feeInput)
      : 0;

    if (fee === null || fee < 0) {
      return NextResponse.json({ message: "Costo/comisión inválido" }, { status: 400 });
    }

    const catalogs = await readCatalogs();
    const accountCodes = new Set(catalogs.accounts.map((item) => normalizeCode(item.code)));

    if (!accountCodes.has(originAccountCode) || !accountCodes.has(destinationAccountCode)) {
      return NextResponse.json({ message: "Cuenta ORIGEN o DESTINO inválida" }, { status: 400 });
    }

    const note = parsed.data.note.trim();

    const created = await prisma.internalTransfer.create({
      data: {
        transferAt,
        originAccountCode,
        destinationAccountCode,
        amount,
        fee,
        note: note || null,
        createdById: user.id
      }
    });

    return NextResponse.json({
      message: "Transferencia registrada",
      item: {
        ...created,
        amount: Number(created.amount),
        fee: Number(created.fee)
      }
    });
  } catch (error) {
    if ((error as Prisma.PrismaClientKnownRequestError)?.code) {
      return NextResponse.json({ message: "Error de base de datos" }, { status: 500 });
    }

    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return NextResponse.json({ message: `No fue posible registrar transferencia: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: "No fue posible registrar transferencia" }, { status: 500 });
  }
}
