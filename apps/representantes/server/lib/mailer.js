// Notificações por e-mail (fluxo de aprovação). Se o SMTP não estiver
// configurado no .env, as mensagens são apenas logadas no console
// (comportamento previsto no CLAUDE_SPEC.md §M4).
import nodemailer from 'nodemailer';

const HOST = process.env.SMTP_HOST || '';
const PORT = Number(process.env.SMTP_PORT || 587);
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const FROM = process.env.SMTP_FROM || 'representantes@grupocatarina.com';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'thatiane.marques@grupocatarina.com';

let transporter = null;
if (HOST) {
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: USER ? { user: USER, pass: PASS } : undefined,
  });
}

/**
 * Envia (ou loga) uma notificação. Nunca lança: falha de e-mail não pode
 * derrubar a resposta da API.
 * @param {{to:(string|string[]), subject:string, text:string}} msg
 */
export async function notify({ to, subject, text }) {
  const dest = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (dest.length === 0) return;
  if (!transporter) {
    console.log(`[mail:console] para=${dest.join(', ')} | ${subject}\n${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to: dest.join(', '), subject, text });
    console.log(`[mail] enviado para ${dest.join(', ')}: ${subject}`);
  } catch (e) {
    console.error(`[mail] falha ao enviar (${subject}): ${e.message}`);
  }
}
