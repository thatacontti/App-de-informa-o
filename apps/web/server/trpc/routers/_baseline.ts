// Carrega o baseline de receita por (customerId × brand) usado pelas
// comparações SSS / YoY. Dois caminhos:
//
//   - `compareCollection` setada → soma dos `Sale` rows da coleção
//     escolhida (Sale.collection = compareCollection). Funciona pra
//     qualquer par de coleções uma vez que o histórico CSV foi ingerido.
//
//   - `compareCollection` ausente → fall-back pro `CustomerBrandRevenue`
//     (period = 'V26'), que é o baseline original do cycle V27 ativo.

import type { Brand, PrismaClient } from '@prisma/client';

export type BaselineMap = Map<string, Partial<Record<Brand, number>>>;

export async function loadBaseline(
  db: PrismaClient,
  compareCollection: string | undefined,
): Promise<BaselineMap> {
  if (compareCollection) {
    const rows = await db.sale.groupBy({
      by: ['customerId', 'brand'],
      where: { collection: compareCollection },
      _sum: { value: true },
    });
    const out: BaselineMap = new Map();
    for (const r of rows) {
      const m = out.get(r.customerId) ?? {};
      m[r.brand] = Number(r._sum.value ?? 0);
      out.set(r.customerId, m);
    }
    return out;
  }

  const rows = await db.customerBrandRevenue.findMany({
    where: { period: 'V26' },
    select: { customerId: true, brand: true, value: true },
  });
  const out: BaselineMap = new Map();
  for (const r of rows) {
    const m = out.get(r.customerId) ?? {};
    m[r.brand] = Number(r.value);
    out.set(r.customerId, m);
  }
  return out;
}
