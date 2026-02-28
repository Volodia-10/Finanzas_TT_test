import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { getActiveWompiConfig } from "@/lib/wompi-config";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const [catalogs, wompiConfig] = await Promise.all([readCatalogs(), getActiveWompiConfig()]);

  const detailsByAccount = catalogs.accountDetailMappings.reduce<Record<string, { code: string; label: string }[]>>(
    (accumulator, mapping) => {
      const accountCode = mapping.account.code;
      if (!accumulator[accountCode]) {
        accumulator[accountCode] = [];
      }

      accumulator[accountCode].push({
        code: mapping.detailOption.code,
        label: mapping.detailOption.label
      });

      return accumulator;
    },
    {}
  );

  return NextResponse.json({
    accounts: catalogs.accounts.map((account) => ({ code: account.code, label: account.name })),
    semesters: catalogs.semesters.map((semester) => ({ code: semester.code, label: semester.label })),
    lines: catalogs.lines.map((line) => ({ code: line.code, label: line.label })),
    wompiMethods: catalogs.wompiMethods.map((method) => ({ code: method.code, label: method.label })),
    detailsByAccount,
    wompiConfig
  });
}
