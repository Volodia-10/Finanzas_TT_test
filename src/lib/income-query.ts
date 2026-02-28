import type { Prisma } from "@prisma/client";
import { incomeFilterSchema } from "@/lib/validation";

export type ParsedIncomeFilters = {
  from: Date | null;
  to: Date | null;
  accountCode: string;
  semesterCode: string;
  lineCode: string;
  userTag: string;
  detailCode: string;
  search: string;
  page: number;
  pageSize: number;
};

function parseDate(value: string): Date | null {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function parseIncomeFilters(searchParams: URLSearchParams): ParsedIncomeFilters {
  const parsed = incomeFilterSchema.parse(Object.fromEntries(searchParams.entries()));

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
    lineCode: parsed.lineCode.trim(),
    userTag: parsed.userTag.trim(),
    detailCode: parsed.detailCode.trim(),
    search: parsed.search.trim(),
    page: parsed.page,
    pageSize: parsed.pageSize
  };
}

export function buildIncomeWhere(filters: ParsedIncomeFilters): Prisma.IncomeWhereInput {
  const andClauses: Prisma.IncomeWhereInput[] = [];

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

  if (filters.lineCode) {
    andClauses.push({ lineCode: filters.lineCode });
  }

  if (filters.detailCode) {
    andClauses.push({ detailCode: filters.detailCode });
  }

  if (filters.userTag) {
    andClauses.push({
      userTag: {
        contains: filters.userTag,
        mode: "insensitive"
      }
    });
  }

  if (filters.search) {
    andClauses.push({
      OR: [
        {
          accountCode: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          detailCode: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          userTag: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          semesterCode: {
            contains: filters.search,
            mode: "insensitive"
          }
        },
        {
          lineCode: {
            contains: filters.search,
            mode: "insensitive"
          }
        }
      ]
    });
  }

  return andClauses.length ? { AND: andClauses } : {};
}
