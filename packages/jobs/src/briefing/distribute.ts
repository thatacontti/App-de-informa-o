// Briefing distribution — emails the artefact + posts the headlines
// digest to Slack. Both are best-effort: a transport in mock mode
// (no SMTP creds / no Slack token) returns delivered=false and we
// keep going.

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { postSlack } from '../notifications/slack';
import { sendEmail } from '../notifications/email';
import type { BriefingPayload } from './engine';

export interface DistributeOptions {
  pdfPath?: string;
  format?: 'pdf' | 'html-fallback';
  slackChannel?: string;
}

export interface DistributeResult {
  email: { delivered: boolean; recipients: number };
  slack: { delivered: boolean; channel?: string };
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export async function distributeBriefing(
  db: PrismaClient,
  payload: BriefingPayload,
  opts: DistributeOptions = {},
): Promise<DistributeResult> {
  // ---- email ----
  const recipients = await db.user.findMany({
    where: { active: true, role: { in: ['ADMIN', 'GESTOR'] } },
    select: { email: true },
  });

  let emailDelivered = false;
  if (recipients.length > 0) {
    const subject = `Briefing diretoria · V27 · ${formatDateLabel(payload.generatedAt)}`;
    const html = renderEmailHtml(payload);
    const text = renderEmailText(payload);
    const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
    if (opts.pdfPath) {
      try {
        const ext = opts.format === 'pdf' ? 'pdf' : 'html';
        attachments.push({
          filename: `briefing-v27-${formatDateSlug(payload.generatedAt)}.${ext}`,
          content: Buffer.from(readFileSync(opts.pdfPath)),
          contentType: ext === 'pdf' ? 'application/pdf' : 'text/html',
        });
      } catch {
        // Artefact missing — ship the message without attachment.
      }
    }
    const r = await sendEmail({
      to: recipients.map((u) => u.email),
      subject,
      text,
      html,
      attachments,
    });
    emailDelivered = r.delivered;
  }

  // ---- Slack ----
  const slack = await postSlack({
    channel: opts.slackChannel,
    text: `📊 *Briefing diretoria · V27* — ${formatDateLabel(payload.generatedAt)}`,
    blocks: buildSlackBlocks(payload),
  });

  return {
    email: { delivered: emailDelivered, recipients: recipients.length },
    slack: { delivered: slack.delivered, channel: opts.slackChannel },
  };
}

function buildSlackBlocks(payload: BriefingPayload): unknown[] {
  const lines = [
    `*KPIs* · ${fmtBRL(payload.kpis.faturamento)} · ${fmtPct(payload.kpis.sssYoY)} SSS · meta ${payload.kpis.globalAttainmentPct.toFixed(1)}%`,
    '',
    '*Headlines:*',
    ...payload.headlines.map((h) => `• *${h.title}* — _${h.value}_ · ${h.detail}`),
  ];
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Briefing V27* — ${formatDateLabel(payload.generatedAt)}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    },
  ];
}

function renderEmailHtml(payload: BriefingPayload): string {
  return `<div style="font-family:Arial,sans-serif;color:#1a0f0a;line-height:1.55;max-width:640px;margin:0 auto">
    <h1 style="font-family:Georgia,serif;color:#4a1f25;margin-bottom:6px">Briefing V27 · ${formatDateLabel(payload.generatedAt)}</h1>
    <p style="color:#4a3a2f">Headlines da semana:</p>
    <ul>${payload.headlines.map((h) => `<li><b>${h.title}</b> — ${h.value} · ${h.detail}</li>`).join('')}</ul>
    <p style="color:#4a3a2f">SSS YoY (recorrentes): <b>${fmtPct(payload.kpis.sssYoY)}</b> · faturamento V27: <b>${fmtBRL(payload.kpis.faturamento)}</b> · atingimento meta: <b>${payload.kpis.globalAttainmentPct.toFixed(1)}%</b></p>
    <p style="color:#8a7f74;font-size:12px;font-style:italic;margin-top:24px">Painel V27 · documento confidencial · gerado automaticamente.</p>
  </div>`;
}

function renderEmailText(payload: BriefingPayload): string {
  return [
    `Briefing V27 — ${formatDateLabel(payload.generatedAt)}`,
    '',
    'Headlines:',
    ...payload.headlines.map((h) => `  • ${h.title}: ${h.value} (${h.detail})`),
    '',
    `SSS YoY: ${fmtPct(payload.kpis.sssYoY)}`,
    `Faturamento V27: ${fmtBRL(payload.kpis.faturamento)}`,
    `Atingimento meta: ${payload.kpis.globalAttainmentPct.toFixed(1)}%`,
    '',
    'Painel V27 · documento confidencial.',
  ].join('\n');
}

function formatDateLabel(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function formatDateSlug(d: Date): string {
  return d.toISOString().slice(0, 10);
}

void path;
