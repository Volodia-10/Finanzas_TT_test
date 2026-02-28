import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { DEFAULT_WOMPI_CONFIG } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getActiveWompiConfig } from "@/lib/wompi-config";
import { z } from "zod";

const wompiConfigSchema = z.object({
  baseFeeRate: z.coerce.number().min(0).max(1),
  fixedFee: z.coerce.number().min(0),
  ivaRate: z.coerce.number().min(0).max(1),
  tcExtraRate: z.coerce.number().min(0).max(1)
});

async function ensureAdmin() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "No autorizado" }, { status: 401 })
    };
  }

  if (user.role !== UserRole.ADMIN) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Solo ADMIN puede configurar WOMPI" }, { status: 403 })
    };
  }

  return { ok: true as const };
}

export async function GET() {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const config = await getActiveWompiConfig();
  return NextResponse.json({ config });
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = wompiConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
    }

    const nextConfig = {
      baseFeeRate: parsed.data.baseFeeRate,
      fixedFee: parsed.data.fixedFee,
      ivaRate: parsed.data.ivaRate,
      tcExtraRate: parsed.data.tcExtraRate
    };

    await prisma.wompiConfig.upsert({
      where: { code: "DEFAULT" },
      update: {
        ...nextConfig,
        isActive: true,
        isSystem: true
      },
      create: {
        code: "DEFAULT",
        ...DEFAULT_WOMPI_CONFIG,
        ...nextConfig,
        isActive: true,
        isSystem: true
      }
    });

    return NextResponse.json({ message: "Configuración WOMPI actualizada", config: nextConfig });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar configuración WOMPI" }, { status: 500 });
  }
}
