'use client';

import { useFilter } from '@/lib/filter-context';
import { cn } from '@/lib/utils';

export function ViewModeToggle() {
  const { viewMode, setViewMode, canToggleViewMode } = useFilter();

  if (!canToggleViewMode) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-amber/30 bg-deep/40 px-3 py-1 text-[0.62rem] uppercase tracking-[1.5px] text-amber/90">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        Peças
      </div>
    );
  }

  return (
    <div className="flex items-center rounded-full border border-amber/30 bg-deep/30 p-0.5 text-[0.66rem] font-bold uppercase tracking-wider">
      <button
        type="button"
        onClick={() => setViewMode('DIRETORIA')}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          viewMode === 'DIRETORIA' ? 'bg-amber text-deep' : 'text-amber/80 hover:text-amber',
        )}
      >
        R$
      </button>
      <button
        type="button"
        onClick={() => setViewMode('PRODUTO')}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          viewMode === 'PRODUTO' ? 'bg-amber text-deep' : 'text-amber/80 hover:text-amber',
        )}
      >
        Peças
      </button>
    </div>
  );
}
