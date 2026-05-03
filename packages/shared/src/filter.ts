import { z } from 'zod';

// Re-declare the enum tuples here (instead of importing them) to avoid
// a circular import: index.ts re-exports this module via `export *`.
const BRANDS_T = ['KIKI', 'MA', 'VALENT'] as const;
const LINES_T = ['BEBE', 'PRIMEIROS_PASSOS', 'INFANTIL', 'TEEN'] as const;
const PRICE_TIERS_T = ['ENTRADA', 'MEDIO', 'PREMIUM'] as const;

export const FilterSchema = z.object({
  brand: z.enum(BRANDS_T).optional(),
  ufId: z.string().regex(/^[A-Z]{2}$/).optional(),
  repId: z.string().optional(),
  productGroup: z.string().optional(),
  line: z.enum(LINES_T).optional(),
  priceTier: z.enum(PRICE_TIERS_T).optional(),
  // Coleção canônica (ex: 'VERAO_2020', 'INVERNO_2026', 'V27'). Quando
  // ausente, a tela agrega todas as coleções disponíveis no source.
  collection: z.string().optional(),
  // Coleção usada como baseline pelas comparações SSS / YoY. Quando
  // ausente, o SSS continua usando o baseline V26 do
  // `CustomerBrandRevenue` (compatibilidade com o cycle V27 ativo).
  // Quando setada, o baseline é derivado dos próprios `Sale` rows com
  // `collection = compareCollection`.
  compareCollection: z.string().optional(),
});

export type Filter = z.infer<typeof FilterSchema>;

export const VIEW_MODES = ['DIRETORIA', 'PRODUTO'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];
