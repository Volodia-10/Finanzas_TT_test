"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";

type CatalogType = "accounts" | "semesters" | "lines" | "wompiMethods" | "details";

type CatalogRow = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
};

type CatalogPayload = {
  accounts: Array<{ id: string; code: string; name: string; isActive: boolean; isSystem: boolean }>;
  semesters: Array<{ id: string; code: string; label: string; isActive: boolean; isSystem: boolean }>;
  lines: Array<{ id: string; code: string; label: string; isActive: boolean; isSystem: boolean }>;
  wompiMethods: Array<{ id: string; code: string; label: string; isActive: boolean; isSystem: boolean }>;
  details: Array<{ id: string; code: string; label: string; isActive: boolean; isSystem: boolean }>;
};

type MappingPayload = {
  accounts: Array<{ code: string }>;
  details: Array<{ code: string; label: string }>;
  mappings: Array<{
    isActive: boolean;
    account: { code: string };
    detailOption: { code: string };
  }>;
};

type WompiConfigPayload = {
  config: {
    baseFeeRate: number;
    fixedFee: number;
    ivaRate: number;
    tcExtraRate: number;
  };
};

const tabs: { id: CatalogType; label: string }[] = [
  { id: "accounts", label: "Cuentas" },
  { id: "semesters", label: "Semestres" },
  { id: "lines", label: "Líneas" },
  { id: "wompiMethods", label: "Métodos pago" },
  { id: "details", label: "Detalles cuenta" }
];

function normalizeCatalog(payload: CatalogPayload): Record<CatalogType, CatalogRow[]> {
  return {
    accounts: payload.accounts.map((item) => ({
      id: item.id,
      code: item.code,
      label: item.name,
      isActive: item.isActive,
      isSystem: item.isSystem
    })),
    semesters: payload.semesters,
    lines: payload.lines,
    wompiMethods: payload.wompiMethods,
    details: payload.details
  };
}

