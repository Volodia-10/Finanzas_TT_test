import { AppNav } from "@/components/app-nav";
import { requireAuth } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <main className="app-shell">
      <AppNav userName={user.name} role={user.role} />
      {children}
    </main>
  );
}
