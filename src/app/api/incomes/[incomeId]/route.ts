import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { INTEREST_DETAIL_CODE, INTEREST_FORCED_VALUES, PENDING_VALUE } from "@/lib/constants";
import { calculateWompiNet, shouldRequestWompiMethod } from "@/lib/income-rules";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { adminUpdateIncomeSchema } from "@/lib/validation";
import { getActiveWompiConfig } from "@/lib/wompi-config";

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
    return NextResponse.json({ message: "Solo ADMIN puede editar registros" }, { status: 403 });
  }

  const incomeId = params.incomeId?.trim();
  if (!incomeId) {
    return NextResponse.json({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminUpdateIncomeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const income = await prisma.income.findUnique({ where: { id: incomeId } });
    if (!income) {
      return NextResponse.json({ message: "Ingreso no encontrado" }, { status: 404 });
    }

    const catalogs = await readCatalogs({ includeNonSelectable: true });

    const amount = parseCopInput(parsed.data.amountInput);
    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "La cantidad debe ser mayor a cero" }, { status: 400 });
    }

    const accountCode = parsed.data.accountCode.trim().toUpperCase();
    const semesterCode = parsed.data.semesterCode.trim().toUpperCase();
    const lineCode = parsed.data.lineCode.trim().toUpperCase();
    const userTag = parsed.data.userTag.trim().toUpperCase();
    const extra = (parsed.data.extra || "-").trim() || "-";

    const validAccount = catalogs.accounts.some((account) => account.code === accountCode);
    if (!validAccount) {
      return NextResponse.json({ message: "Cuenta inválida" }, { status: 400 });
    }

    const validSemester = catalogs.semesters.some((semester) => semester.code === semesterCode);
    if (!validSemester) {
      return NextResponse.json({ message: "Semestre inválido" }, { status: 400 });
    }

    const validLine =
      lineCode === PENDING_VALUE ||
      catalogs.lines.some((line) => line.code === lineCode);

    if (!validLine) {
      return NextResponse.json({ message: "Línea inválida" }, { status: 400 });
    }

    const detailCompatible = catalogs.accountDetailMappings.some(
      (mapping) => mapping.account.code === accountCode && mapping.detailOption.code === income.detailCode
    );

    if (!detailCompatible) {
      return NextResponse.json(
        {
          message: "La cuenta seleccionada no es compatible con el detalle actual del ingreso"
        },
        { status: 400 }
      );
    }

    const isInterest = income.detailCode === INTEREST_DETAIL_CODE;
    const wompiByRule = shouldRequestWompiMethod(accountCode, income.detailCode);

    let netAmount = amount;
    let commissionBase: number | null = null;
    let commissionIva: number | null = null;
    let commissionTcRate: number | null = null;

    if (wompiByRule) {
      const wompiMethod = income.wompiMethodCode?.toUpperCase();

      if (wompiMethod !== "PSE" && wompiMethod !== "TC") {
        return NextResponse.json(
          { message: "Este ingreso WOMPI no tiene método válido para recalcular cantidad" },
          { status: 400 }
        );
      }

      const wompiConfig = await getActiveWompiConfig();
      const calculation = calculateWompiNet(amount, wompiMethod, wompiConfig);
      netAmount = calculation.net;
      commissionBase = calculation.commissionBase;
      commissionIva = calculation.iva;
      commissionTcRate = calculation.tcExtraFee;
    }

    const updated = await prisma.income.update({
      where: { id: incomeId },
      data: {
        grossAmount: amount,
        netAmount,
        accountCode,
        semesterCode: isInterest ? INTEREST_FORCED_VALUES.semesterCode : semesterCode,
        lineCode: isInterest ? INTEREST_FORCED_VALUES.lineCode : lineCode,
        userTag: isInterest ? INTEREST_FORCED_VALUES.userTag : userTag,
        extra,
        isWompi: wompiByRule,
        commissionBase,
        commissionIva,
        commissionTcRate
      }
    });

    return NextResponse.json({
      message: "Registro actualizado",
      item: {
        id: updated.id,
        accountCode: updated.accountCode,
        semesterCode: updated.semesterCode,
        lineCode: updated.lineCode,
        userTag: updated.userTag,
        extra: updated.extra
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar el registro" }, { status: 500 });
  }
}
