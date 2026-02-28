import { prisma } from "@/lib/prisma";
import { EXPENSE_MONTH_ORDER } from "@/lib/expense-rules";

type ExpenseCatalogReadOptions = {
  includeInactive?: boolean;
};

export async function readExpenseCatalogs(options?: ExpenseCatalogReadOptions) {
  const includeInactive = options?.includeInactive ?? false;

  const where = includeInactive ? {} : { isActive: true };
  const monthIndex = new Map<string, number>(EXPENSE_MONTH_ORDER.map((code, index) => [code, index]));

  const [expenseMethods, expenseCategories, expenseMonths, expenseEmployees, expenseAuthorizers, expenseResponsibles, carNames, carMotives] =
    await Promise.all([
      prisma.expenseMethod.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseCategory.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseMonth.findMany({ where, orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }] }),
      prisma.expenseEmployee.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseAuthorizer.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseResponsible.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.carName.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.carMotive.findMany({ where, orderBy: [{ isSystem: "desc" }, { code: "asc" }] })
    ]);

  const sortedExpenseMonths = [...expenseMonths].sort((a, b) => {
    const indexA = monthIndex.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const indexB = monthIndex.get(b.code) ?? Number.MAX_SAFE_INTEGER;

    if (indexA !== indexB) return indexA - indexB;
    return a.code.localeCompare(b.code, "es");
  });

  return {
    expenseMethods,
    expenseCategories,
    expenseMonths: sortedExpenseMonths,
    expenseEmployees,
    expenseAuthorizers,
    expenseResponsibles,
    carNames,
    carMotives
  };
}
