import { describe, expect, it } from 'vitest';
import { normalizeProfileLabel, parseProfilesCsv } from '../profiles-csv';

describe('normalizeProfileLabel', () => {
  it('matches all six canonical profiles via human-friendly labels', () => {
    expect(normalizeProfileLabel('VIP 3+')).toBe('VIP_3PLUS');
    expect(normalizeProfileLabel('VIP3+')).toBe('VIP_3PLUS');
    expect(normalizeProfileLabel('VIP')).toBe('VIP');
    expect(normalizeProfileLabel('FREQUENTE')).toBe('FREQUENTE');
    expect(normalizeProfileLabel('regular')).toBe('REGULAR');
    expect(normalizeProfileLabel('NOVO 25')).toBe('NOVO_25');
    expect(normalizeProfileLabel('NOVO 27')).toBe('NOVO_27');
  });

  it('accepts the canonical Prisma identifier (case insensitive)', () => {
    expect(normalizeProfileLabel('VIP_3PLUS')).toBe('VIP_3PLUS');
    expect(normalizeProfileLabel('novo_25')).toBe('NOVO_25');
  });

  it('strips diacritics on the header normalisation', () => {
    expect(normalizeProfileLabel('  Frequênte ')).toBe('FREQUENTE');
  });

  it('returns null for unknown labels', () => {
    expect(normalizeProfileLabel('PLATINA')).toBeNull();
    expect(normalizeProfileLabel('')).toBeNull();
    expect(normalizeProfileLabel('VIP 7')).toBeNull();
  });
});

describe('parseProfilesCsv · separator detection', () => {
  it('detects semicolon when present in the header', () => {
    const r = parseProfilesCsv('codcli;perfil\n100;VIP\n200;NOVO 27');
    expect(r.separator).toBe(';');
    expect(r.validRows).toHaveLength(2);
  });

  it('detects comma when present in the header', () => {
    const r = parseProfilesCsv('codcli,perfil\n100,VIP\n200,NOVO 27');
    expect(r.separator).toBe(',');
    expect(r.validRows).toHaveLength(2);
  });

  it('detects tab when present in the header', () => {
    const r = parseProfilesCsv('codcli\tperfil\n100\tVIP\n200\tNOVO 27');
    expect(r.separator).toBe('\t');
    expect(r.validRows).toHaveLength(2);
  });

  it('detects pipe when present in the header', () => {
    const r = parseProfilesCsv('codcli|perfil\n100|VIP\n200|NOVO 27');
    expect(r.separator).toBe('|');
    expect(r.validRows).toHaveLength(2);
  });
});

describe('parseProfilesCsv · valid path', () => {
  it('parses a clean comma CSV with all six profiles', () => {
    const csv = [
      'codcli,perfil',
      '100,VIP 3+',
      '200,VIP',
      '300,FREQUENTE',
      '400,REGULAR',
      '500,NOVO 25',
      '600,NOVO 27',
    ].join('\n');
    const r = parseProfilesCsv(csv);
    expect(r.validRows).toHaveLength(6);
    expect(r.ignored).toHaveLength(0);
    expect(r.distribution).toEqual({
      VIP_3PLUS: 1,
      VIP: 1,
      FREQUENTE: 1,
      REGULAR: 1,
      NOVO_25: 1,
      NOVO_27: 1,
    });
    expect(r.sample).toHaveLength(5); // first 5 rows
  });

  it('returns sample as the first 5 valid rows', () => {
    const lines = ['codcli,perfil'];
    for (let i = 1; i <= 7; i++) lines.push(`${i * 100},VIP`);
    const r = parseProfilesCsv(lines.join('\n'));
    expect(r.validRows).toHaveLength(7);
    expect(r.sample).toHaveLength(5);
    expect(r.sample[0]?.codcli).toBe('100');
    expect(r.sample[4]?.codcli).toBe('500');
  });

  it('accepts header aliases (codigo, classificacao)', () => {
    const r = parseProfilesCsv('codigo;classificacao\n9001;VIP');
    expect(r.validRows).toHaveLength(1);
    expect(r.validRows[0]?.codcli).toBe('9001');
    expect(r.validRows[0]?.profile).toBe('VIP');
  });

  it('handles header aliases with diacritics (código, classificação)', () => {
    const r = parseProfilesCsv('código;classificação\n9001;VIP');
    expect(r.validRows).toHaveLength(1);
  });
});

describe('parseProfilesCsv · ignored rows', () => {
  it('flags missing codcli', () => {
    const r = parseProfilesCsv('codcli,perfil\n,VIP\n200,VIP');
    expect(r.validRows).toHaveLength(1);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0]?.reason).toBe('missing-codcli');
  });

  it('flags unknown profile', () => {
    const r = parseProfilesCsv('codcli,perfil\n100,PLATINA\n200,VIP');
    expect(r.validRows).toHaveLength(1);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0]?.reason).toBe('unknown-profile');
    expect(r.ignored[0]?.hint).toContain('PLATINA');
  });

  it('flags duplicate codcli (keeps the first)', () => {
    const r = parseProfilesCsv('codcli,perfil\n100,VIP\n100,REGULAR\n200,VIP');
    expect(r.validRows).toHaveLength(2);
    expect(r.validRows[0]?.profile).toBe('VIP'); // first wins
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0]?.reason).toBe('duplicate-codcli');
  });

  it('skips empty lines silently (does not count as ignored)', () => {
    const r = parseProfilesCsv('codcli,perfil\n\n100,VIP\n\n200,VIP\n');
    expect(r.validRows).toHaveLength(2);
    expect(r.ignored).toHaveLength(0);
  });
});

describe('parseProfilesCsv · edge cases', () => {
  it('returns empty result for empty input', () => {
    const r = parseProfilesCsv('');
    expect(r.validRows).toHaveLength(0);
    expect(r.ignored).toHaveLength(0);
    expect(r.distribution.VIP).toBe(0);
  });

  it('falls back to header-less when first row is data', () => {
    const r = parseProfilesCsv('100;VIP\n200;NOVO 27');
    expect(r.validRows).toHaveLength(2);
    expect(r.validRows[0]?.codcli).toBe('100');
    expect(r.validRows[1]?.profile).toBe('NOVO_27');
  });

  it('reports an unrecognised header gracefully', () => {
    const r = parseProfilesCsv('foo,bar\n1,2');
    expect(r.validRows).toHaveLength(0);
    expect(r.ignored.length).toBeGreaterThan(0);
    expect(r.ignored[0]?.hint).toContain('Cabeçalho');
  });

  it('handles CRLF line endings', () => {
    const r = parseProfilesCsv('codcli,perfil\r\n100,VIP\r\n200,REGULAR');
    expect(r.validRows).toHaveLength(2);
  });

  it('trims surrounding whitespace on cells', () => {
    const r = parseProfilesCsv('codcli,perfil\n  100  ,  VIP  ');
    expect(r.validRows).toHaveLength(1);
    expect(r.validRows[0]?.codcli).toBe('100');
    expect(r.validRows[0]?.profile).toBe('VIP');
  });

  it('respects double-quoted cells that contain the separator', () => {
    const r = parseProfilesCsv('codcli,perfil,nome\n100,VIP,"FOO, BAR"\n200,REGULAR,BAZ');
    expect(r.validRows).toHaveLength(2);
  });
});
