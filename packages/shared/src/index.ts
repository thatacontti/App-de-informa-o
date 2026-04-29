// @painel/shared — domain enums, Zod schemas and shared types.
// Schemas (FilterSchema, FactSchema, etc.) land in step 3.

export const BRANDS = ['KIKI', 'MENINA ANJO', 'VALENT'] as const;
export type Brand = (typeof BRANDS)[number];

export const LINES = ['BEBE', 'PRIMEIROS PASSOS', 'INFANTIL', 'TEEN'] as const;
export type Line = (typeof LINES)[number];

export const PRICE_TIERS = ['ENTRADA', 'MÉDIO', 'PREMIUM'] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export const ROLES = ['ADMIN', 'GESTOR', 'ANALISTA'] as const;
export type Role = (typeof ROLES)[number];

export const VIEW_MODES = ['DIRETORIA', 'PRODUTO'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];
