"use client";

import { useEffect, useMemo, useState } from "react";
import { Repeat } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { formatCop, formatCopInput } from "@/lib/money";

type AccountItem = {
  code: string;
  label: string;
};

type TransferCatalogResponse = {
  accounts: AccountItem[];
};

type TransferItem = {
  id: string;
  createdAt: string;
  transferAt: string;
  originAccountCode: string;
  destinationAccountCode: string;
  amount: number;
  fee: number;
  note: string;
  createdBy: string;
};

type TransfersResponse = {
  items: TransferItem[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

type Filters = {
  from: string;
  to: string;
  originAccountCode: string;
  destinationAccountCode: string;
};

type MeResponse = {
  user?: {
    role?: "ADMIN" | "OPERATOR";
  } | null;
};

type EditDraft = {
  transferAtInput: string;
  originAccountCode: string;
  destinationAccountCode: string;
  amountInput: string;
  feeInput: string;
  note: string;
  saving: boolean;
};

const initialFilters: Filters = {
  from: "",
  to: "",
  originAccountCode: "",
  destinationAccountCode: ""
};

function toDateTimeLocalString(dateValue: string | Date): string {
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

export function TransfersDashboard() {
  const [catalogs, setCatalogs] = useState<TransferCatalogResponse | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<TransfersResponse | null>(null);
  const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});

  const loadData = async (currentFilters: Filters, currentPage: number, currentPageSize: number) => {
    try {
      setLoading(true);
      setError("");

      const params = buildParams(currentFilters, currentPage, currentPageSize);
      const response = await fetchWithTimeout(`/api/transfers?${params.toString()}`);
      const payload = (await response.json()) as TransfersResponse & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible cargar transferencias");
      }

      setRows(payload);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Tiempo de espera agotado al consultar transferencias.");
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
          fetchWithTimeout("/api/transfers/catalogs"),
          fetchWithTimeout("/api/auth/me")
        ]);

        const catalogsPayload = (await catalogsResponse.json()) as TransferCatalogResponse & { message?: string };

        if (!catalogsResponse.ok) {
          throw new Error(catalogsPayload.message ?? "No fue posible cargar catálogos");
        }

        setCatalogs(catalogsPayload);

        if (meResponse.ok) {
          const mePayload = (await meResponse.json()) as MeResponse;
          setIsAdmin(mePayload.user?.role === "ADMIN");
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "No fue posible cargar datos iniciales");
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    loadData(appliedFilters, page, pageSize);
  }, [appliedFilters, page, pageSize]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const startEditRow = (item: TransferItem) => {
    setEditingRows((previous) => ({
      ...previous,
      [item.id]: true
    }));

    setEditDrafts((previous) => ({
      ...previous,
      [item.id]: {
        transferAtInput: toDateTimeLocalString(item.transferAt),
        originAccountCode: item.originAccountCode,
        destinationAccountCode: item.destinationAccountCode,
        amountInput: String(item.amount),
        feeInput: String(item.fee || ""),
        note: item.note ?? "",
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

  const saveEditRow = async (item: TransferItem) => {
    if (!isAdmin) return;

    const draft = editDrafts[item.id];
    if (!draft) return;

    const payload = {
      transferAtInput: draft.transferAtInput,
      originAccountCode: normalizeCode(draft.originAccountCode),
      destinationAccountCode: normalizeCode(draft.destinationAccountCode),
      amountInput: draft.amountInput.trim(),
      feeInput: draft.feeInput.trim(),
      note: draft.note
    };

    updateDraft(item.id, (current) => ({ ...current, saving: true }));

    try {
      const response = await fetch(`/api/transfers/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "No fue posible actualizar transferencia");
      }

      await loadData(appliedFilters, page, pageSize);
      cancelEditRow(item.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible actualizar transferencia");
      updateDraft(item.id, (current) => ({ ...current, saving: false }));
    }
  };

  const deleteRow = async (item: TransferItem) => {
    if (!isAdmin) return;

    const confirmed = window.confirm("¿Eliminar transferencia?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/transfers/${item.id}`, {
        method: "DELETE"
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible eliminar transferencia");
      }

      await loadData(appliedFilters, page, pageSize);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible eliminar transferencia");
    }
  };

  const totalMoved = useMemo(() => {
    if (!rows?.items?.length) return 0;
    return rows.items.reduce((sum, item) => sum + item.amount, 0);
  }, [rows?.items]);

  return (
    <section className="space-y-5">
      <article className="surface p-4 sm:p-5">
        <header className="mb-4">
          <h1 className="font-display text-2xl">Historial de transferencias internas</h1>
          <p className="mt-1 text-sm text-muted">
            Movimientos entre cuentas internas sin duplicarse como ingreso/egreso operativo.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <label className="label">Origen</label>
            <select
              className="select"
              value={filters.originAccountCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, originAccountCode: event.target.value }))}
            >
              <option value="">Todos</option>
              {catalogs?.accounts.map((item) => (
                <option key={`origin-filter-${item.code}`} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Destino</label>
            <select
              className="select"
              value={filters.destinationAccountCode}
              onChange={(event) => setFilters((prev) => ({ ...prev, destinationAccountCode: event.target.value }))}
            >
              <option value="">Todos</option>
              {catalogs?.accounts.map((item) => (
                <option key={`destination-filter-${item.code}`} value={item.code}>
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

      <article className="surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Tabla histórica</h2>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Repeat size={16} />
            Monto visible en página: <strong className="text-ink">{formatCop(totalMoved)}</strong>
          </div>
        </div>
        {isAdmin ? <p className="mt-1 text-xs text-muted">ADMIN puede editar o eliminar transferencias.</p> : null}

        <div className="table-wrap mt-4">
          <table className="table table-fluid">
            <thead>
              <tr>
                <th className="cell-nowrap">FECHA TRANSFERENCIA</th>
                <th>ORIGEN</th>
                <th>DESTINO</th>
                <th className="cell-nowrap">MONTO</th>
                <th className="cell-nowrap">COSTO</th>
                <th className="cell-nowrap">SALIDA ORIGEN</th>
                <th>NOTA</th>
                <th className="cell-nowrap">CREADO POR</th>
                {isAdmin ? <th className="cell-nowrap">ACCIÓN</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows?.items.length ? (
                rows.items.map((item) => {
                  const isEditing = Boolean(editingRows[item.id]);
                  const draft = editDrafts[item.id];
                  const amount = Number(draft?.amountInput?.replace(/[^\d,.-]/g, "").replace(",", ".") ?? item.amount);
                  const fee = Number(draft?.feeInput?.replace(/[^\d,.-]/g, "").replace(",", ".") ?? item.fee);

                  return (
                    <tr key={item.id}>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <input
                            className="input !min-w-[12rem] !px-2 !py-1"
                            type="datetime-local"
                            value={draft?.transferAtInput ?? ""}
                            onChange={(event) =>
                              updateDraft(item.id, (current) => ({ ...current, transferAtInput: event.target.value }))
                            }
                          />
                        ) : (
                          formatDateTime(item.transferAt)
                        )}
                      </td>
                      <td>
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[10rem] !px-2 !py-1"
                            value={draft?.originAccountCode ?? ""}
                            onChange={(event) =>
                              updateDraft(item.id, (current) => ({ ...current, originAccountCode: event.target.value }))
                            }
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.accounts.map((account) => (
                              <option key={`origin-${item.id}-${account.code}`} value={account.code}>
                                {account.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.originAccountCode
                        )}
                      </td>
                      <td>
                        {isAdmin && isEditing ? (
                          <select
                            className="select !min-w-[10rem] !px-2 !py-1"
                            value={draft?.destinationAccountCode ?? ""}
                            onChange={(event) =>
                              updateDraft(item.id, (current) => ({ ...current, destinationAccountCode: event.target.value }))
                            }
                          >
                            <option value="">Seleccionar</option>
                            {catalogs?.accounts.map((account) => (
                              <option key={`destination-${item.id}-${account.code}`} value={account.code}>
                                {account.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.destinationAccountCode
                        )}
                      </td>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <input
                            className="input !min-w-[8rem] !px-2 !py-1"
                            value={draft?.amountInput ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, amountInput: event.target.value }))}
                            onBlur={() =>
                              updateDraft(item.id, (current) => ({
                                ...current,
                                amountInput: formatCopInput(current.amountInput)
                              }))
                            }
                          />
                        ) : (
                          formatCop(item.amount)
                        )}
                      </td>
                      <td className="cell-nowrap">
                        {isAdmin && isEditing ? (
                          <input
                            className="input !min-w-[8rem] !px-2 !py-1"
                            value={draft?.feeInput ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, feeInput: event.target.value }))}
                            onBlur={() =>
                              updateDraft(item.id, (current) => ({
                                ...current,
                                feeInput: current.feeInput ? formatCopInput(current.feeInput) : ""
                              }))
                            }
                          />
                        ) : (
                          formatCop(item.fee)
                        )}
                      </td>
                      <td className="cell-nowrap">{formatCop((Number.isFinite(amount) ? amount : item.amount) + (Number.isFinite(fee) ? fee : item.fee))}</td>
                      <td className="cell-reason">
                        {isAdmin && isEditing ? (
                          <textarea
                            className="textarea !min-w-[14rem] !px-2 !py-1"
                            rows={2}
                            value={draft?.note ?? ""}
                            onChange={(event) => updateDraft(item.id, (current) => ({ ...current, note: event.target.value }))}
                          />
                        ) : (
                          item.note || "-"
                        )}
                      </td>
                      <td className="cell-nowrap">{item.createdBy}</td>

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
                            <div className="flex gap-1">
                              <button className="btn btn-secondary !px-3 !py-1" onClick={() => startEditRow(item)}>
                                Editar
                              </button>
                              <button className="btn btn-danger !px-3 !py-1" onClick={() => deleteRow(item)}>
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center text-muted">
                    {loading ? "Cargando transferencias..." : "No hay transferencias para los filtros seleccionados."}
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
    </section>
  );
}
