import { router } from '@/lib/trpc/server';
import { dataSourcesRouter } from './routers/dataSources';
import { marcaCidadeRouter } from './routers/marcaCidade';
import { metaRouter } from './routers/meta';
import { negocioRouter } from './routers/negocio';

export const appRouter = router({
  dataSources: dataSourcesRouter,
  meta: metaRouter,
  negocio: negocioRouter,
  marcaCidade: marcaCidadeRouter,
});

export type AppRouter = typeof appRouter;