export function AdminCatalogs() {
  const [activeTab, setActiveTab] = useState<CatalogType>("accounts");
  const [catalogs, setCatalogs] = useState<Record<CatalogType, CatalogRow[]> | null>(null);
  const [mappingData, setMappingData] = useState<MappingPayload | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { code: string; label: string }>>({});
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [wompiConfig, setWompiConfig] = useState<WompiConfigPayload["config"] | null>(null);
  const [wompiSaving, setWompiSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const activeRows = catalogs?.[activeTab] ?? [];

  const activeDetailSet = useMemo(() => {
    if (!mappingData || !selectedAccount) return new Set<string>();

    return new Set(
      mappingData.mappings
        .filter((mapping) => mapping.account.code === selectedAccount && mapping.isActive)
        .map((mapping) => mapping.detailOption.code)
    );
  }, [mappingData, selectedAccount]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [catalogsResponse, mappingsResponse, wompiResponse] = await Promise.all([
        fetch("/api/admin/catalogs", { cache: "no-store" }),
        fetch("/api/admin/account-details", { cache: "no-store" }),
        fetch("/api/admin/wompi-config", { cache: "no-store" })
      ]);

      const catalogsPayload = (await catalogsResponse.json()) as CatalogPayload & { message?: string };
      const mappingsPayload = (await mappingsResponse.json()) as MappingPayload & { message?: string };
      const wompiPayload = (await wompiResponse.json()) as WompiConfigPayload & { message?: string };

      if (!catalogsResponse.ok) {
        throw new Error(catalogsPayload.message ?? "No fue posible leer catálogos");
      }

      if (!mappingsResponse.ok) {
        throw new Error(mappingsPayload.message ?? "No fue posible leer detalles por cuenta");
      }

      if (!wompiResponse.ok) {
        throw new Error(wompiPayload.message ?? "No fue posible leer configuración WOMPI");
      }

      const normalized = normalizeCatalog(catalogsPayload);
      setCatalogs(normalized);
      setMappingData(mappingsPayload);
      setWompiConfig(wompiPayload.config);

      setSelectedAccount((prev) => {
        if (prev) return prev;
        return mappingsPayload.accounts[0]?.code ?? "";
      });

      const newDrafts: Record<string, { code: string; label: string }> = {};
      Object.values(normalized)
        .flat()
        .forEach((row) => {
          newDrafts[row.id] = { code: row.code, label: row.label };
        });
      setDrafts(newDrafts);
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
    const code = newCode.trim().toUpperCase();
    const label = newLabel.trim().toUpperCase();

    if (!code || !label) {
      setError("Debes completar código y etiqueta");
      return;
    }

    const response = await fetch("/api/admin/catalogs", {
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
    setFeedback("");
    setError("");

    const draft = drafts[rowId];
    if (!draft) return;

    const response = await fetch("/api/admin/catalogs", {
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

    const response = await fetch("/api/admin/catalogs", {
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

    const response = await fetch("/api/admin/catalogs", {
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

  const toggleMapping = async (detailCode: string, isActive: boolean) => {
    if (!selectedAccount) return;

    const response = await fetch("/api/admin/account-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountCode: selectedAccount,
        detailCode,
        isActive
      })
    });

    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(payload.message ?? "No fue posible actualizar relación");
      return;
    }

    setFeedback("Relación actualizada");
    await fetchAll();
  };

  const saveWompiConfig = async () => {
    if (!wompiConfig) return;

    setError("");
    setFeedback("");
    setWompiSaving(true);

    try {
      const response = await fetch("/api/admin/wompi-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wompiConfig)
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No fue posible actualizar WOMPI");
      }

      setFeedback("Configuración WOMPI actualizada");
      await fetchAll();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible actualizar WOMPI");
    } finally {
      setWompiSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <article className="surface p-5 sm:p-6">
        <header className="mb-4 flex items-center gap-3">
          <Settings2 className="text-orange-600" />
          <div>
            <h1 className="font-display text-2xl">Administración de listados</h1>
            <p className="text-sm text-muted">
              Solo ADMIN: edita catálogos (cuentas, semestres, líneas, métodos, detalles) y mapeo de detalle por cuenta.
            </p>
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

      <article className="surface p-5 sm:p-6">
        <h2 className="font-display text-xl">Detalle de cuenta por banco</h2>
        <p className="mt-1 text-sm text-muted">
          Define qué detalles se habilitan para cada cuenta en el formulario de ingresos.
        </p>

        <div className="mt-4 max-w-sm">
          <label className="label">Cuenta</label>
          <select
            className="select"
            value={selectedAccount}
            onChange={(event) => setSelectedAccount(event.target.value)}
          >
            {mappingData?.accounts?.map((account) => (
              <option key={account.code} value={account.code}>
                {account.code}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mappingData?.details?.map((detail) => {
            const active = activeDetailSet.has(detail.code);

            return (
              <label key={detail.code} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => toggleMapping(detail.code, event.target.checked)}
                />
                {detail.label}
              </label>
            );
          })}
        </div>
      </article>

      <article className="surface p-5 sm:p-6">
        <h2 className="font-display text-xl">Configuración de cálculo WOMPI</h2>
        <p className="mt-1 text-sm text-muted">
          Ajusta parámetros de comisión e IVA para que el cálculo neto cambie sin editar código.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label">Tarifa base</label>
            <input
              className="input"
              type="number"
              min="0"
              max="1"
              step="0.0001"
              value={wompiConfig?.baseFeeRate ?? 0}
              onChange={(event) =>
                setWompiConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        baseFeeRate: Number(event.target.value)
                      }
                    : prev
                )
              }
            />
            <p className="mt-1 text-xs text-muted">Ej: 0.0265 = 2.65%</p>
          </div>

          <div>
            <label className="label">Valor fijo</label>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={wompiConfig?.fixedFee ?? 0}
              onChange={(event) =>
                setWompiConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        fixedFee: Number(event.target.value)
                      }
                    : prev
                )
              }
            />
          </div>

          <div>
            <label className="label">IVA comisión</label>
            <input
              className="input"
              type="number"
              min="0"
              max="1"
              step="0.0001"
              value={wompiConfig?.ivaRate ?? 0}
              onChange={(event) =>
                setWompiConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        ivaRate: Number(event.target.value)
                      }
                    : prev
                )
              }
            />
            <p className="mt-1 text-xs text-muted">Ej: 0.19 = 19%</p>
          </div>

          <div>
            <label className="label">Recargo TC</label>
            <input
              className="input"
              type="number"
              min="0"
              max="1"
              step="0.0001"
              value={wompiConfig?.tcExtraRate ?? 0}
              onChange={(event) =>
                setWompiConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        tcExtraRate: Number(event.target.value)
                      }
                    : prev
                )
              }
            />
            <p className="mt-1 text-xs text-muted">Ej: 0.015 = 1.5%</p>
          </div>
        </div>

        <div className="mt-4">
          <button className="btn btn-primary" onClick={saveWompiConfig} disabled={!wompiConfig || wompiSaving}>
            {wompiSaving ? "Guardando..." : "Guardar parámetros WOMPI"}
          </button>
        </div>
      </article>
    </section>
  );
}
