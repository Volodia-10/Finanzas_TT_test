"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Wallet } from "lucide-react";
import {
  EXPENSE_REASON_OPTIONS,
  buildExpenseReason,
  calculateExpenseRealAmount,
  categoryAllowsBulk,
  categoryRequiresMonth,
  getCurrentSystemYear,
  getExpenseReasonMode
} from "@/lib/expense-rules";
import { formatCop, formatCopInput, parseCopInput } from "@/lib/money";
import { generateRequestId } from "@/lib/request-id";

type CatalogItem = { code: string; label: string };

type ExpenseCatalogResponse = {
  accounts: CatalogItem[];
  semesters: CatalogItem[];
  methods: CatalogItem[];
  categories: CatalogItem[];
  months: CatalogItem[];
  employees: CatalogItem[];
  authorizers: CatalogItem[];
  responsibles: CatalogItem[];
  carNames: CatalogItem[];
  carMotives: CatalogItem[];
};

type ExpenseFormState = {
  requestId: string;
  isBulk: boolean;
  bulkRows: Array<{
    employeeCode: string;
    amountInput: string;
  }>;
  amountInput: string;
  accountCode: string;
  methodCode: string;
  semesterCode: string;
  categoryCode: string;
  reasonInput: string;
  monthCode: string;
  carNameCode: string;
  carMotiveCode: string;
  carReasonText: string;
  authorizedBy: string;
  responsible: string;
};

const initialForm: ExpenseFormState = {
  requestId: generateRequestId(),
  isBulk: false,
  bulkRows: [],
  amountInput: "",
  accountCode: "",
  methodCode: "",
  semesterCode: "",
  categoryCode: "",
  reasonInput: "",
  monthCode: "",
  carNameCode: "",
  carMotiveCode: "",
  carReasonText: "",
  authorizedBy: "",
  responsible: ""
};

async function fetchWithTimeout(input: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function useExpenseCatalogs() {
  const [catalogs, setCatalogs] = useState<ExpenseCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setLoading(true);
        const response = await fetchWithTimeout("/api/expenses/catalogs");
        const payload = (await response.json()) as ExpenseCatalogResponse & { message?: string };

        if (!response.ok) {
          setError(payload.message ?? "No fue posible cargar catálogos de egresos");
          return;
        }

        setCatalogs(payload);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setError("Tiempo de espera agotado al cargar catálogos. Revisa backend y base de datos.");
          return;
        }

        setError("No fue posible cargar catálogos de egresos");
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogs();
  }, []);

  return { catalogs, loading, error };
}

