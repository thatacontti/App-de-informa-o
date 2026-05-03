// CSV histórico — lê os arquivos `Pasta1_v*.csv` enviados pelo ERP
// (Latin-1, separador `;`, decimal com vírgula) e converte para
// `NormalizedSale[]`. Usado pelo script de ingestão único em
// `packages/jobs/src/scripts/ingest-historico.ts`.
//
// Campos não disponíveis no CSV:
//   - `customerProfile`  → undefined (preenchido depois pelo classificador
//     V26/V27 quando o ciclo ativo é processado)
//   - `priceTier`        → derivado de VALOR_LIQ/QTDE com thresholds
//   - `unitPrice`        → calculado da mesma divisão
//   - `designer`         → não existe no CSV
//
// Campo `collection` é normalizado a partir de DESC_COLECAO:
//   `VERAO 2020`              → `VERAO_2020`
//   `*VERÃO 2021`             → `VERAO_2021`
//   `VERAO 2023 - PRIMAVERA`  → `VERAO_2023_PRIMAVERA`
//   `INVERNO 2026`            → `INVERNO_2026`

import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import {
  BRAND_FROM_LABEL,
  LINE_FROM_LABEL,
  type Brand,
  type PriceTier,
  type ProductLine,
} from '@painel/shared';
import {
  ConnectorError,
  type ConnectorTestResult,
  type NormalizedSale,
  type SaleConnector,
} from './types';

// CSV column order (matches the header row exactly).
const COL = {
  NUMERO: 0,
  DT_EMISSAO: 1,
  CODCLI: 2,
  NOME: 3,
  NOME_CID: 4,
  COD_EST: 5,
  GRUPO_CLI: 6,
  DESC_GRUPO_CLI: 7,
  CODREP: 8,
  NOME_REP: 9,
  PROD: 10,
  DESC_PROD: 11,
  DESCRICAO2: 12,
  DESC_MARCA: 13,
  DESC_LINHA: 14,
  DESC_COLECAO: 15,
  DESC_ETIQUETA: 16,
  DESC_COORDENADO: 17,
  CUSTO_IND: 18,
  QTDE: 19,
  VALOR_LIQ: 20,
} as const;

// Thresholds em R$ para classificar `priceTier` a partir do PM unitário.
// Defaults baseados nos PMs reais por marca (KIKI 78, MA 86, VAL 75) —
// ENTRADA é até 1/3 abaixo do médio; PREMIUM começa onde o médio acaba.
export interface PriceTierThresholds {
  entrada: number; // PM unitário < este valor → ENTRADA
  premium: number; // PM unitário ≥ este valor → PREMIUM (resto é MEDIO)
}

export const DEFAULT_PRICE_THRESHOLDS: PriceTierThresholds = {
  entrada: 50,
  premium: 90,
};

export interface CsvHistoricoOptions {
  filePath: string;
  /** Nome do connector (default: deriva do basename). */
  name?: string;
  /** Encoding do arquivo (default: latin1, que é o que o ERP gera). */
  encoding?: BufferEncoding;
  /** Override por marca opcional. */
  thresholdsByBrand?: Partial<Record<Brand, PriceTierThresholds>>;
  /** Threshold global (fallback). */
  thresholds?: PriceTierThresholds;
}

export class CsvHistoricoConnector implements SaleConnector {
  readonly type = 'CSV_HISTORICO' as const;
  readonly name: string;
  private filePath: string;
  private encoding: BufferEncoding;
  private thresholds: PriceTierThresholds;
  private thresholdsByBrand: Partial<Record<Brand, PriceTierThresholds>>;

  constructor(opts: CsvHistoricoOptions) {
    this.filePath = opts.filePath;
    this.name = opts.name ?? `csv-${basename(opts.filePath)}`;
    this.encoding = opts.encoding ?? 'latin1';
    this.thresholds = opts.thresholds ?? DEFAULT_PRICE_THRESHOLDS;
    this.thresholdsByBrand = opts.thresholdsByBrand ?? {};
  }

  async test(): Promise<ConnectorTestResult> {
    if (!existsSync(this.filePath)) {
      return { ok: false, error: `arquivo não encontrado: ${this.filePath}` };
    }
    const size = statSync(this.filePath).size;
    return { ok: true, detail: `${this.filePath} · ${(size / 1024 / 1024).toFixed(1)} MB` };
  }

