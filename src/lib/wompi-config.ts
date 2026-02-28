import { DEFAULT_WOMPI_CONFIG } from "@/lib/constants";
import type { WompiConfigRates } from "@/lib/income-rules";
import { prisma } from "@/lib/prisma";

export function getDefaultWompiConfig(): WompiConfigRates {
  return { ...DEFAULT_WOMPI_CONFIG };
}

export async function getActiveWompiConfig(): Promise<WompiConfigRates> {
  // Fallback defensivo para entornos locales donde Prisma Client o migraciones
  // aún no están sincronizados después de una actualización.
  const wompiDelegate = (
    prisma as unknown as {
      wompiConfig?: {
        findFirst: (args: {
          where: { isActive: boolean };
          orderBy: Array<{ isSystem: "desc" } | { updatedAt: "desc" }>;
        }) => Promise<
          | {
              baseFeeRate: unknown;
              fixedFee: unknown;
              ivaRate: unknown;
              tcExtraRate: unknown;
            }
          | null
        >;
      };
    }
  ).wompiConfig;

  if (!wompiDelegate || typeof wompiDelegate.findFirst !== "function") {
    return getDefaultWompiConfig();
  }

  let config: {
    baseFeeRate: unknown;
    fixedFee: unknown;
    ivaRate: unknown;
    tcExtraRate: unknown;
  } | null = null;

  try {
    config = await wompiDelegate.findFirst({
      where: { isActive: true },
      orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }]
    });
  } catch {
    return getDefaultWompiConfig();
  }

  if (!config) {
    return getDefaultWompiConfig();
  }

  return {
    baseFeeRate: Number(config.baseFeeRate),
    fixedFee: Number(config.fixedFee),
    ivaRate: Number(config.ivaRate),
    tcExtraRate: Number(config.tcExtraRate)
  };
}
