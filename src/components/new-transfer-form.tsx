"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Repeat } from "lucide-react";
import { formatCop, formatCopInput, parseCopInput } from "@/lib/money";
import { generateRequestId } from "@/lib/request-id";

type TransferCatalogResponse = {
  accounts: {
    code: string;
    label: string;
  }[];
};

type TransferFormState = {
  requestId: string;
  transferAtInput: string;
  originAccountCode: string;
  destinationAccountCode: string;
  amountInput: string;
  feeInput: string;
  note: string;
};

function toDateTimeLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const initialForm: TransferFormState = {
  requestId: generateRequestId(),
  transferAtInput: toDateTimeLocalString(new Date()),
  originAccountCode: "",
  destinationAccountCode: "",
  amountInput: "",
  feeInput: "",
  note: ""
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

function useTransferCatalogs() {
  const [catalogs, setCatalogs] = useState<TransferCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setLoading(true);
        const response = await fetchWithTimeout("/api/transfers/catalogs");
        const payload = (await response.json()) as TransferCatalogResponse & { message?: string };

        if (!response.ok) {
          setError(payload.message ?? "No fue posible cargar cuentas");
          return;
        }

        setCatalogs(payload);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setError("Tiempo de espera agotado al cargar cuentas. Revisa backend y base de datos.");
          return;
        }

        setError("No fue posible cargar cuentas");
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogs();
  }, []);

  return { catalogs, loading, error };
}

export function NewTransferForm() {
  const { catalogs, loading: catalogsLoading, error: catalogsError } = useTransferCatalogs();

  const [form, setForm] = useState<TransferFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const amount = useMemo(() => parseCopInput(form.amountInput) ?? 0, [form.amountInput]);
  const fee = useMemo(() => parseCopInput(form.feeInput) ?? 0, [form.feeInput]);
  const totalOut = useMemo(() => amount + fee, [amount, fee]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFeedback(null);

    try {
      setSubmitting(true);

      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setFeedback({ type: "error", message: payload.message ?? "No fue posible guardar transferencia" });
        return;
      }

      setFeedback({ type: "success", message: "Transferencia registrada" });
      setForm({
        ...initialForm,
        requestId: generateRequestId(),
        transferAtInput: toDateTimeLocalString(new Date())
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
    return <section className="surface p-5 text-danger">{catalogsError || "No hay datos de cuentas"}</section>;
  }

  return (
    <section>
      <article className="surface p-5 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl">Nueva transferencia interna</h1>
          <Repeat className="text-cyan-700" />
        </header>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label" htmlFor="transferAtInput">
                FECHA Y HORA
              </label>
              <input
                id="transferAtInput"
                type="datetime-local"
                className="input"
                value={form.transferAtInput}
                onChange={(event) => setForm((prev) => ({ ...prev, transferAtInput: event.target.value }))}
                required
              />
            </div>

            <div className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm">
              <p className="label !mb-2">Efecto contable</p>
              <p>Salida ORIGEN: {formatCop(totalOut)}</p>
              <p className="mt-1">Entrada DESTINO: {formatCop(amount)}</p>
              <p className="mt-1 text-xs text-muted">El costo/comisión afecta solo la cuenta ORIGEN.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="originAccountCode">
                ORIGEN
              </label>
              <select
                id="originAccountCode"
                className="select"
                value={form.originAccountCode}
                onChange={(event) => setForm((prev) => ({ ...prev, originAccountCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.accounts.map((item) => (
                  <option key={`origin-${item.code}`} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="destinationAccountCode">
                DESTINO
              </label>
              <select
                id="destinationAccountCode"
                className="select"
                value={form.destinationAccountCode}
                onChange={(event) => setForm((prev) => ({ ...prev, destinationAccountCode: event.target.value }))}
                required
              >
                <option value="">Seleccionar</option>
                {catalogs.accounts.map((item) => (
                  <option key={`destination-${item.code}`} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="amountInput">
                MONTO
              </label>
              <input
                id="amountInput"
                className="input"
                placeholder="$ 1.000.000,00"
                value={form.amountInput}
                onChange={(event) => setForm((prev) => ({ ...prev, amountInput: event.target.value }))}
                onBlur={() => setForm((prev) => ({ ...prev, amountInput: formatCopInput(prev.amountInput) }))}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="feeInput">
                COSTO/COMISIÓN (OPCIONAL)
              </label>
              <input
                id="feeInput"
                className="input"
                placeholder="$ 0,00"
                value={form.feeInput}
                onChange={(event) => setForm((prev) => ({ ...prev, feeInput: event.target.value }))}
                onBlur={() => setForm((prev) => ({ ...prev, feeInput: prev.feeInput ? formatCopInput(prev.feeInput) : "" }))}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="transferNote">
              NOTA
            </label>
            <textarea
              id="transferNote"
              className="textarea"
              rows={3}
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Opcional"
            />
          </div>

          {feedback ? (
            <p className={`text-sm font-semibold ${feedback.type === "success" ? "text-success" : "text-danger"}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar transferencia"}
              <CheckCircle2 size={16} />
            </button>
            <Link className="btn btn-secondary" href="/transferencias">
              Ir a historial <ArrowRight size={16} />
            </Link>
          </div>
        </form>
      </article>
    </section>
  );
}