export function NewExpenseForm() {
  const { catalogs, loading: catalogsLoading, error: catalogsError } = useExpenseCatalogs();

  const [form, setForm] = useState<ExpenseFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const amount = useMemo(() => parseCopInput(form.amountInput) ?? 0, [form.amountInput]);
  const reasonMode = useMemo(() => getExpenseReasonMode(form.categoryCode || ""), [form.categoryCode]);
  const requiresMonth = useMemo(() => categoryRequiresMonth(form.categoryCode || ""), [form.categoryCode]);
  const bulkEligible = useMemo(() => categoryAllowsBulk(form.categoryCode || ""), [form.categoryCode]);

  const reasonSelectOptions = useMemo(
    () => EXPENSE_REASON_OPTIONS[(form.categoryCode || "").trim().toUpperCase()] ?? [],
    [form.categoryCode]
  );

  const bulkReasonOptions = useMemo(() => {
    if (!catalogs) return [];

    if (reasonMode === "employee") {
      return catalogs.employees;
    }

    if (reasonMode === "select") {
      return reasonSelectOptions.map((item) => ({ code: item, label: item }));
    }

    return [];
  }, [catalogs, reasonMode, reasonSelectOptions]);

  const realAmount = useMemo(() => {
    if (!form.accountCode || amount <= 0) return 0;
    return calculateExpenseRealAmount(amount, form.accountCode);
  }, [amount, form.accountCode]);

  const bulkTotalAmount = useMemo(
    () =>
      form.bulkRows.reduce((accumulator, row) => {
        const parsedAmount = parseCopInput(row.amountInput);
        return accumulator + (parsedAmount ?? 0);
      }, 0),
    [form.bulkRows]
  );

  const bulkTotalRealAmount = useMemo(() => {
    if (!form.accountCode || bulkTotalAmount <= 0) return 0;
    return form.bulkRows.reduce((accumulator, row) => {
      const parsedAmount = parseCopInput(row.amountInput);
      if (!parsedAmount || parsedAmount <= 0) return accumulator;
      return accumulator + calculateExpenseRealAmount(parsedAmount, form.accountCode);
    }, 0);
  }, [bulkTotalAmount, form.accountCode, form.bulkRows]);

  const reasonPreview = useMemo(() => {
    if (!catalogs || !form.categoryCode || form.isBulk) return "";

    try {
      const preview = buildExpenseReason(
        {
          categoryCode: form.categoryCode,
          reasonInput: form.reasonInput,
          monthCode: form.monthCode,
          carNameCode: form.carNameCode,
          carMotiveCode: form.carMotiveCode,
          carReasonText: form.carReasonText,
          year: getCurrentSystemYear()
        },
        {
          monthCodes: catalogs.months.map((item) => item.code),
          employeeCodes: catalogs.employees.map((item) => item.code),
          carNameCodes: catalogs.carNames.map((item) => item.code),
          carMotiveCodes: catalogs.carMotives.map((item) => item.code)
        }
      );

      return preview.reason;
    } catch {
      return "";
    }
  }, [catalogs, form]);

  const addBulkRow = () => {
    setForm((prev) => ({
      ...prev,
      bulkRows: [...prev.bulkRows, { employeeCode: "", amountInput: "" }]
    }));
  };

  const removeBulkRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      bulkRows: prev.bulkRows.filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const updateBulkRow = (index: number, updater: (row: ExpenseFormState["bulkRows"][number]) => ExpenseFormState["bulkRows"][number]) => {
    setForm((prev) => ({
      ...prev,
      bulkRows: prev.bulkRows.map((row, rowIndex) => (rowIndex === index ? updater(row) : row))
    }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFeedback(null);

    if (form.isBulk) {
      if (!bulkEligible) {
        setFeedback({ type: "error", message: "La categoría seleccionada no permite egreso masivo" });
        return;
      }

      if (!form.bulkRows.length) {
        setFeedback({ type: "error", message: "Debes agregar al menos una fila para egreso masivo" });
        return;
      }

      const normalizedCodes = form.bulkRows.map((row) => row.employeeCode.trim().toUpperCase()).filter(Boolean);
      if (normalizedCodes.length !== form.bulkRows.length) {
        setFeedback({ type: "error", message: "Todas las filas deben tener EMPLEADO/RAZÓN" });
        return;
      }

      const uniqueCodes = new Set(normalizedCodes);
      if (uniqueCodes.size !== normalizedCodes.length) {
        setFeedback({ type: "error", message: "No se permiten empleados/razones repetidos en el lote" });
        return;
      }

      const allAmountsValid = form.bulkRows.every((row) => {
        const parsedAmount = parseCopInput(row.amountInput);
        return typeof parsedAmount === "number" && parsedAmount > 0;
      });

      if (!allAmountsValid) {
        setFeedback({ type: "error", message: "Todas las filas deben tener MONTO válido mayor a cero" });
        return;
      }
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setFeedback({ type: "error", message: payload.message ?? "No fue posible guardar el egreso" });
        return;
      }

      setFeedback({
        type: "success",
        message: payload.message ?? (form.isBulk ? "Egreso masivo guardado correctamente" : "Egreso guardado correctamente")
      });
      setForm({
        ...initialForm,
        requestId: generateRequestId()
      });
    } catch {
      setFeedback({ type: "error", message: "Error de red. Intenta de nuevo." });
    } finally {
      setSubmitting(false);
    }
  };

  if (catalogsLoading) {
    return <section className="surface p-5">Cargando formulario...</section>;
  }

  if (catalogsError || !catalogs) {
    return <section className="surface p-5 text-danger">{catalogsError || "No hay datos de catálogos"}</section>;
  }

  return (
    <section>
      <article className="surface p-5 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl">Registrar egreso</h1>
          <Wallet className="text-orange-600" />
        </header>

        <form className="space-y-4" onSubmit={onSubmit}>
          {form.isBulk ? (
            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm">
              <p className="label !mb-2">Vista de cálculo masivo</p>
              <p>
                Total cantidad: <strong>{formatCop(bulkTotalAmount)}</strong>
              </p>
              <p className="mt-1">
                Total cantidad real (4x1000): <strong className="text-success">{formatCop(bulkTotalRealAmount)}</strong>
              </p>
              <p className="mt-2 text-xs text-muted">
                Se creará una fila por cada registro del lote, no un solo egreso sumado.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="label" htmlFor="expenseAmountInput">
                  MONTO (COP)
                </label>
                <input
                  id="expenseAmountInput"
                  className="input"
                  placeholder="$ 1.000.000,50"
                  value={form.amountInput}
                  onChange={(event) => setForm((prev) => ({ ...prev, amountInput: event.target.value }))}
                  onBlur={() => setForm((prev) => ({ ...prev, amountInput: formatCopInput(prev.amountInput) }))}
                  required
                />
              </div>

              <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm">
                <p className="label !mb-2">Vista de cálculo</p>
                <p>
                  Cantidad: <strong>{formatCop(amount)}</strong>
                </p>
                <p className="mt-1">
                  Cantidad real (4x1000): <strong className="text-success">{formatCop(realAmount)}</strong>
                </p>
                <p className="mt-2 text-xs text-muted">
                  En EFECTY se conserva el mismo valor; en otras cuentas se aplica x 1.004.
                </p>
                {reasonPreview ? (
                  <p className="mt-2 text-xs text-muted">
                    RAZÓN final: <strong className="text-ink">{reasonPreview}</strong>
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="label" htmlFor="expenseAccountCode">
                CUENTA
              </label>
              <select
                id="expenseAccountCode"
                className="select"
                value={form.accountCode}
                onChange={(event) => setForm((prev) => ({ ...prev, accountCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.accounts.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="expenseMethodCode">
                MÉTODO
              </label>
              <select
                id="expenseMethodCode"
                className="select"
                value={form.methodCode}
                onChange={(event) => setForm((prev) => ({ ...prev, methodCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.methods.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="expenseSemesterCode">
                SEMESTRE
              </label>
              <select
                id="expenseSemesterCode"
                className="select"
                value={form.semesterCode}
                onChange={(event) => setForm((prev) => ({ ...prev, semesterCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.semesters.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-2">
              <label className="label" htmlFor="expenseCategoryCode">
                CATEGORÍA
              </label>
              <select
                id="expenseCategoryCode"
                className="select"
                value={form.categoryCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    categoryCode: event.target.value,
                    isBulk: false,
                    bulkRows: [],
                    reasonInput: "",
                    monthCode: "",
                    carNameCode: "",
                    carMotiveCode: "",
                    carReasonText: ""
                  }))
                }
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.categories.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {bulkEligible ? (
            <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm">
              <input
                type="checkbox"
                checked={form.isBulk}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isBulk: event.target.checked,
                    bulkRows: event.target.checked ? prev.bulkRows : []
                  }))
                }
              />
              Registrar egreso masivo (varias filas)
            </label>
          ) : null}

          {requiresMonth ? (
            <div className="max-w-sm">
              <label className="label" htmlFor="expenseMonthCode">
                MES
              </label>
              <select
                id="expenseMonthCode"
                className="select"
                value={form.monthCode}
                onChange={(event) => setForm((prev) => ({ ...prev, monthCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.months.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {form.isBulk ? (
            <article className="rounded-xl border border-line p-4">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="label !mb-1">Detalle masivo</p>
                  <p className="text-sm text-muted">Cada fila genera un egreso independiente. No se permiten empleados/razones repetidos.</p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={addBulkRow}>
                  Agregar fila
                </button>
              </header>

              <div className="table-wrap">
                <table className="table table-fluid">
                  <thead>
                    <tr>
                      <th className="cell-nowrap">#</th>
                      <th>EMPLEADO/RAZÓN</th>
                      <th className="cell-nowrap">MONTO (COP)</th>
                      <th className="cell-nowrap">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.bulkRows.length ? (
                      form.bulkRows.map((row, index) => (
                        <tr key={`bulk-row-${index}`}>
                          <td className="cell-nowrap">{index + 1}</td>
                          <td>
                            <select
                              className="select !min-w-[14rem] !px-2 !py-1"
                              value={row.employeeCode}
                              onChange={(event) =>
                                updateBulkRow(index, (current) => ({
                                  ...current,
                                  employeeCode: event.target.value
                                }))
                              }
                              required
                            >
                              <option value="">Seleccionar</option>
                              {bulkReasonOptions.map((item) => (
                                <option key={`bulk-employee-${item.code}`} value={item.code}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="cell-nowrap">
                            <input
                              className="input !min-w-[10rem] !px-2 !py-1"
                              placeholder="$ 0,00"
                              value={row.amountInput}
                              onChange={(event) =>
                                updateBulkRow(index, (current) => ({
                                  ...current,
                                  amountInput: event.target.value
                                }))
                              }
                              onBlur={() =>
                                updateBulkRow(index, (current) => ({
                                  ...current,
                                  amountInput: current.amountInput ? formatCopInput(current.amountInput) : ""
                                }))
                              }
                              required
                            />
                          </td>
                          <td className="cell-nowrap">
                            <button type="button" className="btn btn-danger !px-3 !py-1" onClick={() => removeBulkRow(index)}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">
                          Aún no hay filas en el lote.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          ) : (
            <>
              {reasonMode === "select" ? (
                <div className="max-w-xl">
                  <label className="label" htmlFor="expenseReasonSelect">
                    RAZÓN
                  </label>
                  <select
                    id="expenseReasonSelect"
                    className="select"
                    value={form.reasonInput}
                    onChange={(event) => setForm((prev) => ({ ...prev, reasonInput: event.target.value }))}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {reasonSelectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {reasonMode === "employee" ? (
                <div className="max-w-xl">
                  <label className="label" htmlFor="expenseReasonEmployee">
                    RAZÓN (EMPLEADO)
                  </label>
                  <select
                    id="expenseReasonEmployee"
                    className="select"
                    value={form.reasonInput}
                    onChange={(event) => setForm((prev) => ({ ...prev, reasonInput: event.target.value }))}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {catalogs.employees.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {reasonMode === "text" ? (
                <div className="max-w-2xl">
                  <label className="label" htmlFor="expenseReasonText">
                    RAZÓN
                  </label>
                  <input
                    id="expenseReasonText"
                    className="input"
                    value={form.reasonInput}
                    onChange={(event) => setForm((prev) => ({ ...prev, reasonInput: event.target.value.toUpperCase() }))}
                    placeholder="Escribe la razón del egreso"
                    required
                  />
                </div>
              ) : null}

              {reasonMode === "car" ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <label className="label" htmlFor="expenseCarNameCode">
                      NOMBRE CARRO
                    </label>
                    <select
                      id="expenseCarNameCode"
                      className="select"
                      value={form.carNameCode}
                      onChange={(event) => setForm((prev) => ({ ...prev, carNameCode: event.target.value }))}
                      required
                    >
                      <option value="">Seleccionar</option>
                      {catalogs.carNames.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="expenseCarMotiveCode">
                      MOTIVO
                    </label>
                    <select
                      id="expenseCarMotiveCode"
                      className="select"
                      value={form.carMotiveCode}
                      onChange={(event) => setForm((prev) => ({ ...prev, carMotiveCode: event.target.value }))}
                      required
                    >
                      <option value="">Seleccionar</option>
                      {catalogs.carMotives.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="expenseCarReasonText">
                      RAZÓN
                    </label>
                    <input
                      id="expenseCarReasonText"
                      className="input"
                      value={form.carReasonText}
                      onChange={(event) => setForm((prev) => ({ ...prev, carReasonText: event.target.value.toUpperCase() }))}
                      placeholder="Detalle"
                      required
                    />
                  </div>
                </div>
              ) : null}

              {reasonMode === "none" ? (
                <p className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-muted">
                  Esta categoría genera la RAZÓN automáticamente.
                </p>
              ) : null}
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="expenseAuthorizedBy">
                AUTORIZÓ
              </label>
              <select
                id="expenseAuthorizedBy"
                className="select"
                value={form.authorizedBy}
                onChange={(event) => setForm((prev) => ({ ...prev, authorizedBy: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.authorizers.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="expenseResponsible">
                RESPONSABLE
              </label>
              <select
                id="expenseResponsible"
                className="select"
                value={form.responsible}
                onChange={(event) => setForm((prev) => ({ ...prev, responsible: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.responsibles.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {feedback ? (
            <p className={`text-sm font-semibold ${feedback.type === "success" ? "text-success" : "text-danger"}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Guardando..." : form.isBulk ? "Guardar egreso masivo" : "Guardar egreso"}
              <CheckCircle2 size={16} />
            </button>
            <Link className="btn btn-secondary" href="/egresos">
              Ir a histórico <ArrowRight size={16} />
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
