import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { readExpenseCatalogs } from "@/lib/expense-catalogs";
import { buildExpenseWhere, parseExpenseFilters } from "@/lib/expense-query";
import {
  buildExpenseReason,
  calculateExpenseRealAmount,
  categoryAllowsBulk,
  getExpenseReasonMode
} from "@/lib/expense-rules";
import { parseCopInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createExpenseSchema } from "@/lib/validation";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const filters = parseExpenseFilters(request.nextUrl.searchParams);
    const where = buildExpenseWhere(filters);

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
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
      items: expenses.map((expense) => ({
        id: expense.id,
        createdAt: expense.createdAt,
        amount: Number(expense.amount),
        realAmount: Number(expense.realAmount),
        accountCode: expense.accountCode,
        methodCode: expense.methodCode,
        semesterCode: expense.semesterCode,
        categoryCode: expense.categoryCode,
        reason: expense.reason,
        reasonBase: expense.reasonBase,
        monthCode: expense.monthCode,
        carNameCode: expense.carNameCode,
        carMotiveCode: expense.carMotiveCode,
        carReasonText: expense.carReasonText,
        authorizedBy: expense.authorizedBy,
        responsible: expense.responsible,
        createdBy: expense.createdBy.name
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / filters.pageSize))
    });
  } catch {
    return NextResponse.json({ message: "No fue posible consultar egresos" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  let requestIdForIdempotency: string | null = null;
  let isBulkForIdempotency = false;
  let bulkRowCountForIdempotency = 0;

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const requestId = parsed.data.requestId.trim();
    requestIdForIdempotency = requestId;

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

    if (!semesterCodes.has(semesterCode)) {
      return NextResponse.json({ message: "Semestre inválido" }, { status: 400 });
    }

    if (!methodCodes.has(methodCode)) {
      return NextResponse.json({ message: "Método inválido" }, { status: 400 });
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

    const reasonCatalogs = {
      monthCodes: expenseCatalogs.expenseMonths.map((item) => item.code),
      employeeCodes: expenseCatalogs.expenseEmployees.map((item) => item.code),
      carNameCodes: expenseCatalogs.carNames.map((item) => item.code),
      carMotiveCodes: expenseCatalogs.carMotives.map((item) => item.code)
    };

    const isBulk = parsed.data.isBulk ?? false;
    isBulkForIdempotency = isBulk;

    if (isBulk) {
      if (!categoryAllowsBulk(categoryCode)) {
        return NextResponse.json(
          { message: "La categoría seleccionada no permite registro masivo" },
          { status: 400 }
        );
      }

      const reasonMode = getExpenseReasonMode(categoryCode);
      if (reasonMode !== "employee" && reasonMode !== "select") {
        return NextResponse.json(
          { message: "La categoría seleccionada no admite carga masiva por empleado" },
          { status: 400 }
        );
      }

      const rows = parsed.data.bulkRows ?? [];
      if (!rows.length) {
        return NextResponse.json({ message: "Debes agregar al menos una fila al egreso masivo" }, { status: 400 });
      }

      const normalizedRows: Array<{ rowNumber: number; employeeCode: string; amount: number }> = [];
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const employeeCode = normalizeCode(row.employeeCode);
        const amount = parseCopInput(row.amountInput);

        if (!employeeCode) {
          return NextResponse.json({ message: `Fila ${index + 1}: empleado inválido` }, { status: 400 });
        }

        if (!amount || amount <= 0) {
          return NextResponse.json({ message: `Fila ${index + 1}: el monto debe ser mayor a cero` }, { status: 400 });
        }

        normalizedRows.push({
          rowNumber: index + 1,
          employeeCode,
          amount
        });
      }

      const duplicatedEmployee = normalizedRows.find(
        (row, index) => normalizedRows.findIndex((candidate) => candidate.employeeCode === row.employeeCode) !== index
      );

      if (duplicatedEmployee) {
        return NextResponse.json(
          { message: `Empleado/razón duplicado en lote: ${duplicatedEmployee.employeeCode}` },
          { status: 400 }
        );
      }

      let preparedRows: Array<{
        requestId: string;
        rowNumber: number;
        amount: number;
        realAmount: number;
        reasonResult: ReturnType<typeof buildExpenseReason>;
      }> = [];

      try {
        preparedRows = normalizedRows.map((row, index) => {
          const reasonResult = buildExpenseReason(
            {
              categoryCode,
              reasonInput: row.employeeCode,
              monthCode: parsed.data.monthCode
            },
            reasonCatalogs
          );

          return {
            requestId: `${requestId}__${index}`,
            rowNumber: row.rowNumber,
            amount: row.amount,
            realAmount: calculateExpenseRealAmount(row.amount, accountCode),
            reasonResult
          };
        });
      } catch (validationError) {
        return NextResponse.json(
          {
            message: validationError instanceof Error ? validationError.message : "No fue posible validar el lote de egresos"
          },
          { status: 400 }
        );
      }

      const reasonBases = preparedRows
        .map((row) => row.reasonResult.reasonBase)
        .filter((item): item is string => Boolean(item));

      const duplicateInDatabase = await prisma.expense.findMany({
        where: {
          categoryCode,
          semesterCode,
          monthCode: preparedRows[0]?.reasonResult.monthCode ?? null,
          reasonBase: {
            in: reasonBases
          }
        },
        select: {
          reasonBase: true
        }
      });

      if (duplicateInDatabase.length) {
        const duplicatedList = Array.from(
          new Set(duplicateInDatabase.map((item) => item.reasonBase).filter((item): item is string => Boolean(item)))
        ).join(", ");

        return NextResponse.json(
          {
            message: `Ya existen egresos para estos empleados/razones en el mismo período: ${duplicatedList}`
          },
          { status: 409 }
        );
      }

      bulkRowCountForIdempotency = preparedRows.length;

      await prisma.$transaction(
        preparedRows.map((row) =>
          prisma.expense.create({
            data: {
              requestId: row.requestId,
              amount: row.amount,
              realAmount: row.realAmount,
              accountCode,
              methodCode,
              semesterCode,
              categoryCode,
              reason: row.reasonResult.reason,
              reasonBase: row.reasonResult.reasonBase,
              monthCode: row.reasonResult.monthCode,
              carNameCode: row.reasonResult.carNameCode,
              carMotiveCode: row.reasonResult.carMotiveCode,
              carReasonText: row.reasonResult.carReasonText,
              authorizedBy,
              responsible,
              createdById: user.id
            }
          })
        )
      );

      return NextResponse.json({
        message: `Egreso masivo registrado correctamente (${preparedRows.length} filas)`,
        createdCount: preparedRows.length
      });
    }

    const amount = parseCopInput(parsed.data.amountInput);
    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "El monto debe ser mayor a cero" }, { status: 400 });
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
        reasonCatalogs
      );
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "No fue posible construir RAZÓN" },
        { status: 400 }
      );
    }

    const realAmount = calculateExpenseRealAmount(amount, accountCode);

    const createdExpense = await prisma.expense.create({
      data: {
        requestId,
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
        responsible,
        createdById: user.id
      }
    });

    return NextResponse.json({
      message: "Egreso registrado correctamente",
      item: {
        ...createdExpense,
        amount: Number(createdExpense.amount),
        realAmount: Number(createdExpense.realAmount)
      }
    });
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;

    if (prismaError?.code === "P2002") {
      if (requestIdForIdempotency) {
        if (isBulkForIdempotency && bulkRowCountForIdempotency > 0) {
          const bulkRequestIds = Array.from({ length: bulkRowCountForIdempotency }, (_, index) => `${requestIdForIdempotency}__${index}`);
          const existingCount = await prisma.expense.count({
            where: {
              requestId: {
                in: bulkRequestIds
              }
            }
          });

          if (existingCount === bulkRowCountForIdempotency) {
            return NextResponse.json({
              message: `Egreso masivo ya registrado (idempotencia) (${existingCount} filas)`,
              createdCount: existingCount
            });
          }
        }

        const existingExpense = await prisma.expense.findUnique({
          where: { requestId: requestIdForIdempotency }
        });

        if (existingExpense) {
          return NextResponse.json({
            message: "Egreso ya registrado (idempotencia)",
            item: {
              ...existingExpense,
              amount: Number(existingExpense.amount),
              realAmount: Number(existingExpense.realAmount)
            }
          });
        }
      }
    }

    if (prismaError?.code) {
      return NextResponse.json({ message: "Error de base de datos" }, { status: 500 });
    }

    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return NextResponse.json({ message: `No fue posible registrar egreso: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: "No fue posible registrar egreso" }, { status: 500 });
  }
}
