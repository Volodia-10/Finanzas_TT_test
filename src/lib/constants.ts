export const COOKIE_NAME = "pf_tt_session";
export const DEFAULT_TIME_ZONE = "America/Bogota";

export const WOMPI_DETAIL_CODE = "WOMPI";
export const WOMPI_ACCOUNT_PREFIX = "BANCOLOMBIA_";
export const INTEREST_DETAIL_CODE = "PAGO INTERESES";
export const PENDING_VALUE = "PENDIENTE";

export const INTEREST_FORCED_VALUES = {
  semesterCode: "GENERAL",
  lineCode: "GENERAL",
  userTag: "INTERESES"
} as const;

export const INCOMES_DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_WOMPI_CONFIG = {
  baseFeeRate: 0.0265,
  fixedFee: 700,
  ivaRate: 0.19,
  tcExtraRate: 0.015
} as const;
