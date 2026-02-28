import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { INTEREST_FORCED_VALUES, PENDING_VALUE } from "@/lib/constants";
import { buildIncomeWhere, parseIncomeFilters } from "@/lib/income-query";
import { calculateWompiNet, isInterestDetail, shouldRequestWompiMethod } from "@/lib/income-rules";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createIncomeSchema } from "@/lib/validation";
import { getActiveWompiConfig } from "@/lib/wompi-config";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const filters = parseIncomeFilters(request.nextUrl.searchParams);
    const where = buildIncomeWhere(filters);

    const [total, incomes] = await Promise.all([
      prisma.income.count({ where }),
      prisma.income.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
      items: incomes.map((income) => ({
        id: income.id,
        createdAt: income.createdAt,
        grossAmount: Number(income.grossAmount),
        netAmount: Number(income.netAmount),
        semesterCode: income.semesterCode,
        accountCode: income.accountCode,
        detailCode: income.detailCode,
        lineCode: income.lineCode,
        userTag: income.userTag,
        extra: income.extra,
        createdBy: income.createdBy.name
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / filters.pageSize))
    });
  } catch {
    return NextResponse.json({ message: "No fue posible consultar ingresos" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  let requestIdForIdempotency: string | null = null;

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createIncomeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const data = parsed.data;
    const requestId = data.requestId.trim();
    requestIdForIdempotency = requestId;

    const amount = parseCopInput(data.amountInput);
    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "El monto debe ser mayor a cero" }, { status: 400 });
    }

    const catalogs = await readCatalogs();

    const accountCode = data.accountCode.trim().toUpperCase();
    const detailCode = data.detailCode.trim().toUpperCase();

    const account = catalogs.accounts.find((item) => item.code === accountCode);
    if (!account) {
      return NextResponse.json({ message: "Cuenta inválida" }, { status: 400 });
    }

    const validDetailsForAccount = catalogs.accountDetailMappings
      .filter((mapping) => mapping.account.code === accountCode)
      .map((mapping) => mapping.detailOption.code);

    if (!validDetailsForAccount.includes(detailCode)) {
      return NextResponse.json({
        message: "El detalle no pertenece a la cuenta seleccionada"
      }, { status: 400 });
    }

    const interestMode = isInterestDetail(detailCode);

    let semesterCode = data.semesterCode;
    let lineCode = data.lineCode?.trim().toUpperCase() ?? "";
    let userTag = data.userTag?.trim().toUpperCase() ?? "";

    if (interestMode) {
      semesterCode = INTEREST_FORCED_VALUES.semesterCode;
      lineCode = INTEREST_FORCED_VALUES.lineCode;
      userTag = INTEREST_FORCED_VALUES.userTag;
    } else {
      semesterCode = semesterCode.trim().toUpperCase();

      if (!semesterCode) {
        return NextResponse.json({ message: "Debes seleccionar semestre" }, { status: 400 });
      }

      const semesterExists = catalogs.semesters.some((item) => item.code === semesterCode);
      if (!semesterExists) {
        return NextResponse.json({ message: "Semestre inválido" }, { status: 400 });
      }

      if (data.includeLineUserNow) {
        if (!lineCode) {
          return NextResponse.json({ message: "Debes seleccionar línea" }, { status: 400 });
        }

        const lineExists = catalogs.lines.some((item) => item.code === lineCode);
        if (!lineExists) {
          return NextResponse.json({ message: "Línea inválida" }, { status: 400 });
        }

        if (!userTag) {
          return NextResponse.json({ message: "Debes registrar USER" }, { status: 400 });
        }
      } else {
        lineCode = PENDING_VALUE;
        userTag = PENDING_VALUE;
      }
    }

    const wompiRequired = shouldRequestWompiMethod(accountCode, detailCode);

    let netAmount = amount;
    let wompiMethodCode: string | null = null;
    let commissionBase: number | null = null;
    let commissionIva: number | null = null;
    let commissionTcRate: number | null = null;

    if (wompiRequired) {
      const methodCode = data.wompiMethodCode?.trim().toUpperCase() ?? "";

      if (!methodCode) {
        return NextResponse.json({ message: "Debes seleccionar método WOMPI" }, { status: 400 });
      }

      if (methodCode !== "PSE" && methodCode !== "TC") {
        return NextResponse.json({ message: "Método WOMPI inválido" }, { status: 400 });
      }

      const wompiMethodEnabled = catalogs.wompiMethods.some((method) => method.code === methodCode);
      if (!wompiMethodEnabled) {
        return NextResponse.json({ message: "Método WOMPI no disponible" }, { status: 400 });
      }

      const wompiConfig = await getActiveWompiConfig();
      const calculation = calculateWompiNet(amount, methodCode, wompiConfig);

      wompiMethodCode = methodCode;
      netAmount = calculation.net;
      commissionBase = calculation.commissionBase;
      commissionIva = calculation.iva;
      commissionTcRate = calculation.tcExtraFee;
    }

    const createdIncome = await prisma.income.create({
      data: {
        requestId,
        grossAmount: amount,
        netAmount,
        semesterCode,
        accountCode,
        detailCode,
        wompiMethodCode,
        lineCode,
        userTag,
        isWompi: wompiRequired,
        commissionBase,
        commissionIva,
        commissionTcRate,
        createdById: user.id,
        extra: "-"
      }
    });

    return NextResponse.json({
      message: "Ingreso registrado correctamente",
      item: {
        ...createdIncome,
        grossAmount: Number(createdIncome.grossAmount),
        netAmount: Number(createdIncome.netAmount)
      }
    });
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;

    if (prismaError?.code === "P2002") {
      if (requestIdForIdempotency) {
        const existingIncome = await prisma.income.findUnique({ where: { requestId: requestIdForIdempotency } });

        if (existingIncome) {
          return NextResponse.json({
            message: "Ingreso ya registrado (idempotencia)",
            item: {
              ...existingIncome,
              grossAmount: Number(existingIncome.grossAmount),
              netAmount: Number(existingIncome.netAmount)
            }
          });
        }
      }
    }

    if (prismaError?.code) {
      return NextResponse.json({ message: "Error de base de datos" }, { status: 500 });
    }

    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return NextResponse.json({ message: `No fue posible registrar el ingreso: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: "No fue posible registrar el ingreso" }, { status: 500 });
  }
}
