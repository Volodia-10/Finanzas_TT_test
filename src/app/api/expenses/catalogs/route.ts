import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { readExpenseCatalogs } from "@/lib/expense-catalogs";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const [sharedCatalogs, expenseCatalogs] = await Promise.all([readCatalogs(), readExpenseCatalogs()]);

  return NextResponse.json({
    accounts: sharedCatalogs.accounts.map((item) => ({ code: item.code, label: item.name })),
    semesters: sharedCatalogs.semesters.map((item) => ({ code: item.code, label: item.label })),
    methods: expenseCatalogs.expenseMethods.map((item) => ({ code: item.code, label: item.label })),
    categories: expenseCatalogs.expenseCategories.map((item) => ({ code: item.code, label: item.label })),
    months: expenseCatalogs.expenseMonths.map((item) => ({ code: item.code, label: item.label })),
    employees: expenseCatalogs.expenseEmployees.map((item) => ({ code: item.code, label: item.label })),
    authorizers: expenseCatalogs.expenseAuthorizers.map((item) => ({ code: item.code, label: item.label })),
    responsibles: expenseCatalogs.expenseResponsibles.map((item) => ({ code: item.code, label: item.label })),
    carNames: expenseCatalogs.carNames.map((item) => ({ code: item.code, label: item.label })),
    carMotives: expenseCatalogs.carMotives.map((item) => ({ code: item.code, label: item.label }))
  });
}
