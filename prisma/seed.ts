import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedItem = {
  code: string;
  label: string;
  isSelectable?: boolean;
};

async function upsertUser() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@proyectofinanzas.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123*";
  const operatorEmail = process.env.SEED_OPERATOR_EMAIL ?? "operador@proyectofinanzas.local";
  const operatorPassword = process.env.SEED_OPERATOR_PASSWORD ?? adminPassword;

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const operatorPasswordHash = await bcrypt.hash(operatorPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Administrador",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      email: adminEmail,
      name: "Administrador",
      role: UserRole.ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: operatorEmail },
    update: {
      name: "Operador",
      role: UserRole.OPERATOR,
      passwordHash: operatorPasswordHash,
      isActive: true
    },
    create: {
      email: operatorEmail,
      name: "Operador",
      role: UserRole.OPERATOR,
      passwordHash: operatorPasswordHash,
      isActive: true
    }
  });
}

async function upsertCatalogs() {
  const accounts: SeedItem[] = [
    { code: "NEQUI", label: "NEQUI" },
    { code: "BANCOLOMBIA_2807", label: "BANCOLOMBIA_2807" },
    { code: "BANCOLOMBIA_1423", label: "BANCOLOMBIA_1423" },
    { code: "DAVIVIENDA", label: "DAVIVIENDA" },
    { code: "EFECTY", label: "EFECTY" }
  ];

  const semesters: SeedItem[] = [
    { code: "126", label: "126" },
    { code: "226", label: "226" },
    { code: "326", label: "326" },
    { code: "426", label: "426" },
    { code: "526", label: "526" },
    { code: "GENERAL", label: "GENERAL", isSelectable: false }
  ];

  const lines: SeedItem[] = [
    { code: "L1", label: "L1" },
    { code: "L2", label: "L2" },
    { code: "L3", label: "L3" },
    { code: "L4", label: "L4" },
    { code: "L5", label: "L5" },
    { code: "L6", label: "L6" },
    { code: "L7", label: "L7" },
    { code: "GENERAL", label: "GENERAL", isSelectable: false }
  ];

  const wompiMethods: SeedItem[] = [
    { code: "PSE", label: "PSE" },
    { code: "TC", label: "TC" }
  ];

  const detailOptions: SeedItem[] = [
    { code: "BANCOLOMBIA", label: "BANCOLOMBIA" },
    { code: "WOMPI", label: "WOMPI" },
    { code: "NEQUI", label: "NEQUI" },
    { code: "CORRESPONSAL", label: "CORRESPONSAL" },
    { code: "PAGO INTERESES", label: "PAGO INTERESES" },
    { code: "NEQUI TRANSFIYA", label: "NEQUI TRANSFIYA" },
    { code: "RECARGA BANCOLOMBIA", label: "RECARGA BANCOLOMBIA" },
    { code: "RECARGA PSE", label: "RECARGA PSE" },
    { code: "RECARGA CORRESPONSAL", label: "RECARGA CORRESPONSAL" },
    { code: "REVERSIÓN PAGO", label: "REVERSIÓN PAGO" },
    { code: "OTROS BANCOS", label: "OTROS BANCOS" },
    { code: "DAVIVIENDA", label: "DAVIVIENDA" },
    { code: "DAVIPLATA", label: "DAVIPLATA" },
    { code: "GIRO NACIONAL", label: "GIRO NACIONAL" }
  ];

  for (const item of accounts) {
    await prisma.account.upsert({
      where: { code: item.code },
      update: {
        name: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        name: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of semesters) {
    await prisma.semester.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true,
        isSelectable: item.isSelectable ?? true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true,
        isSelectable: item.isSelectable ?? true
      }
    });
  }

  for (const item of lines) {
    await prisma.line.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true,
        isSelectable: item.isSelectable ?? true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true,
        isSelectable: item.isSelectable ?? true
      }
    });
  }

  for (const item of wompiMethods) {
    await prisma.wompiMethod.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of detailOptions) {
    await prisma.detailOption.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }
}