  async extract(_since: Date): Promise<NormalizedSale[]> {
    let raw: string;
    try {
      raw = readFileSync(this.filePath, this.encoding);
    } catch (e) {
      throw new ConnectorError(this.name, 'extract', (e as Error).message, e);
    }

    const lines = raw.split(/\r?\n/);
    if (lines.length < 2) return [];

    const out: NormalizedSale[] = [];
    // Linha 0 é o cabeçalho — começa em 1.
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const sale = this.transformLine(line, i);
      if (sale) out.push(sale);
    }
    return out;
  }

  /** Public for unit testing. Returns null when the line is empty/invalid. */
  transformLine(line: string, rowIdx: number): NormalizedSale | null {
    const f = line.split(';');
    if (f.length < 21) return null;

    const numero = f[COL.NUMERO]?.trim();
    const prod = f[COL.PROD]?.trim();
    const cli = f[COL.CODCLI]?.trim();
    if (!numero || !prod || !cli) return null;

    const brand = BRAND_FROM_LABEL[(f[COL.DESC_MARCA] ?? '').trim()];
    if (!brand) {
      throw new ConnectorError(
        this.name,
        'transform',
        `marca desconhecida "${f[COL.DESC_MARCA]}" na linha ${rowIdx + 1}`,
      );
    }

    const lineLabel = (f[COL.DESC_LINHA] ?? '').trim();
    const productLine = LINE_FROM_LABEL[lineLabel];
    if (!productLine) {
      throw new ConnectorError(
        this.name,
        'transform',
        `linha desconhecida "${lineLabel}" em ${rowIdx + 1}`,
      );
    }

    const qty = parseIntPt(f[COL.QTDE]);
    const value = parseDecimalPt(f[COL.VALOR_LIQ]);
    const cost = parseDecimalPt(f[COL.CUSTO_IND]);
    if (qty === null || value === null) return null;

    const unitPrice = qty > 0 ? value / qty : 0;
    const priceTier = this.classifyTier(unitPrice, brand);

    const collection = normalizeCollection(f[COL.DESC_COLECAO] ?? '');
    if (!collection) {
      throw new ConnectorError(
        this.name,
        'transform',
        `coleção vazia na linha ${rowIdx + 1}`,
      );
    }

    const date = parseDatePt(f[COL.DT_EMISSAO]);
    if (!date) {
      throw new ConnectorError(
        this.name,
        'transform',
        `data inválida "${f[COL.DT_EMISSAO]}" em ${rowIdx + 1}`,
      );
    }

    const cityName = (f[COL.NOME_CID] ?? '').trim() || undefined;
    const ufId = (f[COL.COD_EST] ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(ufId)) {
      throw new ConnectorError(
        this.name,
        'transform',
        `UF inválida "${ufId}" em ${rowIdx + 1}`,
      );
    }

    return {
      // ID determinístico baseado no conteúdo: a mesma linha em ingestões
      // futuras gera o mesmo externalId, garantindo idempotência.
      externalId: `csv-${numero}-${prod}-${cli}-${qty}-${value.toFixed(2)}`,
      productSku: prod,
      productName: (f[COL.DESC_PROD] ?? '').trim() || prod,
      brand,
      productLine,
      productGroup: (f[COL.DESC_PROD] ?? '').trim() || 'OUTROS',
      coordSeason: (f[COL.DESC_COORDENADO] ?? '').trim() || undefined,
      priceTier,
      unitPrice,
      customerId: cli,
      customerName: (f[COL.NOME] ?? '').trim() || cli,
      // historic CSV doesn't carry profile classification — adapter
      // preserves any existing profile and uses the column default for
      // brand-new customer rows.
      customerProfile: undefined,
      repFullName: (f[COL.NOME_REP] ?? '').trim() || undefined,
      cityName,
      ufId,
      qty,
      value,
      cost: cost ?? undefined,
      unitCost: cost !== null && qty > 0 ? cost / qty : undefined,
      date,
      sourceUpdatedAt: date,
      collection,
    };
  }

  private classifyTier(unitPrice: number, brand: Brand): PriceTier {
    const t = this.thresholdsByBrand[brand] ?? this.thresholds;
    if (unitPrice < t.entrada) return 'ENTRADA';
    if (unitPrice >= t.premium) return 'PREMIUM';
    return 'MEDIO';
  }
}

// ---------- helpers ----------

/**
 * Normaliza o rótulo de coleção do CSV em uma string canônica
 * indexável. Remove acentos, asteriscos, espaços e traços.
 */
export function normalizeCollection(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (acentos)
    .replace(/^\*+/, '') // remove asteriscos no início
    .toUpperCase()
    .trim()
    .replace(/[\s\-]+/g, '_') // espaços/dashes/whitespace múltiplos → _
    .replace(/[^A-Z0-9_]/g, '') // descarta resíduos
    .replace(/_+/g, '_') // colapsa _ múltiplos
    .replace(/^_|_$/g, ''); // strip _ extremidades
}

/** Parses decimal com vírgula brasileira: `26,3` → 26.3. */
export function parseDecimalPt(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  // Remove pontos de milhar (raro em ERP, mas defensivo) e troca vírgula por ponto.
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseIntPt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim().replace(/\./g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Parses data DD/MM/YYYY → Date em UTC à meia-noite. */
export function parseDatePt(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isFinite(d.getTime()) ? d : null;
}
