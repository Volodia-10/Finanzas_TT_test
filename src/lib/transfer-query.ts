import type { Prisma } from "@prisma/client";
import { transferFilterSchema } from "@/lib/validation";

export type ParsedTransferFilters = {
  from: Date | null;
  to: Date | null;
  originAccountCode: string;
  destinationAccountCode: string;
  page: number;
  pageSize: number;
};

function parseDate(value: string): Date | null {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function parseTransferFilters(searchParams: URLSearchParams): ParsedTransferFilters {
  const parsed = transferFilterSchema.parse(Object.fromEntries(searchParams.entries()));

  const from = parseDate(parsed.from);
  const to = parseDate(parsed.to);

  if (to) {
    to.setHours(23, 59, 59, 999);
  }

  return {
    from,
    to,
    originAccountCode: parsed.originAccountCode.trim(),
    destinationAccountCode: parsed.destinationAccountCode.trim(),
    page: parsed.page,
    pageSize: parsed.pageSize
  };
}

export function buildTransferWhere(filters: ParsedTransferFilters): Prisma.InternalTransferWhereInput {
  const andClauses: Prisma.InternalTransferWhereInput[] = [];

  if (filters.from || filters.to) {
    andClauses.push({
      transferAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      }
    });
  }

  if (filters.originAccountCode) {
    andClauses.push({ originAccountCode: filters.originAccountCode });
  }

  if (filters.destinationAccountCode) {
    andClauses.push({ destinationAccountCode: filters.destinationAccountCode });
  }

  return andClauses.length ? { AND: andClauses } : {};
}
