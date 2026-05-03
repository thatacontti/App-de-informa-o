import { describe, expect, it } from 'vitest';
import { classify } from '../classify/profiles';

const CURRENT = 'VERAO_2027_VERAO';
const PREVIOUS = 'VERAO_2026_VERAO';

const set = (...xs: string[]) => new Set(xs);

describe('classify · cliente ativo no ciclo atual', () => {
  it('5+ coleções → VIP_3PLUS', () => {
    expect(
      classify(
        set('VERAO_2023_VERAO', 'VERAO_2024_VERAO', 'VERAO_2025_VERAO', PREVIOUS, CURRENT),
        CURRENT,
        PREVIOUS,
      ),
    ).toBe('VIP_3PLUS');
  });

  it('4 coleções → VIP', () => {
    expect(
      classify(set('VERAO_2024_VERAO', 'VERAO_2025_VERAO', PREVIOUS, CURRENT), CURRENT, PREVIOUS),
    ).toBe('VIP');
  });

  it('3 coleções → FREQUENTE', () => {
    expect(classify(set('VERAO_2025_VERAO', PREVIOUS, CURRENT), CURRENT, PREVIOUS)).toBe(
      'FREQUENTE',
    );
  });

  it('2 coleções → REGULAR', () => {
    expect(classify(set(PREVIOUS, CURRENT), CURRENT, PREVIOUS)).toBe('REGULAR');
  });

  it('1 coleção (só atual) → NOVO_27', () => {
    expect(classify(set(CURRENT), CURRENT, PREVIOUS)).toBe('NOVO_27');
  });
});

describe('classify · cliente inativo no ciclo atual', () => {
  it('1 coleção apenas no ciclo anterior → NOVO_25', () => {
    expect(classify(set(PREVIOUS), CURRENT, PREVIOUS)).toBe('NOVO_25');
  });

  it('só histórico antigo → REGULAR', () => {
    expect(classify(set('VERAO_2020', 'INVERNO_2020'), CURRENT, PREVIOUS)).toBe('REGULAR');
  });

  it('só anterior + histórico antigo → REGULAR (não NOVO_25)', () => {
    expect(classify(set('VERAO_2020', PREVIOUS), CURRENT, PREVIOUS)).toBe('REGULAR');
  });
});

describe('classify · sem coleção atual definida', () => {
  it('nenhum customer aparece em "atual" inexistente → REGULAR', () => {
    expect(classify(set(PREVIOUS), null, PREVIOUS)).toBe('REGULAR');
  });

  it('histórico sem current nem previous → REGULAR', () => {
    expect(classify(set('VERAO_2020', 'VERAO_2021'), null, null)).toBe('REGULAR');
  });
});
