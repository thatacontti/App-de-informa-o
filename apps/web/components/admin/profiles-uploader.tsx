'use client';

// Profiles upload UI · /admin/profiles-upload
//
// Three states the operator walks through:
//   1. idle    — pick a file (or paste raw CSV)
//   2. preview — parser stats: total / valid / ignored, distribution per
//                profile, sample of the first 5 rows. "Importar" advances.
//   3. running — serial loop: one upsertOne per row. Live progress bar,
//                live ok/failed counters, "Cancelar" interrupts after the
//                current row. Hits "finished" → final summary panel.
//
// The serial loop runs on the client (driven by the cursor in `progress`)
// and calls upsertOne mutation N times. Each call is a network round-trip
// — the tradeoff is rate-limit safety + accurate progress vs. throughput.
// At ~30 req/s typical, 5k rows finishes in ~3 min.

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc/client';
import {
  CUSTOMER_PROFILE_LABEL,
  type CustomerProfile,
  type ProfilesCsvRow,
  parseProfilesCsv,
} from '@painel/shared';

type UiState = 'idle' | 'preview' | 'running' | 'done';

interface PreviewSummary {
  separator: string;
  totalLines: number;
  validCount: number;
  ignoredCount: number;
  distribution: Record<CustomerProfile, number>;
  sample: ProfilesCsvRow[];
  rows: ProfilesCsvRow[];
  filename: string | null;
}

interface RunProgress {
  cursor: number;
  succeeded: number;
  failed: number;
  failedCodclis: string[];
  cancelled: boolean;
}

const INITIAL_PROGRESS: RunProgress = {
  cursor: 0,
  succeeded: 0,
  failed: 0,
  failedCodclis: [],
  cancelled: false,
};

