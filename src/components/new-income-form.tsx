"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDollarSign } from "lucide-react";
import { INTEREST_DETAIL_CODE, INTEREST_FORCED_VALUES, WOMPI_DETAIL_CODE } from "@/lib/constants";
import { calculateWompiNet, shouldRequestWompiMethod, type WompiConfigRates } from "@/lib/income-rules";
import { formatCop, formatCopInput, parseCopInput } from "@/lib/money";
import { generateRequestId } from "@/lib/request-id";

type CatalogResponse = {
  accounts: { code: string; label: string }[];
  semesters: { code: string; label: string }[];
  lines: { code: string; label: string }[];
  wompiMethods: { code: string; label: string }[];
  detailsByAccount: Record<string, { code: string; label: string }[]>;
  wompiConfig: WompiConfigRates;
};

type FormState = {
  requestId: string;
  amountInput: string;
  semesterCode: string;
  accountCode: string;
  detailCode: string;
  includeLineUserNow: boolean;
  lineCode: string;
  userTag: string;
  wompiMethodCode: string;
};

const initialForm: FormState = {
  requestId: generateRequestId(),
  amountInput: "",
  semesterCode: "",
  accountCode: "",
  detailCode: "",
  includeLineUserNow: false,
  lineCode: "",
  userTag: "",
  wompiMethodCode: ""
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

function useCatalogs() {
  const [catalogs, setCatalogs] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setLoading(true);
        const response = await fetchWithTimeout("/api/catalogs/all");
        const payload = (await response.json()) as CatalogResponse & { message?: string };

        if (!response.ok) {
          setError(payload.message ?? "No fue posible cargar catálogos");
          return;
        }

        setCatalogs(payload);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setError("Tiempo de espera agotado al cargar catálogos. Revisa backend y base de datos.");
          return;
        }

        setError("No fue posible cargar catálogos");
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogs();
  }, []);

  return { catalogs, loading, error };
}

