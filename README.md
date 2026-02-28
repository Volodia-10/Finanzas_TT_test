# PROYECTO_FINANZAS_TT

Aplicación web interna para gestión de ingresos financieros con enfoque en ergonomía web, reglas de negocio estrictas y control por roles.

## Stack técnico
- Next.js 14 + TypeScript
- Prisma ORM
- PostgreSQL (Neon recomendado)
- Tailwind CSS + Recharts
- Autenticación por JWT (cookie httpOnly)

## Roles
- `ADMIN`: puede gestionar listados (cuentas, semestres, líneas, métodos de pago WOMPI y detalles por cuenta).
- `OPERATOR`: puede registrar ingresos y consultar histórico/resumen.

## Módulo 1 implementado
- Formulario de creación de ingreso con reglas completas:
  - Formato COP (`$ 1.000.000,50`)
  - Detalle por cuenta dependiente
  - WOMPI condicional (solo BANCOLOMBIA + detalle WOMPI)
  - Cálculo neto WOMPI
  - Checkbox de LÍNEA/USER con comportamiento `PENDIENTE`
  - Regla especial de `PAGO INTERESES`
- Histórico de ingresos con filtros avanzados y paginación
- Resumen con:
  - total neto
  - cantidad de registros
  - ticket promedio
  - matriz cuenta vs semestre
  - sección especial de intereses
  - gráficas por fecha y por cuenta
- Panel admin para editar listados y mapeo detalle-cuenta

## Módulo 2 implementado
- Formulario de egresos con reglas dinámicas por categoría:
  - MES condicional
  - RAZÓN dinámica (texto/select/empleados/CARROS)
  - RAZÓN automática para `SEGURIDAD_SOCIAL` y `CESANTIAS` con año del sistema
  - Cálculo `CANTIDAD REAL` con regla 4x1000
- Histórico de egresos con:
  - filtros (`Desde/Hasta`, `Cuenta`, `Semestre`, `Categoría`)
  - edición de registros solo para ADMIN
  - exportación XLSX
- Resumen de egresos:
  - totales por categoría
  - matriz cuenta vs semestre
  - gráficos por categoría, cuenta y fecha
- Administración de listados de egresos (solo ADMIN):
  - métodos, categorías, meses, empleados, autorizó, responsable, carros y motivos

## Requisitos previos
- Node.js 20 o superior
- Base PostgreSQL (Neon recomendado)

## Arranque local
1. Copia variables:
```bash
cp .env.example .env
```

2. Configura `DATABASE_URL` y `JWT_SECRET` en `.env`.

3. Instala dependencias:
```bash
npm install
```

4. Genera cliente y aplica migración:
```bash
npx prisma migrate dev --name init
```

5. Carga datos base + usuarios:
```bash
npm run prisma:seed
```

6. Levanta el servidor:
```bash
npm run dev
```

## Credenciales iniciales (seed)
- Admin: `admin@proyectofinanzas.local`
- Operador: `operador@proyectofinanzas.local`
- Password por defecto: `Admin123*`

Puedes cambiar estos valores con:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

## Rutas principales
- `/login`
- `/ingresos` (histórico + resumen)
- `/ingresos/nuevo` (crear ingreso)
- `/egresos` (histórico + resumen)
- `/egresos/nuevo` (crear egreso)
- `/admin/listados` (solo ADMIN)

## Despliegue recomendado
### Opción A (recomendada para iniciar): Vercel + Neon
Ventajas:
- Deploy muy rápido para Next.js
- CDN y rendimiento buenos por defecto
- Coste inicial bajo

Pasos rápidos:
1. Sube repo a GitHub
2. Importa en Vercel
3. Crea DB en Neon
4. Configura variables de entorno en Vercel
5. Ejecuta migraciones (`prisma migrate deploy`) en build/deploy

### Opción B: Render + Neon
Ventajas:
- Flujo simple si prefieres Render
- Bueno para apps internas

Notas:
- Verifica plan para evitar cold starts en producción crítica

### Opción C: VPS propio + Neon
Ventajas:
- Más control y potencial ahorro a mediano plazo

Costo operativo:
- Mayor esfuerzo en mantenimiento, seguridad, backups y observabilidad

## Dominio propio
Sí, se soporta sin problema.
- En Vercel/Render: agregas dominio y actualizas DNS (A/CNAME) desde tu proveedor.

## Checklist QA mínimo
- Login correcto por rol
- Operador no accede a `/admin/listados`
- Validación de detalle según cuenta
- WOMPI solo visible cuando corresponde
- Cálculo WOMPI (PSE/TC) correcto
- Regla `PAGO INTERESES` aplicada automáticamente
- Formato COP y fecha en tabla correctos
- Filtros y paginación funcionales
- Resumen y gráficas consistentes con filtros
