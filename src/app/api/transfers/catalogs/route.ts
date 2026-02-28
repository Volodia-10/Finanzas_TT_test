import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const catalogs = await readCatalogs();

  return NextResponse.json({
    accounts: catalogs.accounts.map((item) => ({
      code: item.code,
      label: item.name
    }))
  });
}
