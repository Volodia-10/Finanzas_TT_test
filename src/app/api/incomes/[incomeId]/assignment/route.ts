import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { PENDING_VALUE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { assignPendingIncomeSchema } from "@/lib/validation";

type RouteParams = {
  params: {
    incomeId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ message: "Solo ADMIN puede completar registros pendientes" }, { status: 403 });
  }

  const incomeId = params.incomeId?.trim();
  if (!incomeId) {
    return NextResponse.json({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = assignPendingIncomeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const income = await prisma.income.findUnique({ where: { id: incomeId } });

    if (!income) {
      return NextResponse.json({ message: "Ingreso no encontrado" }, { status: 404 });
    }

    if (income.lineCode !== PENDING_VALUE && income.userTag !== PENDING_VALUE) {
      return NextResponse.json({ message: "Este registro no está pendiente" }, { status: 400 });
    }

    const lineCode = parsed.data.lineCode.trim().toUpperCase();
    const userTag = parsed.data.userTag.trim().toUpperCase();

    if (!lineCode || !userTag) {
      return NextResponse.json({ message: "LÍNEA y USER son obligatorios" }, { status: 400 });
    }

    const catalogs = await readCatalogs();
    const validLine = catalogs.lines.some((line) => line.code === lineCode);

    if (!validLine) {
      return NextResponse.json({ message: "Línea inválida" }, { status: 400 });
    }

    const updated = await prisma.income.update({
      where: { id: incomeId },
      data: {
        lineCode,
        userTag
      }
    });

    return NextResponse.json({
      message: "Registro pendiente completado",
      item: {
        id: updated.id,
        lineCode: updated.lineCode,
        userTag: updated.userTag
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar el registro" }, { status: 500 });
  }
}
