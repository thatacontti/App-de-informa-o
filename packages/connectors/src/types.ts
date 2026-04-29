// Connector type surface — every adapter normalises to one of two
// shapes (NormalizedSale or NormalizedTarget) before it reaches the
// upsert layer. Mapping rules live with each connector.

import type { Brand, CustomerProfile, PriceTier, ProductLine } from '@painel/shared';

export const CONNECTOR_TYPES = ['ERP_DB', 'CRM_API', 'XLSX'] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export interface ConnectorTestResult {
  ok: boolean;
  /** Free-form context (e.g. "connected · 1 row sample"). */
  detail?: string;
  error?: string;
}

export interface BaseConnector {
  readonly type: ConnectorType;
  readonly name: string;
  test(): Promise<ConnectorTestResult>;
}

// ---------- Sale-shaped sources (ERP, CRM, fixtures) ----------

export interface NormalizedSale {
  externalId: string;
  productSku: string;
  productName: string;
  brand: Brand;
  productLine: ProductLine;
  productGroup: string;
  coordSeason?: string;
  priceTier: PriceTier;
  designer?: string;
  unitPrice?: number;
  customerId: string;
  customerName: string;
  customerProfile: CustomerProfile;
  repFullName?: string;
  cityName?: string;
  ufId: string;
  qty: number;
  value: number;
  cost?: number;
  unitCost?: number;
  date: Date;
  sourceUpdatedAt: Date;
}

export interface SaleConnector extends BaseConnector {
  extract(since: Date): Promise<NormalizedSale[]>;
}

// ---------- Target-shaped sources (SharePoint XLSX) ----------

export interface NormalizedTarget {
  scope: 'GLOBAL' | 'BRAND' | 'UF' | 'REP';
  scopeKey: string | null;
  brand?: Brand;
  ufId?: string;
  repFullName?: string;
  period: string; // 'V27', '2026-Q4', etc.
  unit: 'BRL' | 'UNITS';
  valueTarget: number;
}

export interface TargetConnector extends BaseConnector {
  extract(since?: Date): Promise<NormalizedTarget[]>;
}

// ---------- Errors ----------

export class ConnectorError extends Error {
  constructor(
    public readonly connectorName: string,
    public readonly stage: 'test' | 'extract' | 'transform',
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`[${connectorName}/${stage}] ${message}`);
    this.name = 'ConnectorError';
  }
}
