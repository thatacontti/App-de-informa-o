// @painel/jobs — BullMQ workers for ERP/CRM/XLSX sync, weekly briefing
// and real-time goal-deviation alerts. Implementations land in step 5.

export const JOB_NAMES = {
  syncErp: 'sync-erp',
  syncCrm: 'sync-crm',
  syncMetas: 'sync-metas',
  briefingDiretoria: 'briefing-diretoria',
  alertaDesvio: 'alerta-desvio',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