async function upsertExpenseCatalogs() {
  const expenseMethods: SeedItem[] = [
    { code: "PAGO", label: "PAGO" },
    { code: "ENVIO", label: "ENVIO" },
    { code: "RETIRO", label: "RETIRO" },
    { code: "TC", label: "TC" }
  ];

  const expenseCategories: SeedItem[] = [
    { code: "DEVOLUCIÓN", label: "DEVOLUCIÓN" },
    { code: "ADELANTO", label: "ADELANTO" },
    { code: "CARROS", label: "CARROS" },
    { code: "BASE DE DATOS", label: "BASE DE DATOS" },
    { code: "FAMILIA", label: "FAMILIA" },
    { code: "FUTBOL_TT", label: "FUTBOL_TT" },
    { code: "INVENTARIO", label: "INVENTARIO" },
    { code: "INVERSIONES", label: "INVERSIONES" },
    { code: "ITAÚ-APTOS", label: "ITAÚ-APTOS" },
    { code: "MERCADO", label: "MERCADO" },
    { code: "OCIO", label: "OCIO" },
    { code: "PAGO_NÓMINA", label: "PAGO_NÓMINA" },
    { code: "SOFTWARE", label: "SOFTWARE" },
    { code: "VIAJES", label: "VIAJES" },
    { code: "VIATICOS", label: "VIATICOS" },
    { code: "IMPUESTOS", label: "IMPUESTOS" },
    { code: "SEGURIDAD_SOCIAL", label: "SEGURIDAD_SOCIAL" },
    { code: "PRIMAS", label: "PRIMAS" },
    { code: "CESANTIAS", label: "CESANTIAS" }
  ];

  const expenseMonths: SeedItem[] = [
    { code: "ENERO", label: "ENERO" },
    { code: "FEBRERO", label: "FEBRERO" },
    { code: "MARZO", label: "MARZO" },
    { code: "ABRIL", label: "ABRIL" },
    { code: "MAYO", label: "MAYO" },
    { code: "JUNIO", label: "JUNIO" },
    { code: "JULIO", label: "JULIO" },
    { code: "AGOSTO", label: "AGOSTO" },
    { code: "SEPTIEMBRE", label: "SEPTIEMBRE" },
    { code: "OCTUBRE", label: "OCTUBRE" },
    { code: "NOVIEMBRE", label: "NOVIEMBRE" },
    { code: "DICIEMBRE", label: "DICIEMBRE" }
  ];

  const expenseEmployees: SeedItem[] = [
    { code: "DIANA GOMEZ", label: "DIANA GOMEZ" },
    { code: "BRAYAN PRIMICIERO", label: "BRAYAN PRIMICIERO" },
    { code: "ANDREA GELVES", label: "ANDREA GELVES" },
    { code: "HERNAN DIAZ", label: "HERNAN DIAZ" },
    { code: "DAVID CORDON", label: "DAVID CORDON" },
    { code: "JULIANA RIVERA", label: "JULIANA RIVERA" },
    { code: "ASTRID RODRIGUEZ", label: "ASTRID RODRIGUEZ" },
    { code: "ALEXIS GOMEZ", label: "ALEXIS GOMEZ" },
    { code: "ANGELA FERNANDEZ", label: "ANGELA FERNANDEZ" },
    { code: "IVAN MONSALVE", label: "IVAN MONSALVE" },
    { code: "JHOSEP CABRERA", label: "JHOSEP CABRERA" },
    { code: "JUANCARLO HIDALGO", label: "JUANCARLO HIDALGO" },
    { code: "FAYBER SALAMANCA", label: "FAYBER SALAMANCA" },
    { code: "JAVIER MATIZ", label: "JAVIER MATIZ" },
    { code: "CAROLINA MACIAS", label: "CAROLINA MACIAS" },
    { code: "KARIME GOMEZ", label: "KARIME GOMEZ" },
    { code: "LADY JAIMES", label: "LADY JAIMES" },
    { code: "JOHAN SUAREZ", label: "JOHAN SUAREZ" },
    { code: "FELIPE TORRES", label: "FELIPE TORRES" },
    { code: "JESUS TORRES", label: "JESUS TORRES" },
    { code: "MARLON JOYA", label: "MARLON JOYA" },
    { code: "ZULAY RODRIGUEZ", label: "ZULAY RODRIGUEZ" },
    { code: "STELLA CORZO", label: "STELLA CORZO" },
    { code: "LILIANA BARRERA", label: "LILIANA BARRERA" },
    { code: "NATALIA JOYA", label: "NATALIA JOYA" },
    { code: "MARTHA RAMIREZ", label: "MARTHA RAMIREZ" },
    { code: "LADY GOMEZ", label: "LADY GOMEZ" },
    { code: "AMPARO IZAQUITA", label: "AMPARO IZAQUITA" },
    { code: "MAIRA SANDOVAL", label: "MAIRA SANDOVAL" },
    { code: "MADELEYNE CORZO", label: "MADELEYNE CORZO" },
    { code: "CINTHIA CIFUENTES", label: "CINTHIA CIFUENTES" },
    { code: "DANIELA RIAÑO", label: "DANIELA RIAÑO" },
    { code: "PAOLA CACERES", label: "PAOLA CACERES" },
    { code: "MONICA GUARIN", label: "MONICA GUARIN" },
    { code: "NICOLLE LEÓN", label: "NICOLLE LEÓN" }
  ];

  const expenseAuthorizers: SeedItem[] = [
    { code: "EMPRESA", label: "EMPRESA" },
    { code: "JESUS", label: "JESUS" },
    { code: "FELIPE", label: "FELIPE" },
    { code: "MARLON", label: "MARLON" },
    { code: "AUTOMATICO", label: "AUTOMATICO" },
    { code: "OTRO", label: "OTRO" }
  ];

  const expenseResponsibles: SeedItem[] = [
    { code: "EMPRESA", label: "EMPRESA" },
    { code: "JESUS", label: "JESUS" },
    { code: "FELIPE", label: "FELIPE" },
    { code: "MARLON", label: "MARLON" },
    { code: "OTRO", label: "OTRO" }
  ];

  const carNames: SeedItem[] = [
    { code: "VERSA", label: "VERSA" },
    { code: "MAZDA", label: "MAZDA" },
    { code: "QASHQAI", label: "QASHQAI" }
  ];

  const carMotives: SeedItem[] = [
    { code: "MANTENIMIENTO", label: "MANTENIMIENTO" },
    { code: "SOAT", label: "SOAT" },
    { code: "IMPUESTOS", label: "IMPUESTOS" },
    { code: "TODO-RIESGO", label: "TODO-RIESGO" },
    { code: "TECNICOMECANICO", label: "TECNICOMECANICO" }
  ];

  for (const item of expenseMethods) {
    await prisma.expenseMethod.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of expenseMonths) {
    await prisma.expenseMonth.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of expenseEmployees) {
    await prisma.expenseEmployee.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of expenseAuthorizers) {
    await prisma.expenseAuthorizer.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of expenseResponsibles) {
    await prisma.expenseResponsible.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of carNames) {
    await prisma.carName.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const item of carMotives) {
    await prisma.carMotive.upsert({
      where: { code: item.code },
      update: {
        label: item.label,
        isActive: true,
        isSystem: true
      },
      create: {
        code: item.code,
        label: item.label,
        isActive: true,
        isSystem: true
      }
    });
  }
}

