// Standalone BullMQ worker entry point. Runs as a long-living process
// alongside the Next.js app — `pnpm --filter @painel/jobs worker` in
// dev, or a separate Docker service in production.

import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { configureSlack } from './notifications/slack';
import { configureEmail } from './notifications/email';
import { makeRedisConnection } from './connection';
import { createSyncQueue, createSyncWorker } from './queues';
import { registerScheduledSyncs } from './scheduler';

const log = pino({ name: 'jobs/worker' });

async function main() {
  const env = {
    redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    databaseUrl: process.env['DATABASE_URL'],
    useMock: process.env['USE_MOCK_CONNECTORS'] !== 'false',
    slackToken: process.env['SLACK_BOT_TOKEN'],
    slackAlertsChannel: process.env['SLACK_CHANNEL_ALERTS'],
    smtpHost: process.env['SMTP_HOST'],
    smtpUser: process.env['SMTP_USER'],
    smtpPass: process.env['SMTP_PASS'],
    smtpFrom: process.env['SMTP_FROM'],
  };
  if (!env.databaseUrl) throw new Error('DATABASE_URL is required');

  configureSlack({ token: env.slackToken, defaultChannel: env.slackAlertsChannel });
  configureEmail({
    host: env.smtpHost,
    user: env.smtpUser,
    pass: env.smtpPass,
    from: env.smtpFrom,
  });

  const db = new PrismaClient();
  const connection = makeRedisConnection(env.redisUrl);
  const queue = createSyncQueue(connection);
  const worker = createSyncWorker(db, connection, { useMock: env.useMock });

  worker.on('ready', () => log.info('worker ready'));
  worker.on('completed', (job) =>
    log.info({ jobId: job.id, name: job.name, dataSourceId: job.data.dataSourceId }, 'job completed'),
  );
  worker.on('failed', (job, err) =>
    log.error(
      { jobId: job?.id, name: job?.name, dataSourceId: job?.data?.dataSourceId, err: err.message },
      'job failed',
    ),
  );

  const { registered } = await registerScheduledSyncs(db, queue);
  log.info({ registered }, 'scheduled syncs registered');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    await worker.close();
    await queue.close();
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
