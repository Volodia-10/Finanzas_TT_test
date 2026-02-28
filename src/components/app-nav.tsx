"use client";

import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

type AppNavProps = {
  userName: string;
  role: UserRole;
};

const baseLinks = [
  { href: "/ingresos", label: "Ingresos" },
  { href: "/ingresos/nuevo", label: "Nuevo Ingreso" },
  { href: "/egresos", label: "Egresos" },
  { href: "/egresos/nuevo", label: "Nuevo Egreso" },
  { href: "/transferencias", label: "Transferencias" },
  { href: "/transferencias/nuevo", label: "Nueva Transferencia" }
];

export function AppNav({ userName, role }: AppNavProps) {
  const pathname = usePathname();

  const links =
    role === "ADMIN"
      ? [...baseLinks, { href: "/saldos", label: "Saldos" }, { href: "/admin/listados", label: "Administración" }]
      : [...baseLinks, { href: "/saldos", label: "Saldos" }];

  return (
    <header className="surface glass mb-6 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="font-display text-xl tracking-tight">PROYECTO_FINANZAS_TT</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{userName}</span>
            <span className={cn("pill", role === "ADMIN" ? "badge-admin" : "badge-operator")}>{role}</span>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn("btn btn-secondary", active && "border-orange-300 bg-orange-50 text-orange-700")}
              >
                {link.label}
              </Link>
            );
          })}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
