import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { catalogCreateSchema, catalogPatchSchema } from "@/lib/validation";

type CatalogType = "accounts" | "semesters" | "lines" | "wompiMethods" | "details";

function isValidType(type: string): type is CatalogType {
  return ["accounts", "semesters", "lines", "wompiMethods", "details"].includes(type);
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
      response: NextResponse.json({ message: "Solo admin puede gestionar listados" }, { status: 403 })
    };
  }

  return { ok: true as const };
}

async function readCatalogByType(type: CatalogType) {
  if (type === "accounts") {
    return prisma.account.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "semesters") {
    return prisma.semester.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "lines") {
    return prisma.line.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  if (type === "wompiMethods") {
    return prisma.wompiMethod.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
  }

  return prisma.detailOption.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] });
}

export async function GET(request: NextRequest) {
  const auth = await ensureAdmin();
  if (!auth.ok) return auth.response;

  const type = request.nextUrl.searchParams.get("type");

  if (type) {
    if (!isValidType(type)) {
      return NextResponse.json({ message: "Tipo de catálogo inválido" }, { status: 400 });
    }

    const rows = await readCatalogByType(type);
    return NextResponse.json({ type, items: rows });
  }

  const [accounts, semesters, lines, wompiMethods, details] = await Promise.all([
    prisma.account.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
    prisma.semester.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
    prisma.line.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
    prisma.wompiMethod.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] }),
    prisma.detailOption.findMany({ orderBy: [{ isSystem: "desc" }, { code: "asc" }] })
  ]);

  return NextResponse.json({
    accounts,
    semesters,
    lines,
    wompiMethods,
    details
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
    if (type === "accounts") {
      const created = await prisma.account.create({
        data: {
          code,
          name: label,
          isActive: true,
          isSystem: false
        }
      });
      return NextResponse.json({ item: created }, { status: 201 });
    }

    if (type === "semesters") {
      const created = await prisma.semester.create({
        data: {
          code,
          label,
          isActive: true,
          isSystem: false,
          isSelectable: true
        }
      });
      return NextResponse.json({ item: created }, { status: 201 });
    }

    if (type === "lines") {
      const created = await prisma.line.create({
        data: {
          code,
          label,
          isActive: true,
          isSystem: false,
          isSelectable: true
        }
      });
      return NextResponse.json({ item: created }, { status: 201 });
    }

    if (type === "wompiMethods") {
      const created = await prisma.wompiMethod.create({
        data: {
          code,
          label,
          isActive: true,
          isSystem: false
        }
      });
      return NextResponse.json({ item: created }, { status: 201 });
    }

    const created = await prisma.detailOption.create({
      data: {
        code,
        label,
        isActive: true,
        isSystem: false
      }
    });

    return NextResponse.json({ item: created }, { status: 201 });
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
    if (type === "accounts") {
      const current = await prisma.account.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar cuentas base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar cuentas base del sistema" }, { status: 400 });
      }

      const updated = await prisma.account.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { name: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item: updated });
    }

    if (type === "semesters") {
      const current = await prisma.semester.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar semestres base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar semestres base del sistema" }, { status: 400 });
      }

      const updated = await prisma.semester.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item: updated });
    }

    if (type === "lines") {
      const current = await prisma.line.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar líneas base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar líneas base del sistema" }, { status: 400 });
      }

      const updated = await prisma.line.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item: updated });
    }

    if (type === "wompiMethods") {
      const current = await prisma.wompiMethod.findUnique({ where: { id: parsed.data.id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem && parsed.data.isActive === false) {
        return NextResponse.json({ message: "No puedes desactivar métodos base del sistema" }, { status: 400 });
      }
      if (current.isSystem && (nextCode || nextLabel)) {
        return NextResponse.json({ message: "No puedes editar métodos base del sistema" }, { status: 400 });
      }

      const updated = await prisma.wompiMethod.update({
        where: { id: parsed.data.id },
        data: {
          ...(nextCode ? { code: nextCode } : {}),
          ...(nextLabel ? { label: nextLabel } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
        }
      });

      return NextResponse.json({ item: updated });
    }

    const current = await prisma.detailOption.findUnique({ where: { id: parsed.data.id } });
    if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
    if (current.isSystem && parsed.data.isActive === false) {
      return NextResponse.json({ message: "No puedes desactivar detalles base del sistema" }, { status: 400 });
    }
    if (current.isSystem && (nextCode || nextLabel)) {
      return NextResponse.json({ message: "No puedes editar detalles base del sistema" }, { status: 400 });
    }

    const updated = await prisma.detailOption.update({
      where: { id: parsed.data.id },
      data: {
        ...(nextCode ? { code: nextCode } : {}),
        ...(nextLabel ? { label: nextLabel } : {}),
        ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {})
      }
    });

    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ message: "No fue posible actualizar el registro" }, { status: 400 });
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
    if (type === "accounts") {
      const current = await prisma.account.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.account.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "semesters") {
      const current = await prisma.semester.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.semester.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "lines") {
      const current = await prisma.line.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.line.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    if (type === "wompiMethods") {
      const current = await prisma.wompiMethod.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
      if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
      await prisma.wompiMethod.delete({ where: { id } });
      return NextResponse.json({ message: "Registro eliminado" });
    }

    const current = await prisma.detailOption.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ message: "Registro no encontrado" }, { status: 404 });
    if (current.isSystem) return NextResponse.json({ message: "No puedes eliminar registros base del sistema" }, { status: 400 });
    await prisma.detailOption.delete({ where: { id } });
    return NextResponse.json({ message: "Registro eliminado" });
  } catch {
    return NextResponse.json({ message: "No fue posible eliminar registro" }, { status: 400 });
  }
}
