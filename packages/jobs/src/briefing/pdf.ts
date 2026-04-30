// PDF rendering — Puppeteer drives a headless Chromium against the
// HTML template and returns the bytes. When Puppeteer can't launch
// (no Chromium, sandbox restrictions, CI without Docker), we fall back
// to delivering the raw HTML so the briefing still ships and the
// caller can decide whether to retry later.

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import pino from 'pino';

const log = pino({ name: 'jobs/briefing-pdf' });

export interface PdfRenderResult {
  buffer: Uint8Array;
  format: 'pdf' | 'html-fallback';
  bytes: number;
}

export async function renderPdfFromHtml(html: string): Promise<PdfRenderResult> {
  try {
    // Lazy import so the worker can boot without Chromium installed.
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
        printBackground: true,
      });
      return { buffer, format: 'pdf', bytes: buffer.length };
    } finally {
      await browser.close();
    }
  } catch (err) {
    log.warn(
      { err: (err as Error).message },
      'Puppeteer unavailable — falling back to HTML',
    );
    const buffer = new TextEncoder().encode(html);
    return { buffer, format: 'html-fallback', bytes: buffer.length };
  }
}

export async function persistBriefingArtefact(
  buffer: Uint8Array,
  format: 'pdf' | 'html-fallback',
  briefingId: string,
  storageDir: string,
): Promise<string> {
  await mkdir(storageDir, { recursive: true });
  const ext = format === 'pdf' ? 'pdf' : 'html';
  const filePath = path.join(storageDir, `${briefingId}.${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}
