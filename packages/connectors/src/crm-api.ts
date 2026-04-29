// CRM REST API connector — `axios` + `axios-retry` with exponential
// backoff on 429 / 5xx, paginated through `?page=N&per_page=200`.

import axios, { type AxiosInstance, AxiosHeaders, isAxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import {
  BRAND_FROM_LABEL,
  CUSTOMER_PROFILE_FROM_LABEL,
  LINE_FROM_LABEL,
  PRICE_TIER_FROM_LABEL,
} from '@painel/shared';
import {
  ConnectorError,
  type ConnectorTestResult,
  type NormalizedSale,
  type SaleConnector,
} from './types';

export interface CrmDeal {
  id: string | number;
  sku: string;
  product_name: string;
  brand: string;
  line: string;
  group: string;
  coordinated_season?: string | null;
  price_tier: string;
  designer?: string | null;
  unit_price?: number | null;
  customer: {
    id: string | number;
    name: string;
    profile: string;
    uf: string;
    city?: string | null;
  };
  rep?: { full_name: string } | null;
  qty: number;
  value: number;
  cost?: number | null;
  unit_cost?: number | null;
  closed_at: string;
  updated_at: string;
}

export interface CrmApiOptions {
  baseUrl: string;
  token: string;
  name?: string;
  timeoutMs?: number;
  retries?: number;
  pageSize?: number;
  /** Inject a pre-built axios for tests. */
  http?: AxiosInstance;
}

export class CrmApiConnector implements SaleConnector {
  readonly type = 'CRM_API' as const;
  readonly name: string;
  readonly pageSize: number;
  private http: AxiosInstance;

  constructor(opts: CrmApiOptions) {
    this.name = opts.name ?? 'crm-api';
    this.pageSize = opts.pageSize ?? 200;

    if (opts.http) {
      this.http = opts.http;
    } else {
      this.http = axios.create({
        baseURL: opts.baseUrl,
        timeout: opts.timeoutMs ?? 30_000,
        headers: new AxiosHeaders({ Authorization: `Bearer ${opts.token}` }),
      });
      axiosRetry(this.http, {
        retries: opts.retries ?? 5,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (e) => {
          const status = e.response?.status ?? 0;
          return status === 429 || (status >= 500 && status < 600);
        },
      });
    }
  }

  async test(): Promise<ConnectorTestResult> {
    try {
      const r = await this.http.get('/deals', { params: { page: 1, per_page: 1 } });
      return { ok: true, detail: `endpoint reachable · status ${r.status}` };
    } catch (e) {
      return { ok: false, error: extractMessage(e) };
    }
  }

  async extract(since: Date): Promise<NormalizedSale[]> {
    const all: NormalizedSale[] = [];
    let page = 1;
    while (true) {
      let payload: { items: CrmDeal[]; has_more?: boolean };
      try {
        const r = await this.http.get<{ items: CrmDeal[]; has_more?: boolean }>('/deals', {
          params: { since: since.toISOString(), page, per_page: this.pageSize },
        });
        payload = r.data;
      } catch (e) {
        throw new ConnectorError(this.name, 'extract', extractMessage(e), e);
      }

      const items = payload.items ?? [];
      for (const it of items) all.push(this.transform(it));

      const hasMore = payload.has_more ?? items.length >= this.pageSize;
      if (!hasMore || items.length === 0) break;
      page++;
    }
    return all;
  }

  /** Public for unit testing. */
  transform(d: CrmDeal): NormalizedSale {
    const brand = BRAND_FROM_LABEL[d.brand];
    if (!brand) throw new ConnectorError(this.name, 'transform', `unknown brand "${d.brand}"`);
    const line = LINE_FROM_LABEL[d.line];
    if (!line) throw new ConnectorError(this.name, 'transform', `unknown line "${d.line}"`);
    const tier = PRICE_TIER_FROM_LABEL[d.price_tier];
    if (!tier) throw new ConnectorError(this.name, 'transform', `unknown tier "${d.price_tier}"`);
    const profile = CUSTOMER_PROFILE_FROM_LABEL[d.customer.profile];
    if (!profile)
      throw new ConnectorError(this.name, 'transform', `unknown profile "${d.customer.profile}"`);

    return {
      externalId: String(d.id),
      productSku: d.sku,
      productName: d.product_name,
      brand,
      productLine: line,
      productGroup: d.group,
      coordSeason: d.coordinated_season ?? undefined,
      priceTier: tier,
      designer: d.designer ?? undefined,
      unitPrice: d.unit_price ?? undefined,
      customerId: String(d.customer.id),
      customerName: d.customer.name,
      customerProfile: profile,
      repFullName: d.rep?.full_name ?? undefined,
      cityName: d.customer.city?.trim() || undefined,
      ufId: d.customer.uf,
      qty: d.qty,
      value: d.value,
      cost: d.cost ?? undefined,
      unitCost: d.unit_cost ?? undefined,
      date: new Date(d.closed_at),
      sourceUpdatedAt: new Date(d.updated_at),
    };
  }
}

function extractMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const status = e.response?.status;
    return status ? `HTTP ${status} · ${e.message}` : e.message;
  }
  return (e as Error).message;
}
