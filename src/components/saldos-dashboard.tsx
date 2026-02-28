"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ArrowDownToLine, Landmark, Scale, Wallet } from "lucide-react";
import { formatCop, formatCopInput } from "@/lib/money";
import { KpiCard } from "@/components/kpi-card";

type BalanceItem = {
  accountCode: string;
  accountLabel: string;
  openingBalance: number;
  incomeNet: number;
  transferIn: number;
  expenseReal: number;
  transferOut: number;
  transferFee: number;
  softwareBalance: number;
  actualBalance: number | null;
  difference: number | null;
};

type BalancesResponse = {
  items: BalanceItem[];
  totals: {
    openingBalance: number;
    incomeNet: number;
    transferIn: number;
    expenseReal: number;
    transferOut: number;
    transferFee: number;
    softwareBalance: number;
    actualBalance: number;
    difference: number;
    accountsWithActual: number;
  };
};

type MeResponse = {
  user?: {
    role?: "ADMIN" | "OPERATOR";
  } | null;
};

type ReconcileDraft = {
  actualBalanceInput: string;
  saving: boolean;
};

const compactCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

function formatChartAxis(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value === 0) return "$0";
  return `$${compactCurrencyFormatter.format(value)}`;
}

async function fetchWithTimeout(input: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function toCopInput(value: number | null): string {
  if (value === null) return "";
  return formatCopInput(String(value));
}

export function SaldosDashboard() {
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReconcileDraft>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetchWithTimeout("/api/saldos");
      const payload = (await response.json()) as BalancesResponse & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible cargar saldos");
      }

      setData(payload);
      setDrafts((previous) => {
        const next = { ...previous };
        payload.items.forEach((item) => {
          next[item.accountCode] = {
            actualBalanceInput: toCopInput(item.actualBalance),
            saving: false
          };
        });
        return next;
      });
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Tiempo de espera agotado al calcular saldos.");
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "No fue posible cargar saldos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const response = await fetchWithTimeout("/api/auth/me");
        if (!response.ok) return;

        const payload = (await response.json()) as MeResponse;
        setIsAdmin(payload.user?.role === "ADMIN");
      } catch {
        setIsAdmin(false);
      }
    };

    loadUserRole();
  }, []);

  const chartData = useMemo(() => {
    return (data?.items ?? []).map((item) => ({
      label: item.accountCode,
      softwareBalance: item.softwareBalance,
      actualBalance: item.actualBalance
    }));
  }, [data?.items]);

  const updateDraft = (accountCode: string, updater: (draft: ReconcileDraft) => ReconcileDraft) => {
    setDrafts((previous) => {
      const current = previous[accountCode];
      if (!current) return previous;

      return {
        ...previous,
        [accountCode]: updater(current)
      };
    });
  };

  const saveRow = async (accountCode: string) => {
    if (!isAdmin) return;

    const draft = drafts[accountCode];
    if (!draft) return;

    updateDraft(accountCode, (current) => ({ ...current, saving: true }));
    setError("");

    try {
      const response = await fetch("/api/saldos/control", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountCode,
          actualBalanceInput: draft.actualBalanceInput
        })
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible guardar conciliación");
      }

      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible guardar conciliación");
      updateDraft(accountCode, (current) => ({ ...current, saving: false }));
    }
  };

  const exportToXlsx = async () => {
    if (!data?.items.length) {
      setError("No hay datos de saldos para exportar.");
      return;
    }

    try {
      setExporting(true);
      setError("");

      const rows = data.items.map((item) => ({
        CUENTA: item.accountCode,
        "SALDO INICIAL": Number(item.openingBalance.toFixed(2)),
        "INGRESOS NETOS": Number(item.incomeNet.toFixed(2)),
        "ENTRADAS TRANSFERENCIAS": Number(item.transferIn.toFixed(2)),
        "EGRESOS REALES": Number(item.expenseReal.toFixed(2)),
        "SALIDAS TRANSFERENCIAS": Number(item.transferOut.toFixed(2)),
        "COSTOS TRANSFERENCIAS": Number(item.transferFee.toFixed(2)),
        "SALDO SOFTWARE": Number(item.softwareBalance.toFixed(2)),
        "SALDO REAL": item.actualBalance === null ? "" : Number(item.actualBalance.toFixed(2)),
        DIFERENCIA: item.difference === null ? "" : Number(item.difference.toFixed(2))
      }));

      rows.push({
        CUENTA: "TOTAL",
        "SALDO INICIAL": Number(data.totals.openingBalance.toFixed(2)),
        "INGRESOS NETOS": Number(data.totals.incomeNet.toFixed(2)),
        "ENTRADAS TRANSFERENCIAS": Number(data.totals.transferIn.toFixed(2)),
        "EGRESOS REALES": Number(data.totals.expenseReal.toFixed(2)),
        "SALIDAS TRANSFERENCIAS": Number(data.totals.transferOut.toFixed(2)),
        "COSTOS TRANSFERENCIAS": Number(data.totals.transferFee.toFixed(2)),
        "SALDO SOFTWARE": Number(data.totals.softwareBalance.toFixed(2)),
        "SALDO REAL": Number(data.totals.actualBalance.toFixed(2)),
        DIFERENCIA: Number(data.totals.difference.toFixed(2))
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 18 },
        { wch: 24 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Saldos");
      const fileStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(workbook, `saldos_por_cuenta_${fileStamp}.xlsx`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible exportar XLSX");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <article className="surface p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">Saldos por cuenta</h1>
            <p className="mt-1 text-sm text-muted">
              Cálculo acumulado histórico: saldo inicial + ingresos netos + entradas transferencias - egresos reales -
              salidas transferencias - costos de transferencia.
            </p>
            <p className="mt-1 text-xs text-muted">
              El costo de transferencia sí impacta este saldo; por ahora no se inserta automáticamente en la tabla de
              egresos.
            </p>
            <p className="mt-1 text-xs text-muted">El saldo inicial se define una sola vez por cuenta en Administración.</p>
          </div>

          <button className="btn btn-secondary" onClick={exportToXlsx} disabled={exporting || loading || !data?.items?.length}>
            <ArrowDownToLine size={16} />
            {exporting ? "Exportando..." : "Descargar XLSX"}
          </button>
        </header>
      </article>

      {error ? <article className="surface p-4 text-danger">{error}</article> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Saldo Inicial" value={formatCop(data?.totals.openingBalance ?? 0)} subtitle="Configurado por cuenta" icon={<Wallet size={18} />} />
        <KpiCard title="Saldo Software" value={formatCop(data?.totals.softwareBalance ?? 0)} subtitle="Cálculo interno acumulado" icon={<Landmark size={18} />} />
        <KpiCard
          title="Saldo Real Reportado"
          value={formatCop(data?.totals.actualBalance ?? 0)}
          subtitle={`Cuentas conciliadas: ${data?.totals.accountsWithActual ?? 0}`}
          icon={<Wallet size={18} />}
        />
        <KpiCard
          title="Diferencia"
          value={formatCop(data?.totals.difference ?? 0)}
          subtitle="Real - Software"
          icon={<Scale size={18} />}
        />
      </section>

      <article className="surface p-4 sm:p-5">
        <h2 className="font-display text-xl">Tabla de saldos y conciliación</h2>
        <div className="table-wrap mt-4">
          <table className="table table-fluid">
            <thead>
              <tr>
                <th>CUENTA</th>
                <th className="cell-nowrap">SALDO INICIAL</th>
                <th className="cell-nowrap">INGRESOS NETOS</th>
                <th className="cell-nowrap">ENTRADAS TRANSF.</th>
                <th className="cell-nowrap">EGRESOS REALES</th>
                <th className="cell-nowrap">SALIDAS TRANSF.</th>
                <th className="cell-nowrap">COSTOS TRANSF.</th>
                <th className="cell-nowrap">SALDO SOFTWARE</th>
                <th className="cell-nowrap">SALDO REAL</th>
                <th className="cell-nowrap">DIFERENCIA</th>
                {isAdmin ? <th className="cell-nowrap">ACCIÓN</th> : null}
              </tr>
            </thead>
            <tbody>
              {data?.items.length ? (
                data.items.map((item) => {
                  const draft = drafts[item.accountCode];
                  return (
                    <tr key={item.accountCode}>
                      <td className="cell-nowrap">{item.accountCode}</td>
                      <td className="cell-nowrap">{formatCop(item.openingBalance)}</td>
                      <td className="cell-nowrap">{formatCop(item.incomeNet)}</td>
                      <td className="cell-nowrap">{formatCop(item.transferIn)}</td>
                      <td className="cell-nowrap">{formatCop(item.expenseReal)}</td>
                      <td className="cell-nowrap">{formatCop(item.transferOut)}</td>
                      <td className="cell-nowrap">{formatCop(item.transferFee)}</td>
                      <td className={`cell-nowrap font-semibold ${item.softwareBalance < 0 ? "text-danger" : "text-success"}`}>
                        {formatCop(item.softwareBalance)}
                      </td>
                      <td className="cell-nowrap">
                        {isAdmin ? (
                          <input
                            className="input !min-w-[10rem] !px-2 !py-1"
                            value={draft?.actualBalanceInput ?? ""}
                            onChange={(event) =>
                              updateDraft(item.accountCode, (current) => ({
                                ...current,
                                actualBalanceInput: event.target.value
                              }))
                            }
                            onBlur={() =>
                              updateDraft(item.accountCode, (current) => ({
                                ...current,
                                actualBalanceInput: current.actualBalanceInput
                                  ? formatCopInput(current.actualBalanceInput)
                                  : ""
                              }))
                            }
                            placeholder="Opcional"
                          />
                        ) : item.actualBalance === null ? (
                          "-"
                        ) : (
                          formatCop(item.actualBalance)
                        )}
                      </td>
                      <td className={`cell-nowrap font-semibold ${(item.difference ?? 0) < 0 ? "text-danger" : "text-success"}`}>
                        {item.difference === null ? "-" : formatCop(item.difference)}
                      </td>
                      {isAdmin ? (
                        <td className="cell-nowrap">
                          <button
                            className="btn btn-secondary !px-3 !py-1"
                            onClick={() => saveRow(item.accountCode)}
                            disabled={!draft || draft.saving}
                          >
                            {draft?.saving ? "Guardando..." : "Guardar"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="text-center text-muted">
                    {loading ? "Calculando saldos..." : "No hay información para calcular saldos."}
                  </td>
                </tr>
              )}
            </tbody>

            {data?.items.length ? (
              <tfoot>
                <tr className="font-semibold">
                  <td>TOTAL</td>
                  <td>{formatCop(data.totals.openingBalance)}</td>
                  <td>{formatCop(data.totals.incomeNet)}</td>
                  <td>{formatCop(data.totals.transferIn)}</td>
                  <td>{formatCop(data.totals.expenseReal)}</td>
                  <td>{formatCop(data.totals.transferOut)}</td>
                  <td>{formatCop(data.totals.transferFee)}</td>
                  <td className={data.totals.softwareBalance < 0 ? "text-danger" : "text-success"}>
                    {formatCop(data.totals.softwareBalance)}
                  </td>
                  <td>{formatCop(data.totals.actualBalance)}</td>
                  <td className={data.totals.difference < 0 ? "text-danger" : "text-success"}>
                    {formatCop(data.totals.difference)}
                  </td>
                  {isAdmin ? <td>-</td> : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </article>

      <article className="surface p-4 sm:p-5">
        <h2 className="font-display text-xl">Gráfica: software vs real</h2>
        <div className="h-[360px] pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 24, left: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatChartAxis} tickLine={false} axisLine={false} width={86} />
              <Tooltip
                formatter={(value: number | string, name: string) => {
                  const numericValue = Number(value);
                  const label = name === "softwareBalance" ? "Saldo software" : "Saldo real";
                  return [formatCop(Number.isFinite(numericValue) ? numericValue : 0), label];
                }}
              />
              <Bar dataKey="softwareBalance" radius={[8, 8, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={`software-${entry.label}`} fill={entry.softwareBalance >= 0 ? "#14b8a6" : "#ef4444"} />
                ))}
              </Bar>
              <Bar dataKey="actualBalance" radius={[8, 8, 0, 0]} fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
