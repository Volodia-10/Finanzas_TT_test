import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres")
});

export const createIncomeSchema = z.object({
  requestId: z.string().min(8, "requestId inválido").max(120, "requestId inválido"),
  amountInput: z.string().min(1, "El monto es obligatorio"),
  accountCode: z.string().min(1, "Selecciona una cuenta"),
  detailCode: z.string().min(1, "Selecciona un detalle"),
  semesterCode: z.string().optional().default(""),
  includeLineUserNow: z.boolean().optional().default(false),
  lineCode: z.string().optional().default(""),
  userTag: z.string().optional().default(""),
  wompiMethodCode: z.string().optional().default("")
});

export const assignPendingIncomeSchema = z.object({
  lineCode: z.string().min(1, "Debes seleccionar línea"),
  userTag: z.string().min(1, "Debes registrar USER")
});

export const adminUpdateIncomeSchema = z.object({
  amountInput: z.string().min(1, "Cantidad inválida"),
  semesterCode: z.string().min(1, "Semestre inválido"),
  accountCode: z.string().min(1, "Cuenta inválida"),
  lineCode: z.string().min(1, "Línea inválida"),
  userTag: z.string().min(1, "USER inválido"),
  extra: z.string().max(120).optional().default("-")
});

export const createExpenseSchema = z.object({
  requestId: z.string().min(8, "requestId inválido").max(120, "requestId inválido"),
  amountInput: z.string().optional().default(""),
  accountCode: z.string().min(1, "Selecciona una cuenta"),
  methodCode: z.string().min(1, "Selecciona método"),
  semesterCode: z.string().min(1, "Selecciona semestre"),
  categoryCode: z.string().min(1, "Selecciona categoría"),
  reasonInput: z.string().optional().default(""),
  monthCode: z.string().optional().default(""),
  carNameCode: z.string().optional().default(""),
  carMotiveCode: z.string().optional().default(""),
  carReasonText: z.string().optional().default(""),
  authorizedBy: z.string().min(1, "Selecciona AUTORIZÓ"),
  responsible: z.string().min(1, "Selecciona RESPONSABLE"),
  isBulk: z.boolean().optional().default(false),
  bulkRows: z
    .array(
      z.object({
        employeeCode: z.string().min(1, "Empleado inválido"),
        amountInput: z.string().min(1, "Monto inválido")
      })
    )
    .max(300, "Máximo 300 filas por lote")
    .optional()
    .default([])
});

export const adminUpdateExpenseSchema = z.object({
  amountInput: z.string().min(1, "Cantidad inválida"),
  accountCode: z.string().min(1, "Cuenta inválida"),
  methodCode: z.string().min(1, "Método inválido"),
  semesterCode: z.string().min(1, "Semestre inválido"),
  categoryCode: z.string().min(1, "Categoría inválida"),
  reasonInput: z.string().optional().default(""),
  monthCode: z.string().optional().default(""),
  carNameCode: z.string().optional().default(""),
  carMotiveCode: z.string().optional().default(""),
  carReasonText: z.string().optional().default(""),
  authorizedBy: z.string().min(1, "AUTORIZÓ inválido"),
  responsible: z.string().min(1, "RESPONSABLE inválido")
});

export const incomeFilterSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  accountCode: z.string().optional().default(""),
  semesterCode: z.string().optional().default(""),
  lineCode: z.string().optional().default(""),
  userTag: z.string().optional().default(""),
  detailCode: z.string().optional().default(""),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20)
});

export const expenseFilterSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  accountCode: z.string().optional().default(""),
  semesterCode: z.string().optional().default(""),
  categoryCode: z.string().optional().default(""),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20)
});

export const createTransferSchema = z.object({
  requestId: z.string().min(8, "requestId inválido").max(120, "requestId inválido"),
  transferAtInput: z.string().min(1, "Debes registrar fecha"),
  originAccountCode: z.string().min(1, "Selecciona cuenta ORIGEN"),
  destinationAccountCode: z.string().min(1, "Selecciona cuenta DESTINO"),
  amountInput: z.string().min(1, "Monto obligatorio"),
  feeInput: z.string().optional().default(""),
  note: z.string().max(240).optional().default("")
});

export const adminUpdateTransferSchema = z.object({
  transferAtInput: z.string().min(1, "Debes registrar fecha"),
  originAccountCode: z.string().min(1, "Selecciona cuenta ORIGEN"),
  destinationAccountCode: z.string().min(1, "Selecciona cuenta DESTINO"),
  amountInput: z.string().min(1, "Monto obligatorio"),
  feeInput: z.string().optional().default(""),
  note: z.string().max(240).optional().default("")
});

export const transferFilterSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  originAccountCode: z.string().optional().default(""),
  destinationAccountCode: z.string().optional().default(""),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20)
});

export const openingBalancePatchSchema = z.object({
  accountCode: z.string().min(1, "Cuenta inválida"),
  openingBalanceInput: z.string().min(1, "Saldo inicial obligatorio"),
});

export const actualBalancePatchSchema = z.object({
  accountCode: z.string().min(1, "Cuenta inválida"),
  actualBalanceInput: z.string().optional().default("")
});

export const catalogPatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});

export const catalogCreateSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1)
});
