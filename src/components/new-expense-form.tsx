"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Wallet } from "lucide-react";
import {
  EXPENSE_REASON_OPTIONS,
  buildExpenseReason,
  calculateExpenseRealAmount,
  categoryRequiresMonth,
  getCurrentSystemYear,
  getExpenseReasonMode
} from "@/lib/expense-rules";
import { formatCop, formatCopInput, parseCopInput } from "@/lib/money";

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

  const reasonSelectOptions = useMemo(
    () => EXPENSE_REASON_OPTIONS[(form.categoryCode || "").trim().toUpperCase()] ?? [],
    [form.categoryCode]
  );

  const realAmount = useMemo(() => {
    if (!form.accountCode || amount <= 0) return 0;
    return calculateExpenseRealAmount(amount, form.accountCode);
  }, [amount, form.accountCode]);

  const reasonPreview = useMemo(() => {
    if (!catalogs || !form.categoryCode) return "";

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

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

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

      setFeedback({ type: "success", message: "Egreso guardado correctamente" });
      setForm(initialForm);
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
              {submitting ? "Guardando..." : "Guardar egreso"}
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
