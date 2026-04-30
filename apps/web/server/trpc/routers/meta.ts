import { db } from '@/lib/db';
import { router, protectedProcedure } from '@/lib/trpc/server';

// FilterBar drop-downs — derive options from the data we have so they
// stay in sync with whatever sources the worker populated.

export const metaRouter = router({
  filterOptions: protectedProcedure.query(async () => {
    const [reps, ufRows, groups] = await Promise.all([
      db.representative.findMany({
        where: { active: true },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, shortName: true },
      }),
      db.sale.groupBy({ by: ['ufId'], _count: { _all: true } }),
      db.product.groupBy({ by: ['productGroup'], _count: { _all: true } }),
    ]);

    const ufIds = ufRows
      .filter((r) => r._count._all > 0)
      .map((r) => r.ufId)
      .sort();

    const productGroups = groups
      .map((g) => g.productGroup)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return { reps, ufIds, productGroups };
  }),
});
