'use client';

import {
  BRAND_LABEL,
  BRANDS,
  LINES,
  LINE_LABEL,
  PRICE_TIERS,
  PRICE_TIER_LABEL,
  formatCollectionLabel,
  type Brand,
  type Filter,
  type ProductLine,
  type PriceTier,
} from '@painel/shared';
import { trpc } from '@/lib/trpc/client';
import { useFilter } from '@/lib/filter-context';
import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}
function Chip({ label, active, onClick, title }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full border px-3 py-[5px] text-[0.74rem] font-medium tracking-tight transition-colors',
        active
          ? 'bg-deep border-deep text-paper shadow-[0_2px_8px_rgba(74,31,37,0.25)]'
          : 'border-terra/20 bg-transparent text-ink-2 hover:border-terra hover:bg-amber/10 hover:text-terra',
      )}
    >
      {label}
    </button>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 last:mb-0">
      <span className="w-[100px] flex-shrink-0 font-display italic text-[0.78rem] font-medium text-terra">
        {label}
      </span>
      {children}
    </div>
  );
}

const SHORT_REP = (s: string) =>
  s
    .replace(
      /(LTDA|ME|EIRELI|REPRESENTACOES?|REPRESENTAÇÃO|REPRESENTAÇÕES|COMERCIAIS?|PRODUTOS|TEXTEIS?)/gi,
      '',
    )
    .replace(/[^\w]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .slice(0, 18) || s.slice(0, 16);

export function FilterBar() {
  const { filter, setFilter } = useFilter();
  const meta = trpc.meta.filterOptions.useQuery();

  return (
    <div className="sticky top-[57px] z-20 bg-cream/85 px-9 pb-3 pt-3 backdrop-blur">
      <div className="mx-auto max-w-[1500px]">
        <div className="rounded-2xl border border-amber/15 bg-paper px-5 py-3 shadow-[0_8px_32px_-8px_rgba(139,74,82,0.15),0_2px_6px_rgba(139,74,82,0.04)]">
          <Group label="Marca">
            <Chip
              label="Todas"
              active={filter.brand === undefined}
              onClick={() => setFilter('brand', undefined)}
            />
            {BRANDS.map((b: Brand) => (
              <Chip
                key={b}
                label={BRAND_LABEL[b]}
                active={filter.brand === b}
                onClick={() => setFilter('brand', filter.brand === b ? undefined : b)}
              />
            ))}
          </Group>

          <Group label="Estado">
            <Chip
              label="Todos"
              active={filter.ufId === undefined}
              onClick={() => setFilter('ufId', undefined)}
            />
            {(meta.data?.ufIds ?? []).map((u) => (
              <Chip
                key={u}
                label={u}
                active={filter.ufId === u}
                onClick={() => setFilter('ufId', filter.ufId === u ? undefined : u)}
              />
            ))}
          </Group>

          <Group label="Representante">
            <Chip
              label="Todos"
              active={filter.repId === undefined}
              onClick={() => setFilter('repId', undefined)}
            />
            {(meta.data?.reps ?? []).map((r) => (
              <Chip
                key={r.id}
                label={r.shortName ?? SHORT_REP(r.fullName)}
                title={r.fullName}
                active={filter.repId === r.id}
                onClick={() => setFilter('repId', filter.repId === r.id ? undefined : r.id)}
              />
            ))}
          </Group>

          <Group label="Tipo Produto">
            <Chip
              label="Todos"
              active={filter.productGroup === undefined}
              onClick={() => setFilter('productGroup', undefined)}
            />
            {(meta.data?.productGroups ?? []).map((g) => (
              <Chip
                key={g}
                label={g.length > 18 ? `${g.slice(0, 18)}…` : g}
                title={g}
                active={filter.productGroup === g}
                onClick={() => setFilter('productGroup', filter.productGroup === g ? undefined : g)}
              />
            ))}
          </Group>

          <Group label="Linha / Idade">
            <Chip
              label="Todas"
              active={filter.line === undefined}
              onClick={() => setFilter('line', undefined)}
            />
            {LINES.map((l: ProductLine) => (
              <Chip
                key={l}
                label={LINE_LABEL[l]}
                active={filter.line === l}
                onClick={() => setFilter('line', filter.line === l ? undefined : l)}
              />
            ))}
          </Group>

          <Group label="Faixa Preço">
            <Chip
              label="Todas"
              active={filter.priceTier === undefined}
              onClick={() => setFilter('priceTier', undefined)}
            />
            {PRICE_TIERS.map((t: PriceTier) => (
              <Chip
                key={t}
                label={PRICE_TIER_LABEL[t]}
                active={filter.priceTier === t}
                onClick={() => setFilter('priceTier', filter.priceTier === t ? undefined : t)}
              />
            ))}
          </Group>

          {(meta.data?.collections ?? []).length > 0 && (
            <Group label="Coleção">
              <Chip
                label="Todas"
                active={filter.collection === undefined}
                onClick={() => setFilter('collection', undefined)}
              />
              {(meta.data?.collections ?? []).map((c) => (
                <Chip
                  key={c}
                  label={formatCollectionLabel(c)}
                  title={c}
                  active={filter.collection === c}
                  onClick={() =>
                    setFilter('collection', filter.collection === c ? undefined : c)
                  }
                />
              ))}
            </Group>
          )}

          {/* Comparar com: aparece quando há mais de uma coleção pra
              comparar e o usuário já escolheu uma como recorte. SSS /
              YoY usam a coleção escolhida como baseline (substitui o
              V26 padrão). */}
          {(meta.data?.collections ?? []).length > 1 && filter.collection && (
            <Group label="Comparar com">
              <Chip
                label="V26 (padrão)"
                title="usa CustomerBrandRevenue period=V26 como baseline"
                active={filter.compareCollection === undefined}
                onClick={() => setFilter('compareCollection', undefined)}
              />
              {(meta.data?.collections ?? [])
                .filter((c) => c !== filter.collection)
                .map((c) => (
                  <Chip
                    key={c}
                    label={formatCollectionLabel(c)}
                    title={c}
                    active={filter.compareCollection === c}
                    onClick={() =>
                      setFilter(
                        'compareCollection',
                        filter.compareCollection === c ? undefined : c,
                      )
                    }
                  />
                ))}
            </Group>
          )}
        </div>
      </div>
    </div>
  );
}
