import { describe, expect, it } from 'vitest';
import {
  BRAND_FROM_LABEL,
  BRAND_LABEL,
  CUSTOMER_PROFILE_FROM_LABEL,
  CUSTOMER_PROFILE_LABEL,
  IBGE_TIER_FROM_LABEL,
  IBGE_TIER_LABEL,
  LINE_FROM_LABEL,
  LINE_LABEL,
  PRICE_TIER_FROM_LABEL,
  PRICE_TIER_LABEL,
  UFS_BR,
  fmtBRL,
  fmtNum,
  fmtPct,
  formatCollectionLabel,
} from '../index';

describe('label maps round-trip · enum key ↔ display label', () => {
  it('Brand', () => {
    for (const [key, label] of Object.entries(BRAND_LABEL)) {
      expect(BRAND_FROM_LABEL[label]).toBe(key);
    }
  });
  it('ProductLine', () => {
    for (const [key, label] of Object.entries(LINE_LABEL)) {
      expect(LINE_FROM_LABEL[label]).toBe(key);
    }
  });
  it('PriceTier', () => {
    for (const [key, label] of Object.entries(PRICE_TIER_LABEL)) {
      expect(PRICE_TIER_FROM_LABEL[label]).toBe(key);
    }
  });
  it('CustomerProfile', () => {
    for (const [key, label] of Object.entries(CUSTOMER_PROFILE_LABEL)) {
      expect(CUSTOMER_PROFILE_FROM_LABEL[label]).toBe(key);
    }
  });
  it('IbgePopulationTier', () => {
    for (const [key, label] of Object.entries(IBGE_TIER_LABEL)) {
      expect(IBGE_TIER_FROM_LABEL[label]).toBe(key);
    }
  });
});

describe('UFS_BR', () => {
  it('contains 27 Brazilian states', () => {
    expect(UFS_BR).toHaveLength(27);
  });
  it('all UF ids are 2 letters and unique', () => {
    const ids = UFS_BR.map((u) => u.id);
    expect(new Set(ids).size).toBe(27);
    for (const id of ids) expect(id).toMatch(/^[A-Z]{2}$/);
  });
});

describe('formatters', () => {
  it('fmtBRL emits BRL with no decimals', () => {
    const result = fmtBRL(4788607);
    expect(result).toMatch(/4\.788\.607/);
    expect(result).toMatch(/R\$/);
  });
  it('fmtNum emits pt-BR thousands', () => {
    expect(fmtNum(60437)).toBe('60.437');
  });
  it('fmtPct prefixes positive values with +', () => {
    expect(fmtPct(2.0)).toBe('+2.0%');
    expect(fmtPct(-1.3)).toBe('-1.3%');
  });
});

describe('formatCollectionLabel', () => {
  it('formats canonical collection codes', () => {
    expect(formatCollectionLabel('VERAO_2020')).toBe('Verão 2020');
    expect(formatCollectionLabel('INVERNO_2026')).toBe('Inverno 2026');
    expect(formatCollectionLabel('TROPICAL_2025')).toBe('Tropical 2025');
    expect(formatCollectionLabel('VERAO_2023_PRIMAVERA')).toBe('Verão 2023 · Primavera');
    expect(formatCollectionLabel('VERAO_2025_VERAO')).toBe('Verão 2025 · Verão');
  });

  it('passes legacy short codes through', () => {
    expect(formatCollectionLabel('V27')).toBe('V27');
    expect(formatCollectionLabel('V26')).toBe('V26');
  });

  it('returns empty string for empty input', () => {
    expect(formatCollectionLabel('')).toBe('');
  });
});
