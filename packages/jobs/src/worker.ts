// Standalone BullMQ worker entry point. Runs as a long-living process
// alongside the Next.js app — `pnpm --filter @painel/jobs worker` in
// dev, or a separate Docker service in production.

import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { configureSlack } from './notifications/slack';
import { configureEmail } from './notifications/email';
import { makeRedisConnection } from './connection';
import { createBriefingQueue, createBriefingWorker, createSyncQueue, createSyncWorker } from './queues';
import { registerScheduledSyncs, scheduleWeeklyBriefing } from './scheduler';

const log = pino({ name: 'jobs/worker' });

async function main() {
  const env = {
    redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    databaseUrl: process.env['DATABASE_URL'],
    useMock: process.env['USE_MOCK_CONNECTORS'] !== 'false',
    slackToken: process.env['SLACK_BOT_TOKEN'],
    slackAlertsChannel: process.env['SLACK_CHANNEL_ALERTS'],
    slackDiretoriaChannel: process.env['SLACK_CHANNEL_DIRETORIA'],
    smtpHost: process.env['SMTP_HOST'],
    smtpPort: process.env['SMTP_PORT'] ? Number(process.env['SMTP_PORT']) : undefined,
    smtpUser: process.env['SMTP_USER'],
    smtpPass: process.env['SMTP_PASS'],
    smtpFrom: process.env['SMTP_FROM'],
  };
  if (!env.databaseUrl) throw new Error('DATABASE_URL is required');

  configureSlack({ token: env.slackToken, defaultChannel: env.slackAlertsChannel });
  configureEmail({
    host: env.smtpHost,
    port: env.smtpPort,
    user: env.smtpUser,
    pass: env.smtpPass,
    from: env.smtpFrom,
  });

  const db = new PrismaClient();
  const connection = makeRedisConnection(env.redisUrl);
  const syncQueue = createSyncQueue(connection);
  const briefingQueue = createBriefingQueue(connection);
  const syncWorker = createSyncWorker(db, connection, { useMock: env.useMock });
  const briefingWorker = createBriefingWorker(db, connection, {
    slackChannel: env.slackDiretoriaChannel,
  });

  for (const w of [syncWorker, briefingWorker]) {
    w.on('ready', () => log.info({ name: w.name }, 'worker ready'));
    w.on('completed', (job) => log.info({ jobId: job.id, name: job.name }, 'job completed'));
    w.on('failed', (job, err) =>
      log.error({ jobId: job?.id, name: job?.name, err: err.message }, 'job failed'),
    );
  }

  const { registered } = await registerScheduledSyncs(db, syncQueue);
  log.info({ registered }, 'scheduled syncs registered');
  await scheduleWeeklyBriefing(briefingQueue);
  log.info('weekly briefing scheduled (Mon 07:00)');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    await Promise.all([syncWorker.close(), briefingWorker.close()]);
    await Promise.all([syncQueue.close(), briefingQueue.close()]);
    await connection.quit();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  log.error({ err: (e as Error).message }, 'worker bootstrap failed');
  process.exit(1);
});
