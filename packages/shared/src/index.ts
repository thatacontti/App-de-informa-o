// @painel/shared — domain enums, labels and shared types.
//
// Prisma enums use safe identifiers (no spaces / no accents). Labels
// here map back to the human-readable form used in the prototype HTML
// and on screen. Always use the *_LABEL maps when rendering.

export const ROLES = ['ADMIN', 'GESTOR', 'ANALISTA'] as const;
export type Role = (typeof ROLES)[number];

export const VIEW_MODES = ['DIRETORIA', 'PRODUTO'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

// ---------- Brand ----------

export const BRANDS = ['KIKI', 'MA', 'VALENT'] as const;
export type Brand = (typeof BRANDS)[number];

export const BRAND_LABEL: Record<Brand, string> = {
  KIKI: 'KIKI',
  MA: 'MENINA ANJO',
  VALENT: 'VALENT',
};

export const BRAND_FROM_LABEL: Record<string, Brand> = {
  KIKI: 'KIKI',
  'MENINA ANJO': 'MA',
  VALENT: 'VALENT',
};

// ---------- Product line ----------

export const LINES = ['BEBE', 'PRIMEIROS_PASSOS', 'INFANTIL', 'TEEN'] as const;
export type ProductLine = (typeof LINES)[number];

export const LINE_LABEL: Record<ProductLine, string> = {
  BEBE: 'BEBE',
  PRIMEIROS_PASSOS: 'PRIMEIROS PASSOS',
  INFANTIL: 'INFANTIL',
  TEEN: 'TEEN',
};

export const LINE_FROM_LABEL: Record<string, ProductLine> = {
  BEBE: 'BEBE',
  'PRIMEIROS PASSOS': 'PRIMEIROS_PASSOS',
  INFANTIL: 'INFANTIL',
  TEEN: 'TEEN',
};

// ---------- Price tier ----------

export const PRICE_TIERS = ['ENTRADA', 'MEDIO', 'PREMIUM'] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export const PRICE_TIER_LABEL: Record<PriceTier, string> = {
  ENTRADA: 'ENTRADA',
  MEDIO: 'MÉDIO',
  PREMIUM: 'PREMIUM',
};

export const PRICE_TIER_FROM_LABEL: Record<string, PriceTier> = {
  ENTRADA: 'ENTRADA',
  'MÉDIO': 'MEDIO',
  PREMIUM: 'PREMIUM',
};

// ---------- Customer profile ----------

export const CUSTOMER_PROFILES = [
  'VIP_3PLUS',
  'VIP',
  'FREQUENTE',
  'REGULAR',
  'NOVO_25',
  'NOVO_27',
] as const;
export type CustomerProfile = (typeof CUSTOMER_PROFILES)[number];

export const CUSTOMER_PROFILE_LABEL: Record<CustomerProfile, string> = {
  VIP_3PLUS: 'VIP 3+',
  VIP: 'VIP',
  FREQUENTE: 'FREQUENTE',
  REGULAR: 'REGULAR',
  NOVO_25: 'NOVO 25',
  NOVO_27: 'NOVO 27',
};

export const CUSTOMER_PROFILE_FROM_LABEL: Record<string, CustomerProfile> = {
  'VIP 3+': 'VIP_3PLUS',
  VIP: 'VIP',
  FREQUENTE: 'FREQUENTE',
  REGULAR: 'REGULAR',
  'NOVO 25': 'NOVO_25',
  'NOVO 27': 'NOVO_27',
};

// ---------- Geography ----------

export const REGIONS = ['N', 'NE', 'CO', 'SE', 'S'] as const;
export type BrazilRegion = (typeof REGIONS)[number];

export const REGION_LABEL: Record<BrazilRegion, string> = {
  N: 'Norte',
  NE: 'Nordeste',
  CO: 'Centro-Oeste',
  SE: 'Sudeste',
  S: 'Sul',
};

export const IBGE_TIERS = ['METRO', 'GRANDE', 'MEDIA', 'PEQUENA', 'MICRO'] as const;
export type IbgePopulationTier = (typeof IBGE_TIERS)[number];

export const IBGE_TIER_LABEL: Record<IbgePopulationTier, string> = {
  METRO: 'Metrópole',
  GRANDE: 'Grande',
  MEDIA: 'Média',
  PEQUENA: 'Pequena',
  MICRO: 'Micro',
};

export const IBGE_TIER_FROM_LABEL: Record<string, IbgePopulationTier> = {
  'Metrópole': 'METRO',
  Grande: 'GRANDE',
  'Média': 'MEDIA',
  Pequena: 'PEQUENA',
  Micro: 'MICRO',
};

// ---------- Static UF reference (27 Brazilian states) ----------

export interface UFRef {
  id: string;
  name: string;
  region: BrazilRegion;
}

export const UFS_BR: ReadonlyArray<UFRef> = [
  { id: 'AC', name: 'Acre', region: 'N' },
  { id: 'AL', name: 'Alagoas', region: 'NE' },
  { id: 'AP', name: 'Amapá', region: 'N' },
  { id: 'AM', name: 'Amazonas', region: 'N' },
  { id: 'BA', name: 'Bahia', region: 'NE' },
  { id: 'CE', name: 'Ceará', region: 'NE' },
  { id: 'DF', name: 'Distrito Federal', region: 'CO' },
  { id: 'ES', name: 'Espírito Santo', region: 'SE' },
  { id: 'GO', name: 'Goiás', region: 'CO' },
  { id: 'MA', name: 'Maranhão', region: 'NE' },
  { id: 'MT', name: 'Mato Grosso', region: 'CO' },
  { id: 'MS', name: 'Mato Grosso do Sul', region: 'CO' },
  { id: 'MG', name: 'Minas Gerais', region: 'SE' },
  { id: 'PA', name: 'Pará', region: 'N' },
  { id: 'PB', name: 'Paraíba', region: 'NE' },
  { id: 'PR', name: 'Paraná', region: 'S' },
  { id: 'PE', name: 'Pernambuco', region: 'NE' },
  { id: 'PI', name: 'Piauí', region: 'NE' },
  { id: 'RJ', name: 'Rio de Janeiro', region: 'SE' },
  { id: 'RN', name: 'Rio Grande do Norte', region: 'NE' },
  { id: 'RS', name: 'Rio Grande do Sul', region: 'S' },
  { id: 'RO', name: 'Rondônia', region: 'N' },
  { id: 'RR', name: 'Roraima', region: 'N' },
  { id: 'SC', name: 'Santa Catarina', region: 'S' },
  { id: 'SP', name: 'São Paulo', region: 'SE' },
  { id: 'SE', name: 'Sergipe', region: 'NE' },
  { id: 'TO', name: 'Tocantins', region: 'N' },
];

// ---------- Currency / units ----------

export const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const fmtNum = (v: number) =>
  Math.round(v).toLocaleString('pt-BR');

export const fmtPct = (v: number, digits = 1) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
