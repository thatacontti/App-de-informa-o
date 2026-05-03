// Base44 connector — lê uma entidade do app no app.base44.com via SDK
// oficial e converte cada registro em `NormalizedSale`.
//
// O Base44 expõe entidades nomeadas (`base44.entities.<EntityName>`)
// com `.list()` / `.filter()` paginados. Como o schema da entidade é
// específico do app, o mapeamento campo→NormalizedSale é injetado pelo
// caller (similar ao padrão `transform` dos outros connectors).
//
// Sync incremental: usamos `filter({ updated_date: { $gt: since } })`
// se a entidade tiver campo `updated_date` (padrão do Base44). Caller
// pode override via `incrementalField`.

import { createClient, type Base44Client } from '@base44/sdk';
import {
  ConnectorError,
  type ConnectorTestResult,
  type NormalizedSale,
  type SaleConnector,
} from './types';

/** Mapeia um registro cru do Base44 (shape qualquer) → NormalizedSale. */
export type Base44Mapper = (record: Record<string, unknown>, idx: number) => NormalizedSale;

export interface Base44ConnectorOptions {
  appId: string;
  apiKey: string;
  /** Nome da entidade no app Base44 (ex: 'Sale', 'Order', 'Pedido'). */
  entityName: string;
  /** Função de mapeamento entidade → NormalizedSale. */
  mapper: Base44Mapper;
  /** Campo usado pra filtro incremental (default: 'updated_date'). */
  incrementalField?: string;
  /** Tamanho da página (default: 500, máx típico do Base44 é 1000). */
  pageSize?: number;
  name?: string;
  /** SDK pré-construído pra testes — bypassa createClient. */
  client?: Base44Client;
}

export class Base44Connector implements SaleConnector {
  readonly type = 'CRM_API' as const; // reusa o tipo CRM_API no DataSource enum
  readonly name: string;
  readonly entityName: string;
  readonly pageSize: number;
  private readonly mapper: Base44Mapper;
  private readonly incrementalField: string;
  private readonly client: Base44Client;

  constructor(opts: Base44ConnectorOptions) {
    this.name = opts.name ?? `base44-${opts.entityName.toLowerCase()}`;
    this.entityName = opts.entityName;
    this.pageSize = opts.pageSize ?? 500;
    this.mapper = opts.mapper;
    this.incrementalField = opts.incrementalField ?? 'updated_date';
    this.client =
      opts.client ??
      createClient({
        appId: opts.appId,
        headers: { api_key: opts.apiKey },
      });
  }

  async test(): Promise<ConnectorTestResult> {
    try {
      const handler = this.entityHandler();
      const sample = await handler.list(undefined, 1);
      const n = Array.isArray(sample) ? sample.length : 0;
      return {
        ok: true,
        detail: `entidade ${this.entityName} acessível · ${n} registro(s) na primeira página`,
      };
    } catch (e) {
      return { ok: false, error: extractMessage(e) };
    }
  }

  async extract(since: Date): Promise<NormalizedSale[]> {
    const handler = this.entityHandler();
    const sinceIso = since.toISOString();
    const out: NormalizedSale[] = [];
    let skip = 0;

    while (true) {
      let page: Record<string, unknown>[];
      try {
        // Filtro incremental quando `since` é uma data real (não epoch 0).
        if (since.getTime() > 0) {
          page = (await handler.filter(
            { [this.incrementalField]: { $gt: sinceIso } } as never,
            `+${this.incrementalField}` as never,
            this.pageSize,
            skip,
          )) as Record<string, unknown>[];
        } else {
          page = (await handler.list(
            `+${this.incrementalField}` as never,
            this.pageSize,
            skip,
          )) as Record<string, unknown>[];
        }
      } catch (e) {
        throw new ConnectorError(this.name, 'extract', extractMessage(e), e);
      }

      if (!page || page.length === 0) break;
      page.forEach((rec, i) => {
        try {
          out.push(this.mapper(rec, skip + i));
        } catch (e) {
          throw new ConnectorError(
            this.name,
            'transform',
            `linha ${skip + i + 1}: ${extractMessage(e)}`,
            e,
          );
        }
      });

      if (page.length < this.pageSize) break;
      skip += this.pageSize;
    }
    return out;
  }

  /** Entity handler — público pra exploração / testes. */
  entityHandler() {
    const entities = this.client.entities as unknown as Record<
      string,
      {
        list: (
          sort?: string,
          limit?: number,
          skip?: number,
        ) => Promise<Record<string, unknown>[]>;
        filter: (
          query: unknown,
          sort?: string,
          limit?: number,
          skip?: number,
        ) => Promise<Record<string, unknown>[]>;
      }
    >;
    const handler = entities[this.entityName];
    if (!handler) {
      throw new ConnectorError(
        this.name,
        'extract',
        `entidade '${this.entityName}' não encontrada no app Base44`,
      );
    }
    return handler;
  }
}

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return JSON.stringify(e);
}
