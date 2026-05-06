// CSV parser for the /admin/profiles-upload pipeline.
//
// Input:  raw CSV text where each line maps a customer code (codcli) to
//         a CustomerProfile label. Header row is required.
// Output: structured rows + stats + per-profile distribution + a small
//         sample for the preview UI.
//
// Supported separators (auto-detected, in order): `;`, `,`, `\t`, `|`.
// Detection picks whichever yields the most columns on the header line.
//
// Header aliases (case-insensitive, accent-insensitive):
//   codcli   ← codcli, codigo, código, code, customer, cliente, id
//   profile  ← profile, perfil, classification, classificacao, classificação
//
// Profile aliases (case-insensitive, accent-insensitive, trimmed):
//   VIP_3PLUS  ← "VIP 3+", "VIP3+", "VIP_3PLUS", "VIP 3 PLUS", "VIP_3+"
//   VIP        ← "VIP"
//   FREQUENTE  ← "FREQUENTE", "FREQUENT"
//   REGULAR    ← "REGULAR"
//   NOVO_25    ← "NOVO 25", "NOVO25", "NOVO_25", "NEW 25"
//   NOVO_27    ← "NOVO 27", "NOVO27", "NOVO_27", "NEW 27"

import type { CustomerProfile } from './index';
import { CUSTOMER_PROFILES } from './index';

export type CsvSeparator = ',' | ';' | '\t' | '|';

export interface ProfilesCsvRow {
  /** 1-based source line number (after the header). */
  lineNo: number;
  codcli: string;
  profile: CustomerProfile;
}

export interface ProfilesCsvIgnored {
  lineNo: number;
  raw: string;
  reason: 'empty' | 'missing-codcli' | 'unknown-profile' | 'duplicate-codcli';
  hint?: string;
}

export interface ProfilesCsvParseResult {
  separator: CsvSeparator;
  totalLines: number;
  validRows: ProfilesCsvRow[];
  ignored: ProfilesCsvIgnored[];
  /** count per CustomerProfile (always carries every key, may be 0). */
  distribution: Record<CustomerProfile, number>;
  /** first 5 valid rows for the preview panel. */
  sample: ProfilesCsvRow[];
}

const HEADER_CODCLI_ALIASES = new Set(
  ['codcli', 'codigo', 'code', 'customer', 'cliente', 'id'].map((s) => s.toLowerCase()),
);
const HEADER_PROFILE_ALIASES = new Set(
  ['profile', 'perfil', 'classification', 'classificacao'].map((s) => s.toLowerCase()),
);

const PROFILE_ALIAS: Record<string, CustomerProfile> = {
  vip3plus: 'VIP_3PLUS',
  'vip3+': 'VIP_3PLUS',
  vip_3plus: 'VIP_3PLUS',
  'vip 3+': 'VIP_3PLUS',
  'vip 3 plus': 'VIP_3PLUS',
  'vip 3+ ': 'VIP_3PLUS',
  vip: 'VIP',
  frequente: 'FREQUENTE',
  frequent: 'FREQUENTE',
  regular: 'REGULAR',
  'novo 25': 'NOVO_25',
  novo25: 'NOVO_25',
  novo_25: 'NOVO_25',
  'new 25': 'NOVO_25',
  'novo 27': 'NOVO_27',
  novo27: 'NOVO_27',
  novo_27: 'NOVO_27',
  'new 27': 'NOVO_27',
};

const SEPARATORS: ReadonlyArray<CsvSeparator> = [';', ',', '\t', '|'];

function stripDiacritics(s: string): string {
  // Removes combining marks (U+0300..U+036F) — accents become noise.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalize(s: string): string {
  return stripDiacritics(s).trim().toLowerCase();
}

