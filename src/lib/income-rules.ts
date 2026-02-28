import {
  DEFAULT_WOMPI_CONFIG,
  INTEREST_DETAIL_CODE,
  WOMPI_ACCOUNT_PREFIX,
  WOMPI_DETAIL_CODE
} from "@/lib/constants";
import { roundToTwo } from "@/lib/money";

export type WompiMethodCode = "PSE" | "TC";

export type WompiCalculation = {
  commissionBase: number;
  iva: number;
  tcExtraFee: number;
  discount: number;
  net: number;
};

export type WompiConfigRates = {
  baseFeeRate: number;
  fixedFee: number;
  ivaRate: number;
  tcExtraRate: number;
};

export function shouldRequestWompiMethod(accountCode: string, detailCode: string): boolean {
  return accountCode.startsWith(WOMPI_ACCOUNT_PREFIX) && detailCode === WOMPI_DETAIL_CODE;
}

export function isInterestDetail(detailCode: string): boolean {
  return detailCode === INTEREST_DETAIL_CODE;
}

export function calculateWompiNet(
  grossAmount: number,
  methodCode: WompiMethodCode,
  config?: WompiConfigRates
): WompiCalculation {
  const wompiConfig = config ?? DEFAULT_WOMPI_CONFIG;

  const commissionBase = roundToTwo(grossAmount * wompiConfig.baseFeeRate + wompiConfig.fixedFee);
  const iva = roundToTwo(commissionBase * wompiConfig.ivaRate);
  const tcExtraFee = methodCode === "TC" ? roundToTwo(grossAmount * wompiConfig.tcExtraRate) : 0;
  const discount = roundToTwo(commissionBase + iva + tcExtraFee);
  const net = roundToTwo(grossAmount - discount);

  return {
    commissionBase,
    iva,
    tcExtraFee,
    discount,
    net
  };
}
