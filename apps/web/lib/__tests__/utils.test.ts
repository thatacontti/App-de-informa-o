import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
  it('merges and dedupes tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-deep', false && 'hidden', 'font-display')).toBe(
      'text-deep font-display',
    );
  });
});
