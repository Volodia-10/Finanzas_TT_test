import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAuthUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getAuthUser();

  if (user) {
    redirect("/ingresos");
  }

  return (
    <main className="app-shell grid min-h-screen place-items-center py-8">
      <section className="surface w-full max-w-md p-6 sm:p-8">
        <div className="mb-6">
          <p className="font-display text-2xl leading-tight">Bienvenido</p>
          <p className="mt-2 text-sm text-muted">
            Inicia sesión para registrar ingresos, consultar histórico y acceder al resumen financiero.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
