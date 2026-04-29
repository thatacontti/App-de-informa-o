import { router } from '@/lib/trpc/server';
import { dataSourcesRouter } from './routers/dataSources';

export const appRouter = router({
  dataSources: dataSourcesRouter,
});

export type AppRouter = typeof appRouter;
