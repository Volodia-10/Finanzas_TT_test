import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { readExpenseCatalogs } from "@/lib/expense-catalogs";
import { buildExpenseReason, calculateExpenseRealAmount } from "@/lib/expense-rules";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { adminUpdateExpenseSchema } from "@/lib/validation";

type RouteParams = {
  params: {
    expenseId: string;
  };
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ message: "Solo ADMIN puede editar egresos" }, { status: 403 });
  }

  const expenseId = params.expenseId?.trim();
  if (!expenseId) {
    return NextResponse.json({ message: "ID inválido" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adminUpdateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const current = await prisma.expense.findUnique({ where: { id: expenseId } });

    if (!current) {
      return NextResponse.json({ message: "Egreso no encontrado" }, { status: 404 });
    }

    const amount = parseCopInput(parsed.data.amountInput);
    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "La cantidad debe ser mayor a cero" }, { status: 400 });
    }

    const [sharedCatalogs, expenseCatalogs] = await Promise.all([readCatalogs(), readExpenseCatalogs()]);

    const accountCode = normalizeCode(parsed.data.accountCode);
    const methodCode = normalizeCode(parsed.data.methodCode);
    const semesterCode = normalizeCode(parsed.data.semesterCode);
    const categoryCode = normalizeCode(parsed.data.categoryCode);
    const authorizedBy = normalizeCode(parsed.data.authorizedBy);
    const responsible = normalizeCode(parsed.data.responsible);

    const accountCodes = new Set(sharedCatalogs.accounts.map((item) => normalizeCode(item.code)));
    const semesterCodes = new Set(sharedCatalogs.semesters.map((item) => normalizeCode(item.code)));
    const methodCodes = new Set(expenseCatalogs.expenseMethods.map((item) => normalizeCode(item.code)));
    const categoryCodes = new Set(expenseCatalogs.expenseCategories.map((item) => normalizeCode(item.code)));
    const authorizerCodes = new Set(expenseCatalogs.expenseAuthorizers.map((item) => normalizeCode(item.code)));
    const responsibleCodes = new Set(expenseCatalogs.expenseResponsibles.map((item) => normalizeCode(item.code)));

    if (!accountCodes.has(accountCode)) {
      return NextResponse.json({ message: "Cuenta inválida" }, { status: 400 });
    }

    if (!methodCodes.has(methodCode)) {
      return NextResponse.json({ message: "Método inválido" }, { status: 400 });
    }

    if (!semesterCodes.has(semesterCode)) {
      return NextResponse.json({ message: "Semestre inválido" }, { status: 400 });
    }

    if (!categoryCodes.has(categoryCode)) {
      return NextResponse.json({ message: "Categoría inválida" }, { status: 400 });
    }

    if (!authorizerCodes.has(authorizedBy)) {
      return NextResponse.json({ message: "AUTORIZÓ inválido" }, { status: 400 });
    }

    if (!responsibleCodes.has(responsible)) {
      return NextResponse.json({ message: "RESPONSABLE inválido" }, { status: 400 });
    }

    let reasonResult;

    try {
      reasonResult = buildExpenseReason(
        {
          categoryCode,
          reasonInput: parsed.data.reasonInput,
          monthCode: parsed.data.monthCode,
          carNameCode: parsed.data.carNameCode,
          carMotiveCode: parsed.data.carMotiveCode,
          carReasonText: parsed.data.carReasonText
        },
        {
          monthCodes: expenseCatalogs.expenseMonths.map((item) => item.code),
          employeeCodes: expenseCatalogs.expenseEmployees.map((item) => item.code),
          carNameCodes: expenseCatalogs.carNames.map((item) => item.code),
          carMotiveCodes: expenseCatalogs.carMotives.map((item) => item.code)
        }
      );
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "No fue posible construir RAZÓN" },
        { status: 400 }
      );
    }

    const realAmount = calculateExpenseRealAmount(amount, accountCode);

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount,
        realAmount,
        accountCode,
        methodCode,
        semesterCode,
        categoryCode,
        reason: reasonResult.reason,
        reasonBase: reasonResult.reasonBase,
        monthCode: reasonResult.monthCode,
        carNameCode: reasonResult.carNameCode,
        carMotiveCode: reasonResult.carMotiveCode,
        carReasonText: reasonResult.carReasonText,
        authorizedBy,
        responsible
      }
    });

    return NextResponse.json({
      message: "Egreso actualizado",
      item: {
        id: updated.id,
        amount: Number(updated.amount),
        realAmount: Number(updated.realAmount),
        accountCode: updated.accountCode,
        methodCode: updated.methodCode,
        semesterCode: updated.semesterCode,
        categoryCode: updated.categoryCode,
        reason: updated.reason,
        authorizedBy: updated.authorizedBy,
        responsible: updated.responsible
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar egreso" }, { status: 500 });
  }
}