export function ProfilesUploader() {
  const [state, setState] = useState<UiState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress>(INITIAL_PROGRESS);

  // The cancel flag must outlive a render — useRef escapes the closure
  // captured by the running loop. setProgress alone is async-update.
  const cancelRef = useRef(false);

  const startBatch = trpc.profiles.startBatch.useMutation();
  const upsertOne = trpc.profiles.upsertOne.useMutation();
  const finishBatch = trpc.profiles.finishBatch.useMutation();
  const cancelBatch = trpc.profiles.cancelBatch.useMutation();
  const recent = trpc.profiles.recentBatches.useQuery(undefined, {
    refetchInterval: state === 'running' ? 5000 : false,
  });

  function reset() {
    setState('idle');
    setError(null);
    setPreview(null);
    setBatchId(null);
    setProgress(INITIAL_PROGRESS);
    cancelRef.current = false;
  }

  async function handleFile(file: File) {
    if (file.size > 5_000_000) {
      setError(`Arquivo muito grande (${(file.size / 1_000_000).toFixed(1)} MB). Limite: 5 MB.`);
      return;
    }
    const text = await file.text();
    handleText(text, file.name);
  }

  function handleText(text: string, filename: string | null) {
    setError(null);
    const result = parseProfilesCsv(text);
    if (result.validRows.length === 0) {
      setError(
        `Nenhuma linha válida no CSV (${result.totalLines} linhas lidas, ${result.ignored.length} ignoradas). Confira o cabeçalho.`,
      );
      return;
    }
    setPreview({
      separator: result.separator,
      totalLines: result.totalLines,
      validCount: result.validRows.length,
      ignoredCount: result.ignored.length,
      distribution: result.distribution,
      sample: result.sample,
      rows: result.validRows,
      filename,
    });
    setState('preview');
  }

  async function startImport() {
    if (!preview) return;
    setError(null);
    cancelRef.current = false;
    setProgress(INITIAL_PROGRESS);

    try {
      const { batchId } = await startBatch.mutateAsync({
        filename: preview.filename ?? undefined,
        total: preview.rows.length,
      });
      setBatchId(batchId);
      setState('running');
      void runSerial(batchId, preview.rows);
    } catch (e) {
      setError(`Falha ao abrir o batch: ${(e as Error).message}`);
    }
  }

  async function runSerial(batchId: string, rows: ProfilesCsvRow[]) {
    let succeeded = 0;
    let failed = 0;
    const failedCodclis: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (cancelRef.current) {
        try {
          await cancelBatch.mutateAsync({ batchId });
        } catch {
          /* swallow — cancel is best-effort */
        }
        setProgress({
          cursor: i,
          succeeded,
          failed,
          failedCodclis,
          cancelled: true,
        });
        setState('done');
        return;
      }
      const row = rows[i]!;
      try {
        const r = await upsertOne.mutateAsync({
          batchId,
          codcli: row.codcli,
          profile: row.profile,
        });
        if (r.ok) {
          succeeded++;
        } else {
          failed++;
          if (failedCodclis.length < 50) failedCodclis.push(row.codcli);
        }
      } catch (e) {
        failed++;
        if (failedCodclis.length < 50) failedCodclis.push(row.codcli);
        // Don't break the loop on single-row errors — keep going so the
        // remaining records still land. The metadata on ImportBatch
        // captures the last error message server-side.
        // eslint-disable-next-line no-console
        console.warn(`upsertOne failed for codcli=${row.codcli}`, e);
      }
      setProgress({
        cursor: i + 1,
        succeeded,
        failed,
        failedCodclis: [...failedCodclis],
        cancelled: false,
      });
    }

    try {
      await finishBatch.mutateAsync({
        batchId,
        succeeded,
        failed,
        failedCodclis: failedCodclis.slice(0, 50),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('finishBatch failed', e);
    }
    setState('done');
    void recent.refetch();
  }

  function requestCancel() {
    cancelRef.current = true;
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {state === 'idle' && <IdlePanel onText={handleText} onFile={handleFile} />}

      {state === 'preview' && preview && (
        <PreviewPanel
          preview={preview}
          onCancel={reset}
          onConfirm={startImport}
          starting={startBatch.isPending}
        />
      )}

      {state === 'running' && preview && (
        <RunningPanel
          total={preview.rows.length}
          progress={progress}
          onCancel={requestCancel}
          batchId={batchId}
        />
      )}

      {state === 'done' && preview && (
        <DonePanel
          total={preview.rows.length}
          progress={progress}
          batchId={batchId}
          onAgain={reset}
        />
      )}

      <RecentBatches data={recent.data?.batches ?? []} loading={recent.isLoading} />
    </div>
  );
}

// =====================================================
// Sub-panels
// =====================================================

function IdlePanel({
  onText,
  onFile,
}: {
  onText: (text: string, filename: string | null) => void;
  onFile: (file: File) => void;
}) {
  const [pasted, setPasted] = useState('');
  return (
    <div className="space-y-4 rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
      <div>
        <label className="mb-2 block font-display text-sm font-medium text-deep">
          Selecionar arquivo CSV
        </label>
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = ''; // reset so picking the same file re-fires
          }}
          className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border file:border-amber/30 file:bg-amber/10 file:px-4 file:py-1.5 file:text-xs file:font-medium file:text-terra hover:file:bg-amber/15"
        />
      </div>

      <div className="text-[0.72rem] uppercase tracking-[2px] text-ink-3">ou cole o CSV</div>

      <textarea
        rows={6}
        placeholder={'codcli,perfil\n100,VIP 3+\n200,REGULAR\n300,NOVO 27'}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        className="w-full rounded-xl border border-amber/20 bg-cream/40 p-3 font-mono text-[0.78rem] text-ink-2 focus:border-terra focus:outline-none"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!pasted.trim()}
          onClick={() => onText(pasted, null)}
        >
          Pré-visualizar
        </Button>
      </div>
    </div>
  );
}