export function NewIncomeForm() {
  const { catalogs, loading: catalogsLoading, error: catalogsError } = useCatalogs();

  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const availableDetails = catalogs?.detailsByAccount[form.accountCode] ?? [];
  const isInterest = form.detailCode === INTEREST_DETAIL_CODE;
  const wompiVisible = shouldRequestWompiMethod(form.accountCode, form.detailCode);

  const amount = useMemo(() => parseCopInput(form.amountInput) ?? 0, [form.amountInput]);

  const wompiPreview = useMemo(() => {
    if (!wompiVisible || !form.wompiMethodCode || amount <= 0) return null;
    if (form.wompiMethodCode !== "PSE" && form.wompiMethodCode !== "TC") return null;
    return calculateWompiNet(amount, form.wompiMethodCode, catalogs?.wompiConfig);
  }, [amount, catalogs?.wompiConfig, form.wompiMethodCode, wompiVisible]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFeedback(null);

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        semesterCode: isInterest ? INTEREST_FORCED_VALUES.semesterCode : form.semesterCode,
        includeLineUserNow: isInterest ? false : form.includeLineUserNow
      };

      const response = await fetch("/api/incomes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setFeedback({ type: "error", message: result.message ?? "No fue posible guardar el ingreso" });
        return;
      }

      setFeedback({ type: "success", message: "Ingreso guardado correctamente" });
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
          <h1 className="font-display text-2xl">Registrar ingreso</h1>
          <CircleDollarSign className="text-orange-600" />
        </header>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label" htmlFor="amountInput">
                MONTO (COP)
              </label>
              <input
                id="amountInput"
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
                Monto bruto: <strong>{formatCop(amount)}</strong>
              </p>
              {wompiPreview ? (
                <div className="mt-2 space-y-1">
                  <p>Comisión base: {formatCop(wompiPreview.commissionBase)}</p>
                  <p>IVA comisión: {formatCop(wompiPreview.iva)}</p>
                  <p>Recargo TC: {formatCop(wompiPreview.tcExtraFee)}</p>
                  <p className="font-semibold text-success">Neto final: {formatCop(wompiPreview.net)}</p>
                </div>
              ) : (
                <p className="mt-2 text-muted">Selecciona WOMPI para visualizar comisión e impacto neto.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="semesterCode">
                SEMESTRE
              </label>
              <select
                id="semesterCode"
                className="select"
                value={isInterest ? INTEREST_FORCED_VALUES.semesterCode : form.semesterCode}
                onChange={(event) => setForm((prev) => ({ ...prev, semesterCode: event.target.value }))}
                disabled={isInterest}
                required={!isInterest}
              >
                <option value="">Seleccionar</option>
                {catalogs.semesters.map((semester) => (
                  <option key={semester.code} value={semester.code}>
                    {semester.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="accountCode">
                CUENTA
              </label>
              <select
                id="accountCode"
                className="select"
                value={form.accountCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    accountCode: event.target.value,
                    detailCode: "",
                    wompiMethodCode: ""
                  }))
                }
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.accounts.map((account) => (
                  <option key={account.code} value={account.code}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="detailCode">
                DETALLE DE CUENTA
              </label>
              <select
                id="detailCode"
                className="select"
                value={form.detailCode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    detailCode: event.target.value,
                    wompiMethodCode: ""
                  }))
                }
                disabled={!form.accountCode}
                required
              >
                <option value="">Seleccionar</option>
                {availableDetails.map((detail) => (
                  <option key={detail.code} value={detail.code}>
                    {detail.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isInterest ? (
            <p className="rounded-xl border border-line bg-orange-50 p-3 text-sm">
              Regla especial activa: SEMESTRE/LÍNEA/USER = <strong>GENERAL / GENERAL / INTERESES</strong>
            </p>
          ) : null}

          {wompiVisible ? (
            <div>
              <label className="label" htmlFor="wompiMethodCode">
                MÉTODO DE PAGO (WOMPI)
              </label>
              <select
                id="wompiMethodCode"
                className="select"
                value={form.wompiMethodCode}
                onChange={(event) => setForm((prev) => ({ ...prev, wompiMethodCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.wompiMethods
                  .filter((method) => method.code === "PSE" || method.code === "TC")
                  .map((method) => (
                    <option key={method.code} value={method.code}>
                      {method.label}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                Solo aparece para BANCOLOMBIA + detalle WOMPI ({WOMPI_DETAIL_CODE}).
              </p>
            </div>
          ) : null}

          <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm">
            <input
              type="checkbox"
              checked={form.includeLineUserNow}
              onChange={(event) => setForm((prev) => ({ ...prev, includeLineUserNow: event.target.checked }))}
              disabled={isInterest}
            />
            Ingresar LÍNEA y USUARIO ahora
          </label>

          {form.includeLineUserNow && !isInterest ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="lineCode">
                  LÍNEA
                </label>
                <select
                  id="lineCode"
                  className="select"
                  value={form.lineCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, lineCode: event.target.value }))}
                  required
                >
                  <option value="">Seleccionar</option>
                  {catalogs.lines.map((line) => (
                    <option key={line.code} value={line.code}>
                      {line.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="userTag">
                  USER
                </label>
                <input
                  id="userTag"
                  className="input"
                  value={form.userTag}
                  onChange={(event) => setForm((prev) => ({ ...prev, userTag: event.target.value.toUpperCase() }))}
                  placeholder="EJ: JUAN01"
                  required
                />
              </div>
            </div>
          ) : null}

          {!form.includeLineUserNow && !isInterest ? (
            <p className="text-xs text-muted">
              Si no marcas la casilla, el sistema guardará LÍNEA y USER como <strong>PENDIENTE</strong>.
            </p>
          ) : null}

          {feedback ? (
            <p className={`text-sm font-semibold ${feedback.type === "success" ? "text-success" : "text-danger"}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar ingreso"}
              <CheckCircle2 size={16} />
            </button>
            <Link className="btn btn-secondary" href="/ingresos">
              Ir a histórico <ArrowRight size={16} />
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
