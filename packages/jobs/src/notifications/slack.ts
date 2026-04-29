// Slack notification helper — delivers via @slack/web-api when a token
// is configured, otherwise emits a structured log line so the message
// is observable in dev without external dependencies.

import { WebClient } from '@slack/web-api';
import pino from 'pino';

const log = pino({ name: 'jobs/slack' });

export interface SlackPostOptions {
  channel?: string;
  text: string;
  blocks?: unknown[];
}

let client: WebClient | null = null;
let resolvedChannel: string | undefined;

export function configureSlack(opts: { token?: string; defaultChannel?: string }) {
  resolvedChannel = opts.defaultChannel;
  client = opts.token ? new WebClient(opts.token) : null;
}

export async function postSlack(opts: SlackPostOptions): Promise<{ delivered: boolean }> {
  const channel = opts.channel ?? resolvedChannel;
  if (!client || !channel) {
    log.info({ channel, text: opts.text, mode: 'noop' }, 'slack message (mock mode)');
    return { delivered: false };
  }
  await client.chat.postMessage({ channel, text: opts.text, blocks: opts.blocks as never });
  return { delivered: true };
}
