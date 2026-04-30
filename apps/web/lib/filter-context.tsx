'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { Filter, ViewMode } from '@painel/shared';

interface FilterCtx {
  filter: Filter;
  setFilter: <K extends keyof Filter>(key: K, value: Filter[K] | undefined) => void;
  resetFilter: () => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  canToggleViewMode: boolean;
}

const Ctx = createContext<FilterCtx | null>(null);

export function FilterProvider({
  children,
  initialViewMode,
  canToggleViewMode,
}: {
  children: React.ReactNode;
  initialViewMode: ViewMode;
  canToggleViewMode: boolean;
}) {
  const [filter, setFilterState] = useState<Filter>({});
  const [viewMode, setViewModeState] = useState<ViewMode>(initialViewMode);

  const value = useMemo<FilterCtx>(
    () => ({
      filter,
      setFilter: (key, val) => {
        setFilterState((prev: Filter) => {
          const next = { ...prev };
          if (val === undefined) delete next[key];
          else next[key] = val;
          return next;
        });
      },
      resetFilter: () => setFilterState({}),
      viewMode,
      setViewMode: (m) => {
        if (canToggleViewMode) setViewModeState(m);
      },
      canToggleViewMode,
    }),
    [filter, viewMode, canToggleViewMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilter() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilter must be used inside <FilterProvider>');
  return ctx;
}
