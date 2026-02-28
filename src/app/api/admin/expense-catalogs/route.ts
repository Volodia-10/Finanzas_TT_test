import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { EXPENSE_MONTH_ORDER } from "@/lib/expense-rules";
import { prisma } from "@/lib/prisma";
import { catalogCreateSchema, catalogPatchSchema } from "@/lib/validation";

type ExpenseCatalogType =
  | "expenseMethods"
  | "expenseCategories"
  | "expenseMonths"
  | "expenseEmployees"
  | "expenseAuthorizers"
  | "expenseResponsibles"
  | "carNames"
  | "carMotives";

function isValidType(type: string): type is ExpenseCatalogType {
  return [
    "expenseMethods",
    "expenseCategories",
    "expenseMonths",
    "expenseEmployees",
    "expenseAuthorizers",
    "expenseResponsibles",
    "carNames",
    "carMotives"
  ].includes(type);
}

const expenseMonthIndex = new Map<string, number>(EXPENSE_MONTH_ORDER.map((code, index) => [code, index]));

function sortMonths<T extends { code: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const indexA = expenseMonthIndex.get(a.code) ?? Number.MAX_SAFE_INTEGER;
    const indexB = expenseMonthIndex.get(b.code) ?? Number.MAX_SAFE_INTEGER;

    if (indexA !== indexB) return indexA - indexB;
    return a.code.localeCompare(b.code, "es");
  });
}

async function ensureAdmin() {
  const user = await getAuthUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "No autorizado" }, { status: 401 })
    };
  }

  if (user.role !== UserRole.ADMIN) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Solo admin puede gestionar listados de egresos" }, { status: 403 })
    };
  }

  return { ok: true as const };
}

async function readByType(type: ExpenseCatalogType) {
  if (type === "expenseMethods") {
    return prisma.expenseMethod.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "expenseCategories") {
    return prisma.expenseCategory.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "expenseMonths") {
    const rows = await prisma.expenseMonth.findMany({ orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }] });
    return sortMonths(rows);
  }

  if (type === "expenseEmployees") {
    return prisma.expenseEmployee.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "expenseAuthorizers") {
    return prisma.expenseAuthorizer.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "expenseResponsibles") {
    return prisma.expenseResponsible.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "carNames") {
    return prisma.carName.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  return prisma.carMotive.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
}

