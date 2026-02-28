import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { adminUpdateTransferSchema } from "@/lib/validation";

type RouteParams = {
  params: {
    transferId: string;
  };
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function parseTransferDate(raw: string): Date | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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
      response: NextResponse.json({ message: "Solo ADMIN puede editar o eliminar transferencias" }, { status: 403 })
    };
  }

  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const transferId = params.transferId?.trim();
  if (!transferId) {
    return NextResponse.json({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminUpdateTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const current = await prisma.internalTransfer.findUnique({ where: { id: transferId } });
    if (!current) {
      return NextResponse.json({ message: "Transferencia no encontrada" }, { status: 404 });
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

    const fee = parsed.data.feeInput?.trim() ? parseCopInput(parsed.data.feeInput) : 0;

    if (fee === null || fee < 0) {
      return NextResponse.json({ message: "Costo/comisión inválido" }, { status: 400 });
    }

    const catalogs = await readCatalogs();
    const accountCodes = new Set(catalogs.accounts.map((item) => normalizeCode(item.code)));

    if (!accountCodes.has(originAccountCode) || !accountCodes.has(destinationAccountCode)) {
      return NextResponse.json({ message: "Cuenta ORIGEN o DESTINO inválida" }, { status: 400 });
    }

    const note = parsed.data.note.trim();

    const updated = await prisma.internalTransfer.update({
      where: { id: transferId },
      data: {
        transferAt,
        originAccountCode,
        destinationAccountCode,
        amount,
        fee,
        note: note || null
      }
    });

    return NextResponse.json({
      message: "Transferencia actualizada",
      item: {
        id: updated.id,
        transferAt: updated.transferAt,
        originAccountCode: updated.originAccountCode,
        destinationAccountCode: updated.destinationAccountCode,
        amount: Number(updated.amount),
        fee: Number(updated.fee),
        note: updated.note ?? ""
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar transferencia" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const transferId = params.transferId?.trim();
  if (!transferId) {
    return NextResponse.json({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const current = await prisma.internalTransfer.findUnique({ where: { id: transferId } });
    if (!current) {
      return NextResponse.json({ message: "Transferencia no encontrada" }, { status: 404 });
    }

    await prisma.internalTransfer.delete({ where: { id: transferId } });
    return NextResponse.json({ message: "Transferencia eliminada" });
  } catch {
    return NextResponse.json({ message: "No fue posible eliminar transferencia" }, { status: 500 });
  }
}
