import { ReactNode } from "react";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
};

export function KpiCard({ title, value, subtitle, icon }: KpiCardProps) {
  return (
    <article className="surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{title}</p>
          <p className="kpi-value mt-2">{value}</p>
          {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {icon ? <div className="rounded-xl bg-orange-100 p-2 text-orange-700">{icon}</div> : null}
      </div>
    </article>
  );
}
