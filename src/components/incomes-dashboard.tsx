"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Database, Download, Landmark, ReceiptText } from "lucide-react";
import { INTEREST_DETAIL_CODE, INTEREST_FORCED_VALUES, PENDING_VALUE } from "@/lib/constants";
import { formatDateTime } from "@/lib/date";
import { formatCop, formatCopInput } from "@/lib/money";
import { KpiCard } from "@/components/kpi-card";

type CatalogResponse = {
  accounts: { code: string; label: string }[];
  semesters: { code: string; label: string }[];
  lines: { code: string; label: string }[];
};

type IncomeItem = {
  id: string;
  createdAt: string;
  netAmount: number;
  semesterCode: string;
  accountCode: string;
  detailCode: string;
  lineCode: string;
  userTag: string;
  extra: string;
};

type IncomesResponse = {
  items: IncomeItem[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

type SummaryResponse = {
  totalNet: number;
  recordsCount: number;
  averageTicket: number;
  matrix: {
    accountCode: string;
    semesterCode: string;
    total: number;
  }[];
  charts: {
    byDate: { label: string; total: number }[];
    byAccount: { label: string; total: number }[];
  };
};

type Filters = {
  from: string;
  to: string;
  accountCode: string;
  semesterCode: string;
  lineCode: string;
};

type MeResponse = {
  user?: {
    role?: "ADMIN" | "OPERATOR";
  } | null;
};

type EditDraft = {
  amountInput: string;
  semesterCode: string;
  accountCode: string;
  lineCode: string;
  userTag: string;
  extra: string;
  saving: boolean;
};

const initialFilters: Filters = {
  from: "",
  to: "",
  accountCode: "",
  semesterCode: "",
  lineCode: ""
};

const compactCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

async function fetchWithTimeout(input: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildParams(filters: Filters, page: number, pageSize: number): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params;
}

function formatChartAxis(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value === 0) return "$0";
  return `$${compactCurrencyFormatter.format(value)}`;
}

export function IncomesDashboard() {
  const [catalogs, setCatalogs] = useState<CatalogResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<IncomesResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});

  const semesterOptions = useMemo(() => {
    const options = [...(catalogs?.semesters ?? [])];
    if (!options.some((item) => item.code === "GENERAL")) {
      options.push({ code: "GENERAL", label: "GENERAL" });
    }
    return options;
  }, [catalogs]);

  const lineOptions = useMemo(() => {
    const options = [...(catalogs?.lines ?? [])];
    if (!options.some((item) => item.code === "GENERAL")) {
      options.push({ code: "GENERAL", label: "GENERAL" });
    }
    return options;
  }, [catalogs]);

  const loadData = async (currentFilters: Filters, currentPage: number, currentPageSize: number) => {
    try {
      setLoading(true);
      setError("");

      const params = buildParams(currentFilters, currentPage, currentPageSize);
      const [rowsResponse, summaryResponse] = await Promise.all([
        fetchWithTimeout(`/api/incomes?${params.toString()}`),
        fetchWithTimeout(`/api/incomes/summary?${params.toString()}`)
      ]);

      const rowsPayload = (await rowsResponse.json()) as IncomesResponse & { message?: string };
      const summaryPayload = (await summaryResponse.json()) as SummaryResponse & { message?: string };

      if (!rowsResponse.ok) {
        throw new Error(rowsPayload.message ?? "No fue posible cargar ingresos");
      }

      if (!summaryResponse.ok) {
        throw new Error(summaryPayload.message ?? "No fue posible cargar resumen");
      }

      setRows(rowsPayload);
      setSummary(summaryPayload);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Tiempo de espera agotado al consultar ingresos. Revisa backend y base de datos.");
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [catalogsResponse, meResponse] = await Promise.all([
          fetchWithTimeout("/api/catalogs/all"),
          fetchWithTimeout("/api/auth/me")
        ]);

        const catalogsPayload = (await catalogsResponse.json()) as CatalogResponse & { message?: string };

        if (!catalogsResponse.ok) {
          throw new Error(catalogsPayload.message ?? "No fue posible cargar catálogos");
        }

        setCatalogs(catalogsPayload);

        if (meResponse.ok) {
          const mePayload = (await meResponse.json()) as MeResponse;
          setIsAdmin(mePayload.user?.role === "ADMIN");
        }
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") {
          setError("Tiempo de espera agotado al cargar datos iniciales.");
          return;
        }

        setError(requestError instanceof Error ? requestError.message : "No fue posible cargar datos iniciales");
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    loadData(appliedFilters, page, pageSize);
  }, [appliedFilters, page, pageSize]);

  const matrixAccounts = useMemo(() => {
    if (!summary) return [];
    return Array.from(new Set(summary.matrix.map((item) => item.accountCode))).sort();
  }, [summary]);

  const matrixSemesters = useMemo(() => {
    if (!summary) return [];
    return Array.from(new Set(summary.matrix.map((item) => item.semesterCode))).sort();
  }, [summary]);

  const matrixMap = useMemo(() => {
    if (!summary) return new Map<string, number>();
    return new Map(summary.matrix.map((item) => [`${item.accountCode}__${item.semesterCode}`, item.total]));
  }, [summary]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const startEditRow = (income: IncomeItem) => {
    const isInterest = income.detailCode === INTEREST_DETAIL_CODE;

    setEditingRows((previous) => ({
      ...previous,
      [income.id]: true
    }));

    setEditDrafts((previous) => ({
      ...previous,
      [income.id]: {
        amountInput: String(income.netAmount),
        accountCode: income.accountCode,
        semesterCode: isInterest
          ? INTEREST_FORCED_VALUES.semesterCode
          : income.semesterCode,
        lineCode: isInterest
          ? INTEREST_FORCED_VALUES.lineCode
          : income.lineCode === PENDING_VALUE
            ? ""
            : income.lineCode,
        userTag: isInterest
          ? INTEREST_FORCED_VALUES.userTag
          : income.userTag === PENDING_VALUE
            ? ""
            : income.userTag,
        extra: income.extra || "-",
        saving: false
      }
    }));
  };

  const cancelEditRow = (incomeId: string) => {
    setEditingRows((previous) => {
      const next = { ...previous };
      delete next[incomeId];
      return next;
    });

    setEditDrafts((previous) => {
      const next = { ...previous };
      delete next[incomeId];
      return next;
    });
  };

  const saveEditRow = async (income: IncomeItem) => {
    if (!isAdmin) return;

    const draft = editDrafts[income.id];
    if (!draft) return;

    const isInterest = income.detailCode === INTEREST_DETAIL_CODE;
    const accountCode = draft.accountCode.trim().toUpperCase();
    const amountInput = draft.amountInput.trim();
    const semesterCode = isInterest
      ? INTEREST_FORCED_VALUES.semesterCode
      : draft.semesterCode.trim().toUpperCase();

    const rawLine = draft.lineCode.trim().toUpperCase();
    const rawUser = draft.userTag.trim().toUpperCase();

    const lineCode = isInterest
      ? INTEREST_FORCED_VALUES.lineCode
      : !rawLine || !rawUser
        ? PENDING_VALUE
        : rawLine;

    const userTag = isInterest
      ? INTEREST_FORCED_VALUES.userTag
      : !rawLine || !rawUser
        ? PENDING_VALUE
        : rawUser;

    const extra = draft.extra.trim() || "-";

    if (!accountCode || !semesterCode || !amountInput) {
      setError("Cuenta, semestre y cantidad son obligatorios");
      return;
    }

    setEditDrafts((previous) => ({
      ...previous,
      [income.id]: {
        ...previous[income.id],
        saving: true
      }
    }));

    try {
      const response = await fetch(`/api/incomes/${income.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amountInput,
          accountCode,
          semesterCode,
          lineCode,
          userTag,
          extra
        })
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar el registro");
      }

      await loadData(appliedFilters, page, pageSize);
      cancelEditRow(income.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible actualizar el registro");
      setEditDrafts((previous) => ({
        ...previous,
        [income.id]: {
          ...previous[income.id],
          saving: false
        }
      }));
    }
  };

  const exportToXlsx = async () => {
    try {
      setExporting(true);
      setError("");

      const fetchPage = async (targetPage: number): Promise<IncomesResponse> => {
        const params = buildParams(appliedFilters, targetPage, 100);
        const response = await fetchWithTimeout(`/api/incomes?${params.toString()}`);
        const payload = (await response.json()) as IncomesResponse & { message?: string };

        if (!response.ok) {
          throw new Error(payload.message ?? "No fue posible descargar el histórico");
        }

        return payload;
      };

      const firstPage = await fetchPage(1);
      let allRows = [...firstPage.items];

      for (let currentPage = 2; currentPage <= firstPage.pages; currentPage += 1) {
        const pageResult = await fetchPage(currentPage);
        allRows = allRows.concat(pageResult.items);
      }

      if (!allRows.length) {
        setError("No hay datos para exportar con los filtros actuales");
        return;
      }

      const worksheetRows = allRows.map((item) => ({
        FECHA: formatDateTime(item.createdAt),
        CANTIDAD: Number(item.netAmount.toFixed(2)),
        SEMESTRE: item.semesterCode,
        BANCO: item.accountCode,
        LINEA: item.lineCode,
        USER: item.userTag,
        EXTRA: item.extra
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      worksheet["!cols"] = [
        { wch: 22 },
        { wch: 16 },
        { wch: 12 },
        { wch: 20 },
        { wch: 12 },
        { wch: 16 },
        { wch: 12 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Historico");
      const fileStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(workbook, `historico_ingresos_${fileStamp}.xlsx`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible exportar XLSX");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-5">
      <article className="surface p-4 sm:p-5">
        <header className="mb-4">
          <h1 className="font-display text-2xl">Histórico y resumen de ingresos</h1>
          <p className="mt-1 text-sm text-muted">Consulta rápida con filtros esenciales y exportación a XLSX.</p>
        </header>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="label">Desde</label>
            <input
              className="input"
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input
              className="input"
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Cuenta</label>
            <select
              className="select"
              value={filters.accountCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, accountCode: event.target.value }))}
            >
              <option value="">Todas</option>
              {catalogs?.accounts?.map((account) => (
                <option key={account.code} value={account.code}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Semestre</label>
            <select
              className="select"
              value={filters.semesterCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, semesterCode: event.target.value }))}
            >
              <option value="">Todos</option>
              {catalogs?.semesters?.map((semester) => (
                <option key={semester.code} value={semester.code}>
                  {semester.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Línea</label>
            <select
              className="select"
              value={filters.lineCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, lineCode: event.target.value }))}
            >
              <option value="">Todas</option>
              {catalogs?.lines?.map((line) => (
                <option key={line.code} value={line.code}>
                  {line.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={applyFilters}>
            Aplicar filtros
          </button>
          <button className="btn btn-secondary" onClick={clearFilters}>
            Limpiar
          </button>
          <button className="btn btn-secondary" onClick={exportToXlsx} disabled={exporting}>
            <Download size={16} />
            {exporting ? "Descargando..." : "Descargar XLSX"}
          </button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">Filas por página</span>
            <select
              className="select !w-24"
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </article>

      {error ? <article className="surface p-4 text-danger">{error}</article> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Total ingresos"
          value={formatCop(summary?.totalNet ?? 0)}
          subtitle="Valor neto acumulado"
          icon={<Landmark size={18} />}
        />
        <KpiCard
          title="Cantidad registros"
          value={String(summary?.recordsCount ?? 0)}
          subtitle="Registros según filtro"
          icon={<Database size={18} />}
        />
        <KpiCard
          title="Ticket promedio"
          value={formatCop(summary?.averageTicket ?? 0)}
          subtitle="Promedio por transacción"
          icon={<ReceiptText size={18} />}
        />
      </section>

      <article className="surface p-4 sm:p-5">
        <h2 className="font-display text-xl">Tabla histórica</h2>
        <p className="mt-1 text-sm text-muted">CANTIDAD corresponde al valor neto almacenado.</p>
        {isAdmin ? <p className="mt-1 text-xs text-muted">ADMIN puede corregir datos con &quot;Editar&quot;.</p> : null}

        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>FECHA</th>
                <th>CANTIDAD</th>
                <th>SEMESTRE</th>
                <th>BANCO</th>
                <th>LÍNEA</th>
                <th>USER</th>
                <th>EXTRA</th>
                {isAdmin ? <th>ACCIÓN</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows?.items.length ? (
                rows.items.map((item) => {
                  const isEditing = Boolean(editingRows[item.id]);
                  const isInterest = item.detailCode === INTEREST_DETAIL_CODE;
                  const draft = editDrafts[item.id];

                  return (
                    <tr key={item.id} className={item.lineCode === PENDING_VALUE || item.userTag === PENDING_VALUE ? "bg-amber-50/40" : ""}>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>
                        {isAdmin && isEditing ? (
                          <input
                            className="input !min-w-[9rem] !px-2 !py-1"
                            value={draft?.amountInput ?? ""}
                            onChange={(event) =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  amountInput: event.target.value
                                }
                              }))
                            }
                            onBlur={() =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  amountInput: formatCopInput(previous[item.id]?.amountInput ?? "")
                                }
                              }))
                            }
                            placeholder="$ 0,00"
                          />
                        ) : (
                          formatCop(item.netAmount)
                        )}
                      </td>

                      <td>
                        {isAdmin && isEditing && !isInterest ? (
                          <select
                            className="select !min-w-[7.5rem] !px-2 !py-1"
                            value={draft?.semesterCode ?? ""}
                            onChange={(event) =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  semesterCode: event.target.value
                                }
                              }))
                            }
                          >
                            <option value="">Seleccionar</option>
                            {semesterOptions.map((semester) => (
                              <option key={semester.code} value={semester.code}>
                                {semester.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.semesterCode
                        )}
                      </td>

                      <td>
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[9rem] !px-2 !py-1"
                            value={draft?.accountCode ?? ""}
                            onChange={(event) =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  accountCode: event.target.value
                                }
                              }))
                            }
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.accounts?.map((account) => (
                              <option key={account.code} value={account.code}>
                                {account.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.accountCode
                        )}
                      </td>

                      <td>
                        {isAdmin && isEditing && !isInterest ? (
                          <select
                            className="select !min-w-[7rem] !px-2 !py-1"
                            value={draft?.lineCode ?? ""}
                            onChange={(event) =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  lineCode: event.target.value
                                }
                              }))
                            }
                          >
                            <option value="">Sin definir</option>
                            {lineOptions.map((line) => (
                              <option key={line.code} value={line.code}>
                                {line.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.lineCode
                        )}
                      </td>

                      <td>
                        {isAdmin && isEditing && !isInterest ? (
                          <input
                            className="input !min-w-[9rem] !px-2 !py-1"
                            value={draft?.userTag ?? ""}
                            onChange={(event) =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  userTag: event.target.value.toUpperCase()
                                }
                              }))
                            }
                            placeholder="USER"
                          />
                        ) : (
                          item.userTag
                        )}
                      </td>

                      <td>
                        {isAdmin && isEditing ? (
                          <input
                            className="input !min-w-[8rem] !px-2 !py-1"
                            value={draft?.extra ?? ""}
                            onChange={(event) =>
                              setEditDrafts((previous) => ({
                                ...previous,
                                [item.id]: {
                                  ...(previous[item.id] as EditDraft),
                                  extra: event.target.value
                                }
                              }))
                            }
                            placeholder="-"
                          />
                        ) : (
                          item.extra
                        )}
                      </td>

                      {isAdmin ? (
                        <td>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                className="btn btn-secondary !px-3 !py-1"
                                onClick={() => saveEditRow(item)}
                                disabled={draft?.saving}
                              >
                                {draft?.saving ? "Guardando..." : "Guardar"}
                              </button>
                              <button
                                className="btn btn-secondary !px-3 !py-1"
                                onClick={() => cancelEditRow(item.id)}
                                disabled={draft?.saving}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button className="btn btn-secondary !px-3 !py-1" onClick={() => startEditRow(item)}>
                              Editar
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center text-muted">
                    {loading ? "Cargando registros..." : "No hay ingresos para los filtros seleccionados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <button className="btn btn-secondary" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
            Anterior
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((prev) => Math.min(rows?.pages ?? prev, prev + 1))}
            disabled={!rows || page >= rows.pages}
          >
            Siguiente
          </button>
          <span className="text-muted">
            Página {rows?.page ?? 1} de {rows?.pages ?? 1} • Total: {rows?.total ?? 0}
          </span>
        </footer>
      </article>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="surface p-4 sm:p-5">
          <h2 className="font-display text-xl">Matriz cuenta vs semestre</h2>
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  {matrixSemesters.map((semester) => (
                    <th key={semester}>{semester}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixAccounts.map((account) => (
                  <tr key={account}>
                    <td>{account}</td>
                    {matrixSemesters.map((semester) => {
                      const key = `${account}__${semester}`;
                      return <td key={key}>{formatCop(matrixMap.get(key) ?? 0)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface p-4 sm:p-5">
          <h2 className="font-display text-xl">Gráfica por cuenta</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.charts.byAccount ?? []} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 12 }} />
                <YAxis
                  width={95}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickFormatter={formatChartAxis}
                  domain={[0, (dataMax: number) => Math.max(1000, Math.ceil(dataMax * 1.15))]}
                />
                <Tooltip formatter={(value: number | string) => formatCop(Number(value))} />
                <Bar dataKey="total" fill="#0d9488" radius={[10, 10, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <article className="surface p-4 sm:p-5">
        <h2 className="font-display text-xl">Gráfica por fecha</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary?.charts.byDate ?? []} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 12 }} />
              <YAxis
                width={95}
                tick={{ fill: "#475569", fontSize: 12 }}
                tickFormatter={formatChartAxis}
                domain={[0, (dataMax: number) => Math.max(1000, Math.ceil(dataMax * 1.15))]}
              />
              <Tooltip formatter={(value: number | string) => formatCop(Number(value))} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#ea580c"
                fill="url(#incomeArea)"
                strokeWidth={3}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
