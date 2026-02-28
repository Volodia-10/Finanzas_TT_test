import { AdminCatalogs } from "@/components/admin-catalogs";
import { AdminExpenseCatalogs } from "@/components/admin-expense-catalogs";
import { AdminOpeningBalances } from "@/components/admin-opening-balances";
import { requireAdmin } from "@/lib/auth";

export default async function AdminListsPage() {
  await requireAdmin();
  return (
    <section className="space-y-5">
      <AdminCatalogs />
      <AdminOpeningBalances />
      <AdminExpenseCatalogs />
    </section>
  );
}
