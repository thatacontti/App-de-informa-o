import { router } from '@/lib/trpc/server';
import { dataSourcesRouter } from './routers/dataSources';
import { mapaRouter } from './routers/mapa';
import { marcaCidadeRouter } from './routers/marcaCidade';
import { metaRouter } from './routers/meta';
import { negocioRouter } from './routers/negocio';
import { produtoRouter } from './routers/produto';

export const appRouter = router({
  dataSources: dataSourcesRouter,
  meta: metaRouter,
  negocio: negocioRouter,
  marcaCidade: marcaCidadeRouter,
  produto: produtoRouter,
  mapa: mapaRouter,
});

export type AppRouter = typeof appRouter;