function PreviewPanel({
  preview,
  onCancel,
  onConfirm,
  starting,
}: {
  preview: PreviewSummary;
  onCancel: () => void;
  onConfirm: () => void;
  starting: boolean;
}) {
  const sepLabel =
    preview.separator === ',' ? 'vírgula (,)' : preview.separator === ';' ? 'ponto-e-vírgula (;)' : preview.separator === '\t' ? 'tab' : 'pipe (|)';
  const dist = useMemo(
    () =>
      Object.entries(preview.distribution)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]),
    [preview.distribution],
  );

  return (
    <div className="space-y-4 rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Linhas lidas" value={preview.totalLines} />
        <Stat label="Válidas" value={preview.validCount} tone="ok" />
        <Stat label="Ignoradas" value={preview.ignoredCount} tone={preview.ignoredCount > 0 ? 'warn' : 'mute'} />
      </div>

      <div className="text-[0.72rem] text-ink-3">
        Separador detectado: <strong className="text-terra">{sepLabel}</strong>
        {preview.filename && (
          <>
            {' · '}arquivo: <span className="font-mono">{preview.filename}</span>
          </>
        )}
      </div>

      <div>
        <div className="mb-2 font-display text-sm font-medium text-deep">Distribuição por perfil</div>
        <div className="flex flex-wrap gap-2">
          {dist.length === 0 ? (
            <span className="text-[0.78rem] text-ink-3">—</span>
          ) : (
            dist.map(([profile, n]) => (
              <span
                key={profile}
                className="rounded-full bg-amber/12 px-3 py-1 text-[0.72rem] font-medium text-terra"
              >
                {CUSTOMER_PROFILE_LABEL[profile as CustomerProfile]}: <b>{n}</b>
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 font-display text-sm font-medium text-deep">Amostra (5 primeiros)</div>
        <div className="overflow-hidden rounded-xl border border-amber/15">
          <table className="w-full text-[0.78rem]">
            <thead>
              <tr className="bg-beige/40 text-terra">
                <th className="px-3 py-2 text-left font-display italic tracking-wide">linha</th>
                <th className="px-3 py-2 text-left font-display italic tracking-wide">codcli</th>
                <th className="px-3 py-2 text-left font-display italic tracking-wide">perfil</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((r) => (
                <tr key={r.codcli} className="border-t border-amber/10">
                  <td className="px-3 py-2 num-tabular text-ink-3">{r.lineNo}</td>
                  <td className="px-3 py-2 font-mono text-ink-2">{r.codcli}</td>
                  <td className="px-3 py-2 text-ink-2">{CUSTOMER_PROFILE_LABEL[r.profile]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Trocar arquivo
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={starting || preview.validCount === 0}>
          Importar {preview.validCount} {preview.validCount === 1 ? 'registro' : 'registros'}
        </Button>
      </div>
    </div>
  );
}

function RunningPanel({
  total,
  progress,
  onCancel,
  batchId,
}: {
  total: number;
  progress: RunProgress;
  onCancel: () => void;
  batchId: string | null;
}) {
  const pct = total === 0 ? 0 : Math.round((progress.cursor / total) * 100);
  return (
    <div className="space-y-3 rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-medium text-deep">Importando…</div>
          <div className="text-[0.78rem] text-ink-3 font-mono">
            {progress.cursor} de {total} · ok={progress.succeeded} · falhou={progress.failed}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={progress.cancelled}>
          {progress.cancelled ? 'Cancelando…' : 'Cancelar'}
        </Button>
      </div>
      <ProgressBar pct={pct} />
      {batchId && (
        <div className="text-[0.7rem] text-ink-3 font-mono">
          batch: <span className="text-terra">{batchId}</span>
        </div>
      )}
    </div>
  );
}

function DonePanel({
  total,
  progress,
  batchId,
  onAgain,
}: {
  total: number;
  progress: RunProgress;
  batchId: string | null;
  onAgain: () => void;
}) {
  const allOk = progress.failed === 0 && !progress.cancelled;
  return (
    <div className="space-y-4 rounded-2xl border border-amber/15 bg-paper p-7 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-medium text-deep">
            {progress.cancelled
              ? 'Import cancelado'
              : allOk
                ? `${progress.succeeded} registros importados`
                : `${progress.succeeded} ok · ${progress.failed} falharam`}
          </div>
          <div className="text-[0.78rem] text-ink-3 font-mono">
            cursor {progress.cursor}/{total}
            {batchId && (
              <>
                {' · '}batch <span className="text-terra">{batchId}</span>
              </>
            )}
          </div>
        </div>
        <Button size="sm" onClick={onAgain}>
          Novo upload
        </Button>
      </div>

      {progress.failedCodclis.length > 0 && (
        <div>
          <div className="mb-1 text-[0.78rem] font-medium text-rust">
            Codclis que falharam (primeiros {progress.failedCodclis.length}):
          </div>
          <div className="rounded-xl bg-rust/8 p-3 font-mono text-[0.72rem] text-ink-2">
            {progress.failedCodclis.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

function RecentBatches({
  data,
  loading,
}: {
  data: Array<{
    id: string;
    filename: string | null;
    status: string;
    recordsRead: number;
    recordsOk: number;
    recordsFail: number;
    startedAt: Date;
    finishedAt: Date | null;
    errorMessage: string | null;
  }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-amber/15 bg-paper p-5 text-[0.78rem] text-ink-3">
        Carregando histórico…
      </div>
    );
  }
  if (data.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-amber/15 bg-paper shadow-sm">
      <div className="border-b border-amber/10 bg-beige/30 px-5 py-3 font-display text-sm font-medium text-deep">
        Imports recentes
      </div>
      <table className="w-full text-[0.78rem]">
        <thead>
          <tr className="bg-beige/20 text-terra">
            <th className="px-4 py-2 text-left font-display italic tracking-wide">arquivo</th>
            <th className="px-4 py-2 text-left font-display italic tracking-wide">status</th>
            <th className="px-4 py-2 text-right font-display italic tracking-wide">lidas</th>
            <th className="px-4 py-2 text-right font-display italic tracking-wide">ok</th>
            <th className="px-4 py-2 text-right font-display italic tracking-wide">falhou</th>
            <th className="px-4 py-2 text-left font-display italic tracking-wide">início</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.id} className="border-t border-amber/10 hover:bg-beige/15">
              <td className="px-4 py-2 text-ink-2">{b.filename ?? <em className="text-ink-3">—</em>}</td>
              <td className="px-4 py-2">
                <StatusPill status={b.status} />
              </td>
              <td className="px-4 py-2 text-right num-tabular text-ink-2">{b.recordsRead}</td>
              <td className="px-4 py-2 text-right num-tabular text-sage">{b.recordsOk}</td>
              <td className="px-4 py-2 text-right num-tabular text-rust">{b.recordsFail}</td>
              <td className="px-4 py-2 num-tabular text-ink-3">
                {new Date(b.startedAt).toLocaleString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// Atoms
// =====================================================

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'mute';
}) {
  const color =
    tone === 'ok' ? 'text-sage' : tone === 'warn' ? 'text-rust' : tone === 'mute' ? 'text-ink-3' : 'text-deep';
  return (
    <div className="rounded-xl bg-cream/50 px-4 py-3">
      <div className="text-[0.62rem] uppercase tracking-[2px] text-ink-3">{label}</div>
      <div className={`mt-1 font-display text-2xl font-medium num-tabular ${color}`}>{value}</div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-beige">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber via-terra to-deep transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    RUNNING: 'bg-amber/20 text-terra',
    SUCCESS: 'bg-sage/20 text-sage',
    FAILED: 'bg-rust/20 text-rust',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider ${map[status] ?? 'bg-ink-3/10 text-ink-3'}`}
    >
      {status}
    </span>
  );
}

