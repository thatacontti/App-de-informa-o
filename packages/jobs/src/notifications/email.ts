// Email helper backed by Nodemailer. Uses a JSON transport (no I/O) when
// SMTP credentials are missing — keeps dev environments quiet but
// observable.

import nodemailer, { type Transporter } from 'nodemailer';
import pino from 'pino';

const log = pino({ name: 'jobs/email' });

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

let transporter: Transporter | null = null;
let from = 'painel@catarina.local';

export function configureEmail(opts: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
}) {
  if (opts.from) from = opts.from;
  if (!opts.host || !opts.user || !opts.pass) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    log.warn('SMTP credentials missing — using JSON transport (no email leaves the box)');
    return;
  }
  transporter = nodemailer.createTransport({
    host: opts.host,
    port: opts.port ?? 587,
    secure: false,
    auth: { user: opts.user, pass: opts.pass },
  });
}

export async function sendEmail(opts: EmailOptions): Promise<{ delivered: boolean }> {
  if (!transporter) configureEmail({});
  const info = await transporter!.sendMail({
    from,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  });
  // jsonTransport returns the message envelope serialised — log it.
  if (typeof (info as { message?: string }).message === 'string') {
    log.info({ to: opts.to, subject: opts.subject, mode: 'noop' }, 'email (mock transport)');
    return { delivered: false };
  }
  return { delivered: true };
}
