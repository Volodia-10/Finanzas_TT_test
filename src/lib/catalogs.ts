import { prisma } from "@/lib/prisma";

type CatalogReadOptions = {
  includeInactive?: boolean;
  includeNonSelectable?: boolean;
};

export async function readCatalogs(options?: CatalogReadOptions) {
  const includeInactive = options?.includeInactive ?? false;
  const includeNonSelectable = options?.includeNonSelectable ?? false;

  const [accounts, semesters, lines, wompiMethods, details, accountDetailMappings] = await Promise.all([
    prisma.account.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }]
    }),
    prisma.semester.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(includeNonSelectable ? {} : { isSelectable: true })
      },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }]
    }),
    prisma.line.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(includeNonSelectable ? {} : { isSelectable: true })
      },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }]
    }),
    prisma.wompiMethod.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }]
    }),
    prisma.detailOption.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }]
    }),
    prisma.accountDetailMap.findMany({
      where: includeInactive
        ? {}
        : {
            isActive: true,
            account: { isActive: true },
            detailOption: { isActive: true }
          },
      include: {
        account: true,
        detailOption: true
      },
      orderBy: [{ account: { code: "asc" } }, { detailOption: { code: "asc" } }]
    })
  ]);

  return {
    accounts,
    semesters,
    lines,
    wompiMethods,
    details,
    accountDetailMappings
  };
}
