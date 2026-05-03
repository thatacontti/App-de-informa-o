'use client';

import { useState } from 'react';
import type { Role } from '@painel/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc/client';
import { can } from '@/lib/permissions';

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'bg-amber/20 text-terra',
  SUCCESS: 'bg-sage/20 text-sage',
  FAILED: 'bg-rust/20 text-rust',
};

function relative(d: Date | null) {
  if (!d) return 'nunca';
  const diffMs = Date.now() - new Date(d).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `${min} min atrás`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} h atrás`;
  return `${Math.floor(min / (60 * 24))} d atrás`;
}

function formatType(t: string) {
  if (t === 'ERP_DB') return 'ERP · Postgres';
  if (t === 'CRM_API') return 'CRM · REST';
  if (t === 'XLSX') return 'SharePoint · XLSX';
  if (t === 'CSV_HISTORICO') return 'CSV · Histórico';
  if (t === 'BASE44_API') return 'Base44 · API';
  return t;
}

export function DataSourcesTable({ role }: { role: Role }) {
  // Auto-refresh every 3s while any sync is in-flight so the user sees
  // the RUNNING → SUCCESS/FAILED transition without manual reload.
  const sources = trpc.dataSources.list.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      const anyRunning = data?.sources?.some(
        (s) => s.lastSyncStatus === 'RUNNING' || s.syncs[0]?.status === 'RUNNING',
      );
      return anyRunning ? 3000 : false;
    },
  });
  const test = trpc.dataSources.testConnection.useMutation();
  const trigger = trpc.dataSources.triggerSync.useMutation();
  const enqueue = trpc.dataSources.enqueueSync.useMutation();
  const reclassify = trpc.dataSources.reclassifyProfiles.useMutation();
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const canTrigger = can(role, 'admin:trigger-sync');

  if (sources.isLoading) {
    return <div className="rounded-2xl border border-amber/15 bg-paper p-7 text-sm text-ink-3">Carregando fontes…</div>;
  }
  if (sources.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Erro ao carregar fontes: {sources.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <Alert variant={feedback.ok ? 'success' : 'destructive'}>
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-2xl border border-amber/15 bg-paper shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-beige/40">
              <th className="px-4 py-3 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Fonte</th>
              <th className="px-4 py-3 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Tipo</th>
              <th className="px-4 py-3 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Frequência</th>
              <th className="px-4 py-3 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Última sync</th>
              <th className="px-4 py-3 text-left font-display italic text-[0.72rem] tracking-wide text-terra">Status</th>
              <th className="px-4 py-3 text-right font-display italic text-[0.72rem] tracking-wide text-terra">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sources.data?.sources.map((s) => {
              const lastRun = s.syncs[0];
              const status = s.lastSyncStatus ?? lastRun?.status ?? '—';
              return (
                <tr key={s.id} className="border-t border-amber/10 hover:bg-beige/20">
                  <td className="px-4 py-3">
                    <div className="font-medium text-deep">{s.name}</div>
                    <div className="text-[0.7rem] text-ink-3 font-mono break-all">{s.endpoint}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{formatType(s.type)}</td>
                  <td className="px-4 py-3 text-ink-2 num-tabular">{s.frequencyMinutes} min</td>
                  <td className="px-4 py-3 text-ink-2 num-tabular">{relative(s.lastSyncAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider ${STATUS_COLOR[status] ?? 'bg-ink-3/10 text-ink-3'}`}
                    >
                      {status}
                    </span>
                    {s.lastSyncError && (
                      <div className="mt-1 max-w-md truncate text-[0.66rem] text-rust" title={s.lastSyncError}>
                        {s.lastSyncError}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={test.isPending}
                        onClick={async () => {
                          test.reset();
                          const r = await test.mutateAsync({ dataSourceId: s.id });
                          setFeedback({
                            id: s.id,
                            ok: r.ok,
                            msg: r.ok
                              ? `${s.name}: ${r.detail ?? 'conexão OK'}`
                              : `${s.name}: ${r.error ?? 'falhou'}`,
                          });
                        }}
                      >
                        Testar
                      </Button>
                      {canTrigger && (s.type === 'CSV_HISTORICO' || s.type === 'BASE44_API') && (
                        // Heavy historic loads (~100k rows/file) always go
                        // through BullMQ — the HTTP request would time out
                        // before the inline upsert finished.
                        <Button
                          size="sm"
                          disabled={enqueue.isPending}
                          onClick={async () => {
                            enqueue.reset();
                            try {
                              const r = await enqueue.mutateAsync({ dataSourceId: s.id });
                              setFeedback({
                                id: s.id,
                                ok: true,
                                msg: `${s.name}: enfileirado (job ${r.jobId}). A tabela atualiza sozinha.`,
                              });
                              await sources.refetch();
                            } catch (e) {
                              setFeedback({
                                id: s.id,
                                ok: false,
                                msg: `${s.name}: ${(e as Error).message}`,
                              });
                            }
                          }}
                        >
                          Enfileirar
                        </Button>
                      )}
                      {canTrigger && s.type !== 'CSV_HISTORICO' && s.type !== 'BASE44_API' && (
                        <Button
                          size="sm"
                          disabled={trigger.isPending}
                          onClick={async () => {
                            trigger.reset();
                            try {
                              const r = await trigger.mutateAsync({ dataSourceId: s.id });
                              setFeedback({
                                id: s.id,
                                ok: r.status === 'SUCCESS',
                                msg:
                                  r.status === 'SUCCESS'
                                    ? `${s.name}: ${r.recordsIn} → ${r.recordsOut} registros · ${r.durationMs} ms`
                                    : `${s.name}: ${r.errorMessage ?? 'falhou'}`,
                              });
                              await sources.refetch();
                            } catch (e) {
                              setFeedback({
                                id: s.id,
                                ok: false,
                                msg: `${s.name}: ${(e as Error).message}`,
                              });
                            }
                          }}
                        >
                          Sincronizar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canTrigger && (
        <div className="flex items-center justify-between rounded-2xl border border-amber/15 bg-paper px-5 py-3.5">
          <div>
            <div className="font-medium text-deep">Reclassificar perfis de cliente</div>
            <div className="text-[0.78rem] text-ink-3">
              Recalcula <b>CustomerProfile</b> (VIP_3PLUS / VIP / FREQUENTE / REGULAR / NOVO_25 /
              NOVO_27) a partir do histórico ingerido. Use após carregar uma coleção nova.
            </div>
          </div>
          <Button
            size="sm"
            disabled={reclassify.isPending}
            onClick={async () => {
              reclassify.reset();
              try {
                const r = await reclassify.mutateAsync(undefined);
                const dist = Object.entries(r.byProfile)
                  .filter(([, n]) => n > 0)
                  .map(([p, n]) => `${p}=${n}`)
                  .join(' · ');
                setFeedback({
                  id: '_classify',
                  ok: true,
                  msg: `${r.totalCustomers} clientes · ${r.changed} reclassificados (${r.current ?? '—'} vs ${r.previous ?? '—'}). ${dist}`,
                });
              } catch (e) {
                setFeedback({
                  id: '_classify',
                  ok: false,
                  msg: `Falha: ${(e as Error).message}`,
                });
              }
            }}
          >
            Reclassificar
          </Button>
        </div>
      )}

      <div className="rounded-xl bg-beige/30 px-4 py-3 text-[0.72rem] text-ink-3">
        <strong className="text-terra">Modo mock</strong> · As 3 fontes leem de
        <code className="mx-1 rounded bg-paper px-1.5 py-0.5 font-mono text-terra">painel_v27/d_v12.json</code>
        enquanto <code className="font-mono">USE_MOCK_CONNECTORS=true</code>. Para alternar para ERP/CRM/SharePoint reais,
        ajuste a env e redeploye o worker.
      </div>
    </div>
  );
}
