// @painel/jobs — sync orchestration on top of @painel/connectors.

export const JOB_NAMES = {
  syncErp: 'sync-erp',
  syncCrm: 'sync-crm',
  syncMetas: 'sync-metas',
  briefingDiretoria: 'briefing-diretoria',
  alertaDesvio: 'alerta-desvio',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export * from './adapter/upsert-sales';
export * from './adapter/upsert-targets';
export * from './sync/runner';
export * from './sync/jobs';
export * from './queues';
export * from './scheduler';
export * from './connection';
export * from './briefing';
export { configureSlack, postSlack } from './notifications/slack';
export { configureEmail, sendEmail } from './notifications/email';
