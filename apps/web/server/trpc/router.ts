import { router } from '@/lib/trpc/server';
import { dataSourcesRouter } from './routers/dataSources';
import { metaRouter } from './routers/meta';
import { negocioRouter } from './routers/negocio';

export const appRouter = router({
  dataSources: dataSourcesRouter,
  meta: metaRouter,
  negocio: negocioRouter,
});

export type AppRouter = typeof appRouter;
