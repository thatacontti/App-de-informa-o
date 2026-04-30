'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export function BriefingButton() {
  const latest = trpc.briefing.latest.useQuery();
  const regenerate = trpc.briefing.regenerate.useMutation();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleClick = async () => {
    setFeedback('gerando…');
    try {
      const r = await regenerate.mutateAsync({});
      await latest.refetch();
      const url = `/api/briefing/${r.briefingId}/pdf`;
      window.open(url, '_blank');
      setFeedback(r.format === 'pdf' ? 'PDF gerado' : 'HTML (Puppeteer offline)');
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      setFeedback(`erro: ${(e as Error).message}`);
    }
  };

  const openLatest = async () => {
    if (!latest.data?.snapshot) return;
    window.open(`/api/briefing/${latest.data.snapshot.id}/pdf`, '_blank');
  };

  return (
    <div className="flex items-center gap-2">
      {latest.data?.snapshot && (
        <button
          type="button"
          onClick={openLatest}
          className="rounded-full border border-amber/30 px-3 py-1 text-[0.7rem] font-medium text-amber transition-colors hover:border-amber hover:bg-amber/10"
        >
          Último briefing
        </button>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={regenerate.isPending}
        className="rounded-full bg-amber px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-deep transition-colors hover:bg-amber/90 disabled:opacity-60"
      >
        {regenerate.isPending ? 'Gerando…' : 'Exportar PDF'}
      </button>
      {feedback && <span className="text-[0.66rem] italic text-amber/80">{feedback}</span>}
    </div>
  );
}
