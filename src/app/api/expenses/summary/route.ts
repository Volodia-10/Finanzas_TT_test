import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { buildExpenseWhere, parseExpenseFilters } from "@/lib/expense-query";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const filters = parseExpenseFilters(request.nextUrl.searchParams);
    const where = buildExpenseWhere(filters);

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "asc" }
    });

    const totalAmount = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalRealAmount = expenses.reduce((sum, item) => sum + Number(item.realAmount), 0);
    const recordsCount = expenses.length;
    const averageRealAmount = recordsCount > 0 ? totalRealAmount / recordsCount : 0;

    const byCategoryMap = new Map<string, { totalAmount: number; totalRealAmount: number }>();
    const matrixMap = new Map<string, { totalAmount: number; totalRealAmount: number }>();
    const byDateMap = new Map<string, number>();
    const byAccountMap = new Map<string, number>();

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      const realAmount = Number(expense.realAmount);

      const categoryTotals = byCategoryMap.get(expense.categoryCode) ?? { totalAmount: 0, totalRealAmount: 0 };
      categoryTotals.totalAmount += amount;
      categoryTotals.totalRealAmount += realAmount;
      byCategoryMap.set(expense.categoryCode, categoryTotals);

      const matrixKey = `${expense.accountCode}__${expense.semesterCode}`;
      const matrixTotals = matrixMap.get(matrixKey) ?? { totalAmount: 0, totalRealAmount: 0 };
      matrixTotals.totalAmount += amount;
      matrixTotals.totalRealAmount += realAmount;
      matrixMap.set(matrixKey, matrixTotals);

      const chartDate = new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit"
      }).format(expense.createdAt);

      byDateMap.set(chartDate, (byDateMap.get(chartDate) ?? 0) + realAmount);
      byAccountMap.set(expense.accountCode, (byAccountMap.get(expense.accountCode) ?? 0) + realAmount);
    }

    const byCategory = Array.from(byCategoryMap.entries()).map(([categoryCode, totals]) => ({
      categoryCode,
      totalAmount: totals.totalAmount,
      totalRealAmount: totals.totalRealAmount
    }));

    const matrix = Array.from(matrixMap.entries()).map(([key, totals]) => {
      const [accountCode, semesterCode] = key.split("__");

      return {
        accountCode,
        semesterCode,
        totalAmount: totals.totalAmount,
        totalRealAmount: totals.totalRealAmount
      };
    });

    return NextResponse.json({
      totalAmount,
      totalRealAmount,
      recordsCount,
      averageRealAmount,
      byCategory,
      matrix,
      charts: {
        byDate: Array.from(byDateMap.entries()).map(([label, total]) => ({ label, total })),
        byAccount: Array.from(byAccountMap.entries()).map(([label, total]) => ({ label, total })),
        byCategory: byCategory.map((item) => ({ label: item.categoryCode, total: item.totalRealAmount }))
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible generar resumen de egresos" }, { status: 400 });
  }
}