async function seedDetailMappings() {
  const accountToDetails: Record<string, string[]> = {
    BANCOLOMBIA_1423: ["BANCOLOMBIA", "WOMPI", "NEQUI", "CORRESPONSAL", "PAGO INTERESES"],
    BANCOLOMBIA_2807: ["BANCOLOMBIA", "WOMPI", "NEQUI", "CORRESPONSAL", "PAGO INTERESES"],
    NEQUI: [
      "NEQUI",
      "NEQUI TRANSFIYA",
      "RECARGA BANCOLOMBIA",
      "RECARGA PSE",
      "RECARGA CORRESPONSAL",
      "PAGO INTERESES",
      "REVERSIÓN PAGO",
      "OTROS BANCOS"
    ],
    DAVIVIENDA: ["DAVIVIENDA", "DAVIPLATA", "CORRESPONSAL", "PAGO INTERESES"],
    EFECTY: ["GIRO NACIONAL"]
  };

  const accounts = await prisma.account.findMany();
  const details = await prisma.detailOption.findMany();
  const accountMap = new Map(accounts.map((account) => [account.code, account.id]));
  const detailMap = new Map(details.map((detail) => [detail.code, detail.id]));

  for (const [accountCode, detailCodes] of Object.entries(accountToDetails)) {
    const accountId = accountMap.get(accountCode);
    if (!accountId) continue;

    for (const detailCode of detailCodes) {
      const detailId = detailMap.get(detailCode);
      if (!detailId) continue;

      await prisma.accountDetailMap.upsert({
        where: {
          accountId_detailOptionId: {
            accountId,
            detailOptionId: detailId
          }
        },
        update: {
          isActive: true
        },
        create: {
          accountId,
          detailOptionId: detailId,
          isActive: true
        }
      });
    }
  }
}

async function upsertWompiConfig() {
  await prisma.wompiConfig.upsert({
    where: { code: "DEFAULT" },
    update: {
      baseFeeRate: 0.0265,
      fixedFee: 700,
      ivaRate: 0.19,
      tcExtraRate: 0.015,
      isActive: true,
      isSystem: true
    },
    create: {
      code: "DEFAULT",
      baseFeeRate: 0.0265,
      fixedFee: 700,
      ivaRate: 0.19,
      tcExtraRate: 0.015,
      isActive: true,
      isSystem: true
    }
  });
}

async function main() {
  await upsertUser();
  await upsertCatalogs();
  await upsertExpenseCatalogs();
  await seedDetailMappings();
  await upsertWompiConfig();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
