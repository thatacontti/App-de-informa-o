'use client';

import { fmtBRL, fmtNum } from '@painel/shared';
import { useFilter } from '@/lib/filter-context';

interface KpiData {
  faturamento: number;
  qtd: number;
  pm: number;
  skus: number;
  clientes: number;
  pedidos: number;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi-card relative overflow-hidden rounded-[14px] border border-amber/15 bg-paper px-[18px] py-4 shadow-[0_3px_12px_-3px_rgba(139,74,82,0.08)] transition-transform hover:-translate-y-0.5">
      <span className="absolute left-0 top-0 h-[3px] w-10 bg-kpi-stripe" />
      <div className="font-display italic text-[0.75rem] font-normal text-ink-3">{label}</div>
      <div className="mt-1 font-display text-[1.55rem] font-semibold leading-none text-deep num-tabular">
        {value}
      </div>
      {sub && <div className="mt-1 text-[0.72rem] text-ink-3">{sub}</div>}
    </div>
  );
}

export function KpiCards({ data }: { data: KpiData }) {
  const { viewMode } = useFilter();

  if (viewMode === 'DIRETORIA') {
    return (
      <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Card label="Faturamento" value={fmtBRL(data.faturamento)} />
        <Card label="Peças" value={fmtNum(data.qtd)} sub={`PM ${fmtBRL(data.pm)}`} />
        <Card label="SKUs" value={String(data.skus)} />
        <Card label="Clientes" value={String(data.clientes)} />
        <Card label="Pedidos" value={fmtNum(data.pedidos)} />
      </div>
    );
  }
  return (
    <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      <Card label="Peças" value={fmtNum(data.qtd)} />
      <Card label="SKUs" value={String(data.skus)} />
      <Card label="Clientes" value={String(data.clientes)} />
      <Card label="Pedidos" value={fmtNum(data.pedidos)} />
      <Card label="PM unitário" value={fmtBRL(data.pm)} />
    </div>
  );
}