function detectSeparator(headerLine: string): CsvSeparator {
  let best: CsvSeparator = ',';
  let bestCount = -1;
  for (const sep of SEPARATORS) {
    const count = headerLine.split(sep).length;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

function splitLine(line: string, sep: CsvSeparator): string[] {
  // Handles a basic flavor of CSV quoting: a column wrapped in double
  // quotes can contain the separator. We don't try to handle escaped
  // quotes (`""`) — the upstream is the customer's spreadsheet, not RFC-4180.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function emptyDistribution(): Record<CustomerProfile, number> {
  const d = {} as Record<CustomerProfile, number>;
  for (const p of CUSTOMER_PROFILES) d[p] = 0;
  return d;
}

export function normalizeProfileLabel(raw: string): CustomerProfile | null {
  const norm = normalize(raw).replace(/\s+/g, ' ');
  if (PROFILE_ALIAS[norm] !== undefined) return PROFILE_ALIAS[norm];
  // Also accept the canonical Prisma identifier directly (case insensitive).
  const upper = norm.toUpperCase().replace(/\s+/g, '_');
  if ((CUSTOMER_PROFILES as readonly string[]).includes(upper)) {
    return upper as CustomerProfile;
  }
  return null;
}

export function parseProfilesCsv(text: string): ProfilesCsvParseResult {
  const allLines = text.split(/\r?\n/);
  const lines = allLines.filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      separator: ',',
      totalLines: 0,
      validRows: [],
      ignored: [],
      distribution: emptyDistribution(),
      sample: [],
    };
  }

  const headerLine = lines[0]!;
  const separator = detectSeparator(headerLine);
  const headerCols = splitLine(headerLine, separator).map(normalize);

  let codcliIdx = headerCols.findIndex((c) => HEADER_CODCLI_ALIASES.has(c));
  let profileIdx = headerCols.findIndex((c) => HEADER_PROFILE_ALIASES.has(c));

  // Header-less fallback: first column = codcli, second column = profile.
  // Only kicks in when neither alias was found AND the first row already
  // looks like data (numeric codcli + a known profile label).
  let firstDataIdx = 1;
  if (codcliIdx < 0 || profileIdx < 0) {
    const cols = splitLine(headerLine, separator);
    const looksLikeData =
      cols.length >= 2 &&
      cols[0]!.trim().length > 0 &&
      normalizeProfileLabel(cols[1]!) !== null;
    if (looksLikeData) {
      codcliIdx = 0;
      profileIdx = 1;
      firstDataIdx = 0;
    }
  }

  if (codcliIdx < 0 || profileIdx < 0) {
    return {
      separator,
      totalLines: lines.length,
      validRows: [],
      ignored: lines.map((raw, i) => ({
        lineNo: i + 1,
        raw,
        reason: 'missing-codcli' as const,
        hint:
          'Cabeçalho não reconhecido. Esperado pelo menos uma coluna codcli (codigo/code/cliente) e uma coluna perfil (perfil/profile).',
      })),
      distribution: emptyDistribution(),
      sample: [],
    };
  }

  const validRows: ProfilesCsvRow[] = [];
  const ignored: ProfilesCsvIgnored[] = [];
  const distribution = emptyDistribution();
  const seen = new Set<string>();

  for (let i = firstDataIdx; i < lines.length; i++) {
    const raw = lines[i]!;
    const lineNo = i + (firstDataIdx === 0 ? 1 : 0); // 1-based, post-header
    if (!raw.trim()) {
      ignored.push({ lineNo, raw, reason: 'empty' });
      continue;
    }
    const cols = splitLine(raw, separator);
    const codcli = (cols[codcliIdx] ?? '').trim();
    const profileRaw = (cols[profileIdx] ?? '').trim();

    if (!codcli) {
      ignored.push({ lineNo, raw, reason: 'missing-codcli' });
      continue;
    }
    const profile = normalizeProfileLabel(profileRaw);
    if (!profile) {
      ignored.push({
        lineNo,
        raw,
        reason: 'unknown-profile',
        hint: profileRaw ? `valor "${profileRaw}" não corresponde a nenhum perfil` : 'perfil vazio',
      });
      continue;
    }
    if (seen.has(codcli)) {
      ignored.push({
        lineNo,
        raw,
        reason: 'duplicate-codcli',
        hint: `codcli ${codcli} já apareceu antes nesta planilha`,
      });
      continue;
    }
    seen.add(codcli);
    validRows.push({ lineNo, codcli, profile });
    distribution[profile]++;
  }

  return {
    separator,
    totalLines: lines.length - (firstDataIdx === 1 ? 1 : 0),
    validRows,
    ignored,
    distribution,
    sample: validRows.slice(0, 5),
  };
}
