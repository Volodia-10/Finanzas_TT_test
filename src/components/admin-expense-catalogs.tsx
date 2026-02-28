"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";

type ExpenseCatalogType =
  | "expenseMethods"
  | "expenseCategories"
  | "expenseMonths"
  | "expenseEmployees"
  | "expenseAuthorizers"
  | "expenseResponsibles"
  | "carNames"
  | "carMotives";

type CatalogRow = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
};

type Payload = Record<ExpenseCatalogType, CatalogRow[]>;

const tabs: { id: ExpenseCatalogType; label: string }[] = [
  { id: "expenseMethods", label: "Métodos egreso" },
  { id: "expenseCategories", label: "Categorías" },
  { id: "expenseMonths", label: "Meses" },
  { id: "expenseEmployees", label: "Empleados" },
  { id: "expenseAuthorizers", label: "Autorizó" },
  { id: "expenseResponsibles", label: "Responsable" },
  { id: "carNames", label: "Carros" },
  { id: "carMotives", label: "Motivos carro" }
];

export function AdminExpenseCatalogs() {
  const [activeTab, setActiveTab] = useState<ExpenseCatalogType>("expenseMethods");
  const [catalogs, setCatalogs] = useState<Payload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { code: string; label: string }>>({});
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const activeRows = catalogs?.[activeTab] ?? [];

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/expense-catalogs", { cache: "no-store" });
      const payload = (await response.json()) as Payload & { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible leer catálogos de egresos");
      }

      setCatalogs(payload);

      const nextDrafts: Record<string, { code: string; label: string }> = {};
      tabs
        .flatMap((tab) => payload[tab.id] ?? [])
        .forEach((row) => {
          nextDrafts[row.id] = { code: row.code, label: row.label };
        });
      setDrafts(nextDrafts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const createRow = async () => {
    setFeedback("");
    setError("");

    const code = newCode.trim().toUpperCase();
    const label = newLabel.trim().toUpperCase();

    if (!code || !label) {
      setError("Debes completar código y etiqueta");
      return;
    }

    const response = await fetch("/api/admin/expense-catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activeTab,
        code,
        label
      })
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "No fue posible crear registro");
      return;
    }

    setNewCode("");
    setNewLabel("");
    setFeedback("Registro creado");
    await fetchAll();
  };

  const saveRow = async (rowId: string) => {
    const draft = drafts[rowId];
    if (!draft) return;

    setFeedback("");
    setError("");

    const response = await fetch("/api/admin/expense-catalogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activeTab,
        id: rowId,
        code: draft.code.trim().toUpperCase(),
        label: draft.label.trim().toUpperCase()
      })
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "No fue posible actualizar");
      return;
    }

    setFeedback("Registro actualizado");
    await fetchAll();
  };

  const toggleRow = async (row: CatalogRow) => {
    setFeedback("");
    setError("");

    const response = await fetch("/api/admin/expense-catalogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activeTab,
        id: row.id,
        isActive: !row.isActive
      })
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "No fue posible cambiar estado");
      return;
    }

    setFeedback("Estado actualizado");
    await fetchAll();
  };

  const deleteRow = async (row: CatalogRow) => {
    if (row.isSystem) return;

    const confirmed = window.confirm(`¿Eliminar ${row.code}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setFeedback("");
    setError("");

    const response = await fetch("/api/admin/expense-catalogs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activeTab,
        id: row.id
      })
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "No fue posible eliminar");
      return;
    }

    setFeedback("Registro eliminado");
    await fetchAll();
  };

  return (
    <article className="surface p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-3">
        <ListChecks className="text-teal-600" />
        <div>
          <h2 className="font-display text-2xl">Listados de egresos</h2>
          <p className="text-sm text-muted">Solo ADMIN: gestiona métodos, categorías, meses, empleados y catálogos de carros.</p>
        </div>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="input"
          placeholder="Código"
          value={newCode}
          onChange={(event) => setNewCode(event.target.value)}
        />
        <input
          className="input"
          placeholder="Etiqueta"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />
        <button className="btn btn-primary" onClick={createRow}>
          Agregar
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Cargando catálogos...</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-danger">{error}</p> : null}
      {feedback ? <p className="mt-4 text-sm font-semibold text-success">{feedback}</p> : null}

      <div className="table-wrap mt-5">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Etiqueta</th>
              <th>Estado</th>
              <th>Sistema</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    className="input"
                    value={drafts[row.id]?.code ?? row.code}
                    disabled={row.isSystem}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: {
                          code: event.target.value,
                          label: prev[row.id]?.label ?? row.label
                        }
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={drafts[row.id]?.label ?? row.label}
                    disabled={row.isSystem}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.id]: {
                          code: prev[row.id]?.code ?? row.code,
                          label: event.target.value
                        }
                      }))
                    }
                  />
                </td>
                <td>{row.isActive ? "ACTIVO" : "INACTIVO"}</td>
                <td>{row.isSystem ? "Sí" : "No"}</td>
                <td className="space-x-2">
                  <button className="btn btn-secondary" onClick={() => saveRow(row.id)} disabled={row.isSystem}>
                    Guardar
                  </button>
                  <button
                    className={`btn ${row.isActive ? "btn-danger" : "btn-secondary"}`}
                    onClick={() => toggleRow(row)}
                    disabled={row.isSystem && row.isActive}
                  >
                    {row.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteRow(row)} disabled={row.isSystem}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
