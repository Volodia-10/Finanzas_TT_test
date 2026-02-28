import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { buildIncomeWhere, parseIncomeFilters } from "@/lib/income-query";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const filters = parseIncomeFilters(request.nextUrl.searchParams);
    const where = buildIncomeWhere(filters);

    const incomes = await prisma.income.findMany({
      where,
      orderBy: { createdAt: "asc" }
    });

    const totalNet = incomes.reduce((sum, item) => sum + Number(item.netAmount), 0);
    const recordsCount = incomes.length;
    const averageTicket = recordsCount > 0 ? totalNet / recordsCount : 0;

    const matrixMap = new Map<string, number>();
    const lineChartMap = new Map<string, number>();
    const byAccountMap = new Map<string, number>();

    for (const income of incomes) {
      const matrixKey = `${income.accountCode}__${income.semesterCode}`;
      matrixMap.set(matrixKey, (matrixMap.get(matrixKey) ?? 0) + Number(income.netAmount));

      const chartDate = new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit"
      }).format(income.createdAt);

      lineChartMap.set(chartDate, (lineChartMap.get(chartDate) ?? 0) + Number(income.netAmount));
      byAccountMap.set(income.accountCode, (byAccountMap.get(income.accountCode) ?? 0) + Number(income.netAmount));
    }

    const matrix = Array.from(matrixMap.entries()).map(([key, total]) => {
      const [accountCode, semesterCode] = key.split("__");
      return {
        accountCode,
        semesterCode,
        total
      };
    });

    return NextResponse.json({
      totalNet,
      recordsCount,
      averageTicket,
      matrix,
      charts: {
        byDate: Array.from(lineChartMap.entries()).map(([label, total]) => ({ label, total })),
        byAccount: Array.from(byAccountMap.entries()).map(([label, total]) => ({ label, total }))
      }
    });
  } catch {
    return NextResponse.json({ message: "No fue posible generar resumen" }, { status: 400 });
  }
}
