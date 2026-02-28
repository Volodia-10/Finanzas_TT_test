import { roundToTwo } from "@/lib/money";

export type ExpenseReasonMode = "text" | "select" | "employee" | "none" | "car";

export const EXPENSE_MONTH_ORDER = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE"
] as const;

export const EXPENSE_MONTH_REQUIRED_CATEGORIES = new Set([
  "ADELANTO",
  "ITAÚ-APTOS",
  "MERCADO",
  "PAGO_NÓMINA",
  "VIATICOS",
  "IMPUESTOS",
  "SEGURIDAD_SOCIAL",
  "PRIMAS"
]);

export const EXPENSE_BULK_ALLOWED_CATEGORIES = new Set([
  "PAGO_NÓMINA",
  "PRIMAS",
  "ITAÚ-APTOS",
  "MERCADO"
]);

const EMPLOYEE_REASON_CATEGORIES = new Set(["ADELANTO", "PAGO_NÓMINA", "VIATICOS", "PRIMAS"]);
const NO_REASON_CATEGORIES = new Set(["SEGURIDAD_SOCIAL", "CESANTIAS"]);
const CAR_CATEGORY = "CARROS";

export const EXPENSE_REASON_OPTIONS: Record<string, string[]> = {
  "DEVOLUCIÓN": ["CANCELACIÓN", "PAGO DE MAS", "MALA MIGRACIÓN"],
  "BASE DE DATOS": ["126", "226", "326", "426", "526"],
  "ITAÚ-APTOS": ["JESÚS", "FELIPE", "MARLON"],
  "MERCADO": ["JESÚS", "FELIPE", "MARLON"],
  "SOFTWARE": ["CAPITAL_BRANCH", "GOOGLE_STORAGE", "LOOM", "PROTON", "PUBLICIDAD", "RECARGA_CELULAR"],
  "IMPUESTOS": ["INDUSTRIA_Y_COMERCIO", "RENTA", "IVA", "RETEFUENTE"]
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeReasonText(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function assertInSet(code: string, set: Set<string>, message: string): void {
  if (!set.has(code)) {
    throw new Error(message);
  }
}

export function getExpenseReasonMode(categoryCode: string): ExpenseReasonMode {
  const normalized = normalizeCode(categoryCode);

  if (normalized === CAR_CATEGORY) {
    return "car";
  }

  if (NO_REASON_CATEGORIES.has(normalized)) {
    return "none";
  }

  if (EMPLOYEE_REASON_CATEGORIES.has(normalized)) {
    return "employee";
  }

  if (EXPENSE_REASON_OPTIONS[normalized]) {
    return "select";
  }

  return "text";
}

export function categoryRequiresMonth(categoryCode: string): boolean {
  return EXPENSE_MONTH_REQUIRED_CATEGORIES.has(normalizeCode(categoryCode));
}

export function categoryAllowsBulk(categoryCode: string): boolean {
  return EXPENSE_BULK_ALLOWED_CATEGORIES.has(normalizeCode(categoryCode));
}

export function getCurrentSystemYear(): number {
  return new Date().getFullYear();
}

export type BuildExpenseReasonInput = {
  categoryCode: string;
  reasonInput?: string | null;
  monthCode?: string | null;
  carNameCode?: string | null;
  carMotiveCode?: string | null;
  carReasonText?: string | null;
  year?: number;
};

export type BuildExpenseReasonCatalogs = {
  monthCodes: string[];
  employeeCodes: string[];
  carNameCodes: string[];
  carMotiveCodes: string[];
};

export type BuildExpenseReasonResult = {
  reason: string;
  reasonBase: string | null;
  monthCode: string | null;
  carNameCode: string | null;
  carMotiveCode: string | null;
  carReasonText: string | null;
};

export function buildExpenseReason(
  input: BuildExpenseReasonInput,
  catalogs: BuildExpenseReasonCatalogs
): BuildExpenseReasonResult {
  const categoryCode = normalizeCode(input.categoryCode);
  if (!categoryCode) {
    throw new Error("Categoría inválida");
  }

  const reasonMode = getExpenseReasonMode(categoryCode);
  const requiresMonth = categoryRequiresMonth(categoryCode);
  const year = input.year ?? getCurrentSystemYear();

  const monthSet = new Set(catalogs.monthCodes.map((item) => normalizeCode(item)));
  const employeeSet = new Set(catalogs.employeeCodes.map((item) => normalizeCode(item)));
  const carNameSet = new Set(catalogs.carNameCodes.map((item) => normalizeCode(item)));
  const carMotiveSet = new Set(catalogs.carMotiveCodes.map((item) => normalizeCode(item)));

  const monthCode = input.monthCode ? normalizeCode(input.monthCode) : "";
  if (requiresMonth) {
    if (!monthCode) {
      throw new Error("Debes seleccionar MES");
    }

    assertInSet(monthCode, monthSet, "MES inválido");
  }

  if (categoryCode === "SEGURIDAD_SOCIAL") {
    return {
      reason: `SS_${monthCode}_${year}`,
      reasonBase: null,
      monthCode,
      carNameCode: null,
      carMotiveCode: null,
      carReasonText: null
    };
  }

  if (categoryCode === "CESANTIAS") {
    const fixedYear = String(year);
    return {
      reason: fixedYear,
      reasonBase: fixedYear,
      monthCode: null,
      carNameCode: null,
      carMotiveCode: null,
      carReasonText: null
    };
  }

  if (reasonMode === "car") {
    const carNameCode = input.carNameCode ? normalizeCode(input.carNameCode) : "";
    const carMotiveCode = input.carMotiveCode ? normalizeCode(input.carMotiveCode) : "";
    const carReasonText = input.carReasonText ? normalizeReasonText(input.carReasonText) : "";

    if (!carNameCode) throw new Error("Debes seleccionar NOMBRE CARRO");
    if (!carMotiveCode) throw new Error("Debes seleccionar MOTIVO");
    if (!carReasonText) throw new Error("Debes registrar RAZÓN");

    assertInSet(carNameCode, carNameSet, "NOMBRE CARRO inválido");
    assertInSet(carMotiveCode, carMotiveSet, "MOTIVO inválido");

    const safeReason = carReasonText.replace(/\s+/g, "_");

    return {
      reason: `${carNameCode}_${carMotiveCode}_${safeReason}`,
      reasonBase: carReasonText,
      monthCode: null,
      carNameCode,
      carMotiveCode,
      carReasonText
    };
  }

  let reasonBase = input.reasonInput ? normalizeReasonText(input.reasonInput) : "";

  if (!reasonBase) {
    throw new Error("Debes registrar RAZÓN");
  }

  if (reasonMode === "select") {
    const validOptions = (EXPENSE_REASON_OPTIONS[categoryCode] ?? []).map((item) => normalizeCode(item));
    const validSet = new Set(validOptions);
    assertInSet(reasonBase, validSet, "RAZÓN inválida para la categoría seleccionada");
  }

  if (reasonMode === "employee") {
    assertInSet(reasonBase, employeeSet, "La RAZÓN debe ser un empleado válido");
  }

  const reason = requiresMonth ? `${reasonBase}_${monthCode}` : reasonBase;

  return {
    reason,
    reasonBase,
    monthCode: requiresMonth ? monthCode : null,
    carNameCode: null,
    carMotiveCode: null,
    carReasonText: null
  };
}

export function calculateExpenseRealAmount(amount: number, accountCode: string): number {
  const normalizedAccount = normalizeCode(accountCode);

  if (normalizedAccount === "EFECTY") {
    return roundToTwo(amount);
  }

  return roundToTwo(amount * 1.004);
}
