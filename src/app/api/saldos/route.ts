import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { readCatalogs } from "@/lib/catalogs";
import { prisma } from "@/lib/prisma";

type AccountBalanceItem = {
  accountCode: string;
  accountLabel: string;
  openingBalance: number;
  incomeNet: number;
  transferIn: number;
  expenseReal: number;
  transferOut: number;
  transferFee: number;
  softwareBalance: number;
  actualBalance: number | null;
  difference: number | null;
};

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const catalogs = await readCatalogs();
    const accounts = catalogs.accounts.map((item) => ({
      code: item.code,
      label: item.name
    }));

    const [incomes, expenses, transferIn, transferOut, controls] = await Promise.all([
      prisma.income.groupBy({
        by: ["accountCode"],
        _sum: {
          netAmount: true
        }
      }),
      prisma.expense.groupBy({
        by: ["accountCode"],
        _sum: {
          realAmount: true
        }
      }),
      prisma.internalTransfer.groupBy({
        by: ["destinationAccountCode"],
        _sum: {
          amount: true
        }
      }),
      prisma.internalTransfer.groupBy({
        by: ["originAccountCode"],
        _sum: {
          amount: true,
          fee: true
        }
      }),
      prisma.accountBalanceControl.findMany({
        select: {
          accountCode: true,
          openingBalance: true,
          actualBalance: true
        }
      })
    ]);

    const incomeMap = new Map(incomes.map((item) => [item.accountCode, Number(item._sum.netAmount ?? 0)]));
    const expenseMap = new Map(expenses.map((item) => [item.accountCode, Number(item._sum.realAmount ?? 0)]));
    const transferInMap = new Map(transferIn.map((item) => [item.destinationAccountCode, Number(item._sum.amount ?? 0)]));
    const transferOutMap = new Map(
      transferOut.map((item) => [
        item.originAccountCode,
        {
          amount: Number(item._sum.amount ?? 0),
          fee: Number(item._sum.fee ?? 0)
        }
      ])
    );
    const controlMap = new Map(
      controls.map((item) => [
        item.accountCode,
        {
          openingBalance: Number(item.openingBalance ?? 0),
          actualBalance: item.actualBalance === null ? null : Number(item.actualBalance)
        }
      ])
    );

    const items: AccountBalanceItem[] = accounts.map((account) => {
      const openingBalance = controlMap.get(account.code)?.openingBalance ?? 0;
      const actualBalance = controlMap.get(account.code)?.actualBalance ?? null;
      const incomeNet = incomeMap.get(account.code) ?? 0;
      const incomingTransfers = transferInMap.get(account.code) ?? 0;
      const expenseReal = expenseMap.get(account.code) ?? 0;
      const outgoingTransfer = transferOutMap.get(account.code)?.amount ?? 0;
      const transferFee = transferOutMap.get(account.code)?.fee ?? 0;
      const softwareBalance = openingBalance + incomeNet + incomingTransfers - expenseReal - outgoingTransfer - transferFee;
      const difference = actualBalance === null ? null : actualBalance - softwareBalance;

      return {
        accountCode: account.code,
        accountLabel: account.label,
        openingBalance,
        incomeNet,
        transferIn: incomingTransfers,
        expenseReal,
        transferOut: outgoingTransfer,
        transferFee,
        softwareBalance,
        actualBalance,
        difference
      };
    });

    const totals = items.reduce(
      (accumulator, item) => ({
        openingBalance: accumulator.openingBalance + item.openingBalance,
        incomeNet: accumulator.incomeNet + item.incomeNet,
        transferIn: accumulator.transferIn + item.transferIn,
        expenseReal: accumulator.expenseReal + item.expenseReal,
        transferOut: accumulator.transferOut + item.transferOut,
        transferFee: accumulator.transferFee + item.transferFee,
        softwareBalance: accumulator.softwareBalance + item.softwareBalance,
        actualBalance: accumulator.actualBalance + (item.actualBalance ?? 0),
        difference: accumulator.difference + (item.difference ?? 0),
        accountsWithActual: accumulator.accountsWithActual + (item.actualBalance === null ? 0 : 1)
      }),
      {
        openingBalance: 0,
        incomeNet: 0,
        transferIn: 0,
        expenseReal: 0,
        transferOut: 0,
        transferFee: 0,
        softwareBalance: 0,
        actualBalance: 0,
        difference: 0,
        accountsWithActual: 0
      }
    );

    return NextResponse.json({
      items,
      totals
    });
  } catch {
    return NextResponse.json({ message: "No fue posible calcular saldos por cuenta" }, { status: 500 });
  }
}