export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const type = request.nextUrl.searchParams.get("type");

  if (type) {
    if (!isValidType(type)) {
      return NextResponse.json({ message: "Tipo de catálogo inválido" }, { status: 400 });
    }

    const rows = await readByType(type);
    return NextResponse.json({ type, items: rows });
  }

  const [expenseMethods, expenseCategories, expenseMonths, expenseEmployees, expenseAuthorizers, expenseResponsibles, carNames, carMotives] =
    await Promise.all([
      prisma.expenseMethod.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseCategory.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseMonth.findMany({ orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }] }),
      prisma.expenseEmployee.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseAuthorizer.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.expenseResponsible.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.carName.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
      prisma.carMotive.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] })
    ]);

  return NextResponse.json({
    expenseMethods,
    expenseCategories,
    expenseMonths: sortMonths(expenseMonths),
    expenseEmployees,
    expenseAuthorizers,
    expenseResponsibles,
    carNames,
    carMotives
  });
}

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const type = body?.type;

  if (!type || !isValidType(type)) {
    return NextResponse.json({ message: "Tipo de catálogo inválido" }, { status: 400 });
  }

  const parsed = catalogCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const label = parsed.data.label.trim().toUpperCase();

  try {
    if (type === "expenseMethods") {
      const item = await prisma.expenseMethod.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (type === "expenseCategories") {
      const item = await prisma.expenseCategory.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (type === "expenseMonths") {
      const item = await prisma.expenseMonth.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (type === "expenseEmployees") {
      const item = await prisma.expenseEmployee.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (type === "expenseAuthorizers") {
      const item = await prisma.expenseAuthorizer.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (type === "expenseResponsibles") {
      const item = await prisma.expenseResponsible.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    if (type === "carNames") {
      const item = await prisma.carName.create({ data: { code, label, isActive: true, isSystem: false } });
      return NextResponse.json({ item }, { status: 201 });
    }

    const item = await prisma.carMotive.create({ data: { code, label, isActive: true, isSystem: false } });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "No fue posible crear registro (revisa código único)" }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const type = body?.type;

  if (!type || !isValidType(type)) {
    return NextResponse.json({ message: "Tipo de catálogo inválido" }, { status: 400 });
  }

  const parsed = catalogPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const nextCode = parsed.data.code?.trim().toUpperCase();
  const nextLabel = parsed.data.label?.trim().toUpperCase();

  try {
    if (type === "expenseMethods") {
      const current = await prisma.expenseMethod.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar métodos base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar métodos base del sistema" }, { status: 400 });
      }

      const item = await prisma.expenseMethod.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    if (type === "expenseCategories") {
      const current = await prisma.expenseCategory.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar categorías base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar categorías base del sistema" }, { status: 400 });
      }

      const item = await prisma.expenseCategory.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    if (type === "expenseMonths") {
      const current = await prisma.expenseMonth.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar meses base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar meses base del sistema" }, { status: 400 });
      }

      const item = await prisma.expenseMonth.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    if (type === "expenseEmployees") {
      const current = await prisma.expenseEmployee.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar empleados base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar empleados base del sistema" }, { status: 400 });
      }

      const item = await prisma.expenseEmployee.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    if (type === "expenseAuthorizers") {
      const current = await prisma.expenseAuthorizer.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar autorizadores base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar autorizadores base del sistema" }, { status: 400 });
      }

      const item = await prisma.expenseAuthorizer.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    if (type === "expenseResponsibles") {
      const current = await prisma.expenseResponsible.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar responsables base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar responsables base del sistema" }, { status: 400 });
      }

      const item = await prisma.expenseResponsible.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    if (type === "carNames") {
      const current = await prisma.carName.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar carros base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar carros base del sistema" }, { status: 400 });
      }

      const item = await prisma.carName.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item });
    }

    const current = await prisma.carMotive.findUnique({ where: { id: parsed.data.id } });
    if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
    if (current.isSystem && parsed.data.isActive === false) {
      return NextResponse.json({ message: "No puedes desactivar motivos base del sistema" }, { status: 400 });
    }
    if (current.isSystem && (nextCode || nextLabel)) {
      return NextResponse.json({ message: "No puedes editar motivos base del sistema" }, { status: 400 });
    }

    const item = await prisma.carMotive.update({
      where: { id: parsed.data.id },
      data: {
        ...(nextCode ? { code: nextCode } : {}),
        ...(nextLabel ? { label: nextLabel } : {}),
        ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
      }
    });

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar registro" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    type?: string;
    id?: string;
  };

  const type = body.type;
  const id = body.id?.trim();

  if (!type || !isValidType(type) || !id) {
    return NextResponse.json({ message: "Tipo o ID inválido" }, { status: 400 });
  }

  try {
    if (type === "expenseMethods") {
      const current = await prisma.expenseMethod.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.expenseMethod.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "expenseCategories") {
      const current = await prisma.expenseCategory.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.expenseCategory.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "expenseMonths") {
      const current = await prisma.expenseMonth.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.expenseMonth.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "expenseEmployees") {
      const current = await prisma.expenseEmployee.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.expenseEmployee.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "expenseAuthorizers") {
      const current = await prisma.expenseAuthorizer.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.expenseAuthorizer.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "expenseResponsibles") {
      const current = await prisma.expenseResponsible.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.expenseResponsible.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "carNames") {
      const current = await prisma.carName.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.carName.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    const current = await prisma.carMotive.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
    if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
    await prisma.carMotive.delete({ where: { id } });
    return NextResponse.json({ message: "Registro eliminado" });
  } catch {
    return NextResponse.json({ message: "No fue posible eliminar registro" }, { status: 400 });
  }
}
