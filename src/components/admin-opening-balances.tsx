"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { formatCop, formatCopInput, parseCopInput } from "@/lib/money";

type OpeningBalanceItem = {
  accountCode: string;
  accountLabel: string;
  openingBalance: number;
  openingBalanceFormatted: string;
  openingBalanceSetAt: string | null;
  isConfigured: boolean;
};

type OpeningBalanceResponse = {
  items: OpeningBalanceItem[];
};

type OpeningDraft = {
  openingBalanceInput: string;
  saving: boolean;
};

export function AdminOpeningBalances() {
  const [items, setItems] = useState<OpeningBalanceItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OpeningDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/opening-balances", { cache: "no-store" });
      const payload = (await response.json()) as OpeningBalanceResponse & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible cargar saldos iniciales");
      }

      setItems(payload.items);
      setDrafts((previous) => {
        const next = { ...previous };
        payload.items.forEach((item) => {
          next[item.accountCode] = {
            openingBalanceInput: item.isConfigured ? item.openingBalanceFormatted : "",
            saving: false
          };
        });
        return next;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible cargar saldos iniciales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const configuredCount = useMemo(() => items.filter((item) => item.isConfigured).length, [items]);

  const updateDraft = (accountCode: string, updater: (draft: OpeningDraft) => OpeningDraft) => {
    setDrafts((previous) => {
      const current = previous[accountCode];
      if (!current) return previous;
      return {
        ...previous,
        [accountCode]: updater(current)
      };
    });
  };

  const saveOpeningBalance = async (item: OpeningBalanceItem) => {
    const draft = drafts[item.accountCode];
    if (!draft || item.isConfigured) return;

    const parsed = parseCopInput(draft.openingBalanceInput);
    if (parsed === null || parsed < 0) {
      setError("Ingresa un saldo inicial válido en formato COP.");
      return;
    }

    updateDraft(item.accountCode, (current) => ({ ...current, saving: true }));
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/admin/opening-balances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode: item.accountCode,
          openingBalanceInput: draft.openingBalanceInput
        })
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible guardar saldo inicial");
      }

      setFeedback(`Saldo inicial guardado para ${item.accountCode}.`);
      await fetchData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible guardar saldo inicial");
      updateDraft(item.accountCode, (current) => ({ ...current, saving: false }));
    }
  };

  return (
    <article className="surface p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-3">
        <Landmark className="text-emerald-600" />
        <div>
          <h2 className="font-display text-2xl">Saldos iniciales por cuenta</h2>
          <p className="text-sm text-muted">
            Definir una sola vez el saldo de arranque del software. Este valor se suma al cálculo de Saldos.
          </p>
        </div>
      </header>

      <div className="mb-4 text-sm text-muted">Cuentas configuradas: {configuredCount} / {items.length}</div>

      {loading ? <p className="text-sm text-muted">Cargando saldos iniciales...</p> : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {feedback ? <p className="text-sm font-semibold text-success">{feedback}</p> : null}

      <div className="table-wrap mt-4">
        <table className="table table-fluid">
          <thead>
            <tr>
              <th>CUENTA</th>
              <th className="cell-nowrap">SALDO INICIAL</th>
              <th className="cell-nowrap">VISTA COP</th>
              <th className="cell-nowrap">ESTADO</th>
              <th className="cell-nowrap">FECHA REGISTRO</th>
              <th className="cell-nowrap">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const draft = drafts[item.accountCode];
              const previewValue = parseCopInput(draft?.openingBalanceInput ?? "");
              const preview = previewValue === null ? "-" : formatCop(previewValue);

              return (
                <tr key={item.accountCode}>
                  <td className="cell-nowrap">{item.accountCode}</td>
                  <td className="cell-nowrap">
                    <input
                      className="input !min-w-[11rem] !px-2 !py-1"
                      value={draft?.openingBalanceInput ?? ""}
                      onChange={(event) =>
                        updateDraft(item.accountCode, (current) => ({
                          ...current,
                          openingBalanceInput: event.target.value
                        }))
                      }
                      onBlur={() =>
                        updateDraft(item.accountCode, (current) => ({
                          ...current,
                          openingBalanceInput: current.openingBalanceInput
                            ? formatCopInput(current.openingBalanceInput)
                            : ""
                        }))
                      }
                      placeholder="$ 2.000.000,00"
                      disabled={item.isConfigured}
                    />
                  </td>
                  <td className="cell-nowrap">{item.isConfigured ? item.openingBalanceFormatted : preview}</td>
                  <td className="cell-nowrap">{item.isConfigured ? "CONFIGURADO" : "PENDIENTE"}</td>
                  <td className="cell-nowrap">{item.openingBalanceSetAt ? formatDateTime(item.openingBalanceSetAt) : "-"}</td>
                  <td className="cell-nowrap">
                    <button
                      className="btn btn-secondary !px-3 !py-1"
                      onClick={() => saveOpeningBalance(item)}
                      disabled={item.isConfigured || !draft || draft.saving}
                    >
                      {item.isConfigured ? "Bloqueado" : draft?.saving ? "Guardando..." : "Guardar inicial"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
