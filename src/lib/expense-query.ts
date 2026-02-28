import type { Prisma } from "@prisma/client";
import { expenseFilterSchema } from "@/lib/validation";

export type ParsedExpenseFilters = {
  from: Date | null;
  to: Date | null;
  accountCode: string;
  semesterCode: string;
  categoryCode: string;
  page: number;
  pageSize: number;
};

function parseDate(value: string): Date | null {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function parseExpenseFilters(searchParams: URLSearchParams): ParsedExpenseFilters {
  const parsed = expenseFilterSchema.parse(Object.fromEntries(searchParams.entries()));

  const from = parseDate(parsed.from);
  const to = parseDate(parsed.to);

  if (to) {
    to.setHours(23, 59, 59, 999);
  }

  return {
    from,
    to,
    accountCode: parsed.accountCode.trim(),
    semesterCode: parsed.semesterCode.trim(),
    categoryCode: parsed.categoryCode.trim(),
    page: parsed.page,
    pageSize: parsed.pageSize
  };
}

export function buildExpenseWhere(filters: ParsedExpenseFilters): Prisma.ExpenseWhereInput {
  const andClauses: Prisma.ExpenseWhereInput[] = [];

  if (filters.from || filters.to) {
    andClauses.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      }
    });
  }

  if (filters.accountCode) {
    andClauses.push({ accountCode: filters.accountCode });
  }

  if (filters.semesterCode) {
    andClauses.push({ semesterCode: filters.semesterCode });
  }

  if (filters.categoryCode) {
    andClauses.push({ categoryCode: filters.categoryCode });
  }

  return andClauses.length ? { AND: andClauses } : {};
}
