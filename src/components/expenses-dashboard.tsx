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
import { Database, Download, HandCoins, Landmark, ReceiptText } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import {
  EXPENSE_REASON_OPTIONS,
  categoryRequiresMonth,
  getExpenseReasonMode
} from "@/lib/expense-rules";
import { formatCop, formatCopInput } from "@/lib/money";
import { KpiCard } from "@/components/kpi-card";

type CatalogItem = {
  code: string;
  label: string;
};

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

type ExpenseItem = {
  id: string;
  createdAt: string;
  amount: number;
  realAmount: number;
  accountCode: string;
  methodCode: string;
  semesterCode: string;
  categoryCode: string;
  reason: string;
  reasonBase: string | null;
  monthCode: string | null;
  carNameCode: string | null;
  carMotiveCode: string | null;
  carReasonText: string | null;
  authorizedBy: string;
  responsible: string;
};

type ExpensesResponse = {
  items: ExpenseItem[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

type ExpenseSummaryResponse = {
  totalAmount: number;
  totalRealAmount: number;
  recordsCount: number;
  averageRealAmount: number;
  byCategory: {
    categoryCode: string;
    totalAmount: number;
    totalRealAmount: number;
  }[];
  matrix: {
    accountCode: string;
    semesterCode: string;
    totalAmount: number;
    totalRealAmount: number;
  }[];
  charts: {
    byDate: { label: string; total: number }[];
    byAccount: { label: string; total: number }[];
    byCategory: { label: string; total: number }[];
  };
};

type Filters = {
  from: string;
  to: string;
  accountCode: string;
  semesterCode: string;
  categoryCode: string;
};

type MeResponse = {
  user?: {
    role?: "ADMIN" | "OPERATOR";
  } | null;
};

type EditDraft = {
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
  saving: boolean;
};

const initialFilters: Filters = {
  from: "",
  to: "",
  accountCode: "",
  semesterCode: "",
  categoryCode: ""
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

function buildParams(filters: Filters, page: number, pageSize: number): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function ExpensesDashboard() {
  const [catalogs, setCatalogs] = useState<ExpenseCatalogResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ExpensesResponse | null>(null);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});

  const loadData = async (currentFilters: Filters, currentPage: number, currentPageSize: number) => {
    try {
      setLoading(true);
      setError("");

      const params = buildParams(currentFilters, currentPage, currentPageSize);

      const [rowsResponse, summaryResponse] = await Promise.all([
        fetchWithTimeout(`/api/expenses?${params.toString()}`),
        fetchWithTimeout(`/api/expenses/summary?${params.toString()}`)
      ]);

      const rowsPayload = (await rowsResponse.json()) as ExpensesResponse & { message?: string };
      const summaryPayload = (await summaryResponse.json()) as ExpenseSummaryResponse & { message?: string };

      if (!rowsResponse.ok) {
        throw new Error(rowsPayload.message ?? "No fue posible cargar egresos");
      }

      if (!summaryResponse.ok) {
        throw new Error(summaryPayload.message ?? "No fue posible cargar resumen de egresos");
      }

      setRows(rowsPayload);
      setSummary(summaryPayload);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Tiempo de espera agotado al consultar egresos. Revisa backend y base de datos.");
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
          fetchWithTimeout("/api/expenses/catalogs"),
          fetchWithTimeout("/api/auth/me")
        ]);

        const catalogsPayload = (await catalogsResponse.json()) as ExpenseCatalogResponse & { message?: string };

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
    if (!summary) return new Map<string, { totalAmount: number; totalRealAmount: number }>();
    return new Map(summary.matrix.map((item) => [`${item.accountCode}__${item.semesterCode}`, item]));
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

  const startEditRow = (item: ExpenseItem) => {
    setEditingRows((previous) => ({
      ...previous,
      [item.id]: true
    }));

    setEditDrafts((previous) => ({
      ...previous,
      [item.id]: {
        amountInput: String(item.amount),
        accountCode: item.accountCode,
        methodCode: item.methodCode,
        semesterCode: item.semesterCode,
        categoryCode: item.categoryCode,
        reasonInput: item.reasonBase ?? "",
        monthCode: item.monthCode ?? "",
        carNameCode: item.carNameCode ?? "",
        carMotiveCode: item.carMotiveCode ?? "",
        carReasonText: item.carReasonText ?? "",
        authorizedBy: item.authorizedBy,
        responsible: item.responsible,
        saving: false
      }
    }));
  };

  const cancelEditRow = (id: string) => {
    setEditingRows((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    setEditDrafts((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const updateDraft = (id: string, updater: (draft: EditDraft) => EditDraft) => {
    setEditDrafts((previous) => {
      const current = previous[id];
      if (!current) return previous;

      return {
        ...previous,
        [id]: updater(current)
      };
    });
  };

  const saveEditRow = async (item: ExpenseItem) => {
    if (!isAdmin) return;

    const draft = editDrafts[item.id];
    if (!draft) return;

    const payload = {
      amountInput: draft.amountInput.trim(),
      accountCode: normalizeCode(draft.accountCode),
      methodCode: normalizeCode(draft.methodCode),
      semesterCode: normalizeCode(draft.semesterCode),
      categoryCode: normalizeCode(draft.categoryCode),
      reasonInput: draft.reasonInput.trim().toUpperCase(),
      monthCode: normalizeCode(draft.monthCode),
      carNameCode: normalizeCode(draft.carNameCode),
      carMotiveCode: normalizeCode(draft.carMotiveCode),
      carReasonText: draft.carReasonText.trim().toUpperCase(),
      authorizedBy: normalizeCode(draft.authorizedBy),
      responsible: normalizeCode(draft.responsible)
    };

    if (!payload.amountInput || !payload.accountCode || !payload.methodCode || !payload.semesterCode || !payload.categoryCode) {
      setError("Monto, cuenta, método, semestre y categoría son obligatorios");
      return;
    }

    updateDraft(item.id, (current) => ({ ...current, saving: true }));

    try {
      const response = await fetch(`/api/expenses/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "No fue posible actualizar el egreso");
      }

      await loadData(appliedFilters, page, pageSize);
      cancelEditRow(item.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible actualizar el egreso");
      updateDraft(item.id, (current) => ({ ...current, saving: false }));
    }
  };

  const exportToXlsx = async () => {
    try {
      setExporting(true);
      setError("");

      const fetchPage = async (targetPage: number): Promise<ExpensesResponse> => {
        const params = buildParams(appliedFilters, targetPage, 100);
        const response = await fetchWithTimeout(`/api/expenses?${params.toString()}`);
        const payload = (await response.json()) as ExpensesResponse & { message?: string };

        if (!response.ok) {
          throw new Error(payload.message ?? "No fue posible descargar histórico");
        }

        return payload;
      };

      const firstPage = await fetchPage(1);
      let allRows = [...firstPage.items];

      for (let currentPage = 2; currentPage <= firstPage.pages; currentPage += 1) {
        const pageData = await fetchPage(currentPage);
        allRows = allRows.concat(pageData.items);
      }

      if (!allRows.length) {
        setError("No hay datos para exportar con los filtros actuales");
        return;
      }

      const worksheetRows = allRows.map((item) => ({
        FECHA: formatDateTime(item.createdAt),
        CUENTA: item.accountCode,
        MÉTODO: item.methodCode,
        CANTIDAD: Number(item.amount.toFixed(2)),
        "CANTIDAD REAL": Number(item.realAmount.toFixed(2)),
        SEMESTRE: item.semesterCode,
        CATEGORÍA: item.categoryCode,
        RAZÓN: item.reason,
        AUTORIZÓ: item.authorizedBy,
        RESPONSABLE: item.responsible
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      worksheet["!cols"] = [
        { wch: 22 },
        { wch: 18 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 18 },
        { wch: 38 },
        { wch: 12 },
        { wch: 14 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "HistoricoEgresos");
      const fileStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(workbook, `historico_egresos_${fileStamp}.xlsx`);
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
          <h1 className="font-display text-2xl">Histórico y resumen de egresos</h1>
          <p className="mt-1 text-sm text-muted">Filtros por fecha, cuenta, semestre y categoría con exportación XLSX.</p>
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
              {catalogs?.accounts.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
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
              {catalogs?.semesters.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Categoría</label>
            <select
              className="select"
              value={filters.categoryCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, categoryCode: event.target.value }))}
            >
              <option value="">Todas</option>
              {catalogs?.categories.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
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

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Total egresos (real)"
          value={formatCop(summary?.totalRealAmount ?? 0)}
          subtitle="Acumulado con 4x1000"
          icon={<Landmark size={18} />}
        />
        <KpiCard
          title="Total egresos (cantidad)"
          value={formatCop(summary?.totalAmount ?? 0)}
          subtitle="Monto original"
          icon={<HandCoins size={18} />}
        />
        <KpiCard
          title="Cantidad registros"
          value={String(summary?.recordsCount ?? 0)}
          subtitle="Registros según filtro"
          icon={<Database size={18} />}
        />
        <KpiCard
          title="Ticket promedio (real)"
          value={formatCop(summary?.averageRealAmount ?? 0)}
          subtitle="Promedio por egreso"
          icon={<ReceiptText size={18} />}
        />
      </section>

      <article className="surface p-4 sm:p-5">
        <h2 className="font-display text-xl">Tabla histórica</h2>
        {isAdmin ? <p className="mt-1 text-xs text-muted">ADMIN puede corregir datos con &quot;Editar&quot;.</p> : null}

        <div className="table-wrap mt-4">
          <table className="table table-fluid">
            <thead>
              <tr>
                <th className="cell-nowrap">FECHA</th>
                <th>CUENTA</th>
                <th className="cell-nowrap">MÉTODO</th>
                <th className="cell-nowrap">CANTIDAD</th>
                <th className="cell-nowrap">CANTIDAD REAL</th>
                <th className="cell-nowrap">SEMESTRE</th>
                <th>CATEGORÍA</th>
                <th>RAZÓN</th>
                <th className="cell-nowrap">AUTORIZÓ</th>
                <th className="cell-nowrap">RESPONSABLE</th>
                {isAdmin ? <th className="cell-nowrap">ACCIÓN</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows?.items.length ? (
                rows.items.map((item) => {
                  const isEditing = Boolean(editingRows[item.id]);
                  const draft = editDrafts[item.id];
                  const draftCategory = draft?.categoryCode ?? item.categoryCode;
                  const draftReasonMode = getExpenseReasonMode(draftCategory);
                  const draftRequiresMonth = categoryRequiresMonth(draftCategory);
                  const reasonOptions = EXPENSE_REASON_OPTIONS[draftCategory.trim().toUpperCase()] ?? [];

                  return (
                    <tr key={item.id}>
                      <td className="cell-nowrap">{formatDateTime(item.createdAt)}</td>
                      <td>
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[8rem] !px-2 !py-1"
                            value={draft?.accountCode ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, accountCode: event.target.value }))}
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.accounts.map((account) => (
                              <option key={account.code} value={account.code}>
                                {account.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.accountCode
                        )}
                      </td>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[7rem] !px-2 !py-1"
                            value={draft?.methodCode ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, methodCode: event.target.value }))}
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.methods.map((method) => (
                              <option key={method.code} value={method.code}>
                                {method.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.methodCode
                        )}
                      </td>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <input
                            className="input !min-w-[8rem] !px-2 !py-1"
                            value={draft?.amountInput ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, amountInput: event.target.value }))}
                            onBlur={() => {
                              updateDraft(item.id, (current) => ({
                                ...current,
                                amountInput: formatCopInput(current.amountInput)
                              }));
                            }}
                          />
                        ) : (
                          formatCop(item.amount)
                        )}
                      </td>
                      <td className="cell-nowrap">{formatCop(item.realAmount)}</td>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[6.5rem] !px-2 !py-1"
                            value={draft?.semesterCode ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, semesterCode: event.target.value }))}
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.semesters.map((semester) => (
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
                            className="select !min-w-[10rem] !px-2 !py-1"
                            value={draft?.categoryCode ?? ""}
                            onChange={(event) =>
                              updateDraft(item.id, (current) => ({
                                ...current,
                                categoryCode: event.target.value,
                                reasonInput: "",
                                monthCode: "",
                                carNameCode: "",
                                carMotiveCode: "",
                                carReasonText: ""
                              }))
                            }
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.categories.map((category) => (
                              <option key={category.code} value={category.code}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.categoryCode
                        )}
                      </td>
                      <td className="cell-reason">
                        {isAdmin && isEditing ? (
                          <div className="min-w-[14rem] space-y-1">
                            {draftRequiresMonth ? (
                              <select
                                className="select !px-2 !py-1"
                                value={draft?.monthCode ?? ""}
                                onChange={(event) => updateDraft(item.id, (current) => ({ ...current, monthCode: event.target.value }))}
                              >
                                <option value="">MES</option>
                                {catalogs?.months.map((month) => (
                                  <option key={month.code} value={month.code}>
                                    {month.label}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {draftReasonMode === "select" ? (
                              <select
                                className="select !px-2 !py-1"
                                value={draft?.reasonInput ?? ""}
                                onChange={(event) => updateDraft(item.id, (current) => ({ ...current, reasonInput: event.target.value }))}
                              >
                                <option value="">RAZÓN</option>
                                {reasonOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {draftReasonMode === "employee" ? (
                              <select
                                className="select !px-2 !py-1"
                                value={draft?.reasonInput ?? ""}
                                onChange={(event) => updateDraft(item.id, (current) => ({ ...current, reasonInput: event.target.value }))}
                              >
                                <option value="">EMPLEADO</option>
                                {catalogs?.employees.map((employee) => (
                                  <option key={employee.code} value={employee.code}>
                                    {employee.label}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {draftReasonMode === "text" ? (
                              <input
                                className="input !px-2 !py-1"
                                value={draft?.reasonInput ?? ""}
                                onChange={(event) =>
                                  updateDraft(item.id, (current) => ({
                                    ...current,
                                    reasonInput: event.target.value.toUpperCase()
                                  }))
                                }
                                placeholder="RAZÓN"
                              />
                            ) : null}

                            {draftReasonMode === "car" ? (
                              <div className="space-y-1">
                                <select
                                  className="select !px-2 !py-1"
                                  value={draft?.carNameCode ?? ""}
                                  onChange={(event) =>
                                    updateDraft(item.id, (current) => ({ ...current, carNameCode: event.target.value }))
                                  }
                                >
                                  <option value="">NOMBRE CARRO</option>
                                  {catalogs?.carNames.map((car) => (
                                    <option key={car.code} value={car.code}>
                                      {car.label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="select !px-2 !py-1"
                                  value={draft?.carMotiveCode ?? ""}
                                  onChange={(event) =>
                                    updateDraft(item.id, (current) => ({ ...current, carMotiveCode: event.target.value }))
                                  }
                                >
                                  <option value="">MOTIVO</option>
                                  {catalogs?.carMotives.map((motive) => (
                                    <option key={motive.code} value={motive.code}>
                                      {motive.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="input !px-2 !py-1"
                                  value={draft?.carReasonText ?? ""}
                                  onChange={(event) =>
                                    updateDraft(item.id, (current) => ({
                                      ...current,
                                      carReasonText: event.target.value.toUpperCase()
                                    }))
                                  }
                                  placeholder="RAZÓN"
                                />
                              </div>
                            ) : null}

                            {draftReasonMode === "none" ? (
                              <p className="text-xs text-muted">RAZÓN automática</p>
                            ) : null}
                          </div>
                        ) : (
                          item.reason
                        )}
                      </td>
                      <td>
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[7rem] !px-2 !py-1"
                            value={draft?.authorizedBy ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, authorizedBy: event.target.value }))}
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.authorizers.map((authorizer) => (
                              <option key={authorizer.code} value={authorizer.code}>
                                {authorizer.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.authorizedBy
                        )}
                      </td>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[7rem] !px-2 !py-1"
                            value={draft?.responsible ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, responsible: event.target.value }))}
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.responsibles.map((responsible) => (
                              <option key={responsible.code} value={responsible.code}>
                                {responsible.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.responsible
                        )}
                      </td>

                      {isAdmin ? (
                        <td className="cell-nowrap">
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
                  <td colSpan={isAdmin ? 11 : 10} className="text-center text-muted">
                    {loading ? "Cargando registros..." : "No hay egresos para los filtros seleccionados."}
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

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="surface p-4 sm:p-5">
          <h2 className="font-display text-xl">Totales por categoría</h2>
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Cantidad</th>
                  <th>Cantidad real</th>
                </tr>
              </thead>
              <tbody>
                {summary?.byCategory.length ? (
                  summary.byCategory.map((item) => (
                    <tr key={item.categoryCode}>
                      <td>{item.categoryCode}</td>
                      <td>{formatCop(item.totalAmount)}</td>
                      <td>{formatCop(item.totalRealAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">
                      Sin datos para categorías.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface p-4 sm:p-5">
          <h2 className="font-display text-xl">Matriz cuenta vs semestre</h2>
          <p className="mt-1 text-xs text-muted">Valores mostrados por CANTIDAD REAL.</p>
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
                      return <td key={key}>{formatCop(matrixMap.get(key)?.totalRealAmount ?? 0)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <article className="surface p-4 sm:p-5">
          <h2 className="font-display text-xl">Gráfica por categoría</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.charts.byCategory ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 12 }} />
                <YAxis
                  width={95}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickFormatter={formatChartAxis}
                  domain={[0, (dataMax: number) => Math.max(1000, Math.ceil(dataMax * 1.15))]}
                />
                <Tooltip formatter={(value: number | string) => formatCop(Number(value))} />
                <Bar dataKey="total" fill="#f97316" radius={[8, 8, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="surface p-4 sm:p-5">
          <h2 className="font-display text-xl">Gráfica por cuenta</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.charts.byAccount ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 12 }} />
                <YAxis
                  width={95}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickFormatter={formatChartAxis}
                  domain={[0, (dataMax: number) => Math.max(1000, Math.ceil(dataMax * 1.15))]}
                />
                <Tooltip formatter={(value: number | string) => formatCop(Number(value))} />
                <Bar dataKey="total" fill="#0d9488" radius={[8, 8, 0, 0]} maxBarSize={56} />
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
                <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity={0.08} />
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
                stroke="#0891b2"
                fill="url(#expenseArea)"
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
