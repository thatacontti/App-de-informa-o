// Factory — given a DataSource record + the USE_MOCK_CONNECTORS flag,
// returns the right connector instance. Keeps the call sites in
// packages/jobs free of the real-vs-mock branching.

import * as path from 'node:path';
import { Base44Connector, type Base44Mapper } from './base44';
import { makeSaleMapper, makeSalesDataMapper } from './base44-mappers';
import { CrmApiConnector } from './crm-api';
import { CsvHistoricoConnector } from './csv-historico';
import { ErpPostgresConnector } from './erp-postgres';
import { FixtureSaleConnector, FixtureTargetConnector } from './fixture';
import { SharePointXlsxConnector } from './sharepoint-xlsx';
import type { ConnectorType, SaleConnector, TargetConnector } from './types';

// Registry de mappers Base44 — entity schema é app-specific, então
// cada DataSource carrega `config.mapperName` apontando pra uma chave
// daqui. Adicionar um novo app = registrar um mapper novo.
const BASE44_MAPPERS = new Map<string, Base44Mapper>();

export function registerBase44Mapper(name: string, mapper: Base44Mapper): void {
  BASE44_MAPPERS.set(name, mapper);
}

export function getBase44Mapper(name: string): Base44Mapper | undefined {
  return BASE44_MAPPERS.get(name);
}

// Mappers built-in pro app `catarina-vibe-flow.base44.app`. Outras
// apps podem registrar mappers custom em runtime via registerBase44Mapper.
registerBase44Mapper('sale-default', makeSaleMapper());
registerBase44Mapper('salesdata-default', makeSalesDataMapper());

export interface DataSourceSpec {
  type: ConnectorType;
  name: string;
  endpoint: string;
  config?: Record<string, string>;
}

export interface FactoryOptions {
  /** When true, every type returns its fixture counterpart. */
  useMock: boolean;
  /** Used by the fixture connectors. Resolves to <repo-root>/painel_v27 in dev. */
  fixturesDir: string;
}

export function createSaleConnector(spec: DataSourceSpec, opts: FactoryOptions): SaleConnector {
  if (spec.type === 'XLSX') {
    throw new Error(`createSaleConnector does not handle XLSX — use createTargetConnector for ${spec.name}`);
  }

  // Mock mode applies only to live sources (ERP / CRM). The CSV histórico
  // already reads from a fixed file so there's nothing to mock.
  if (opts.useMock && spec.type !== 'CSV_HISTORICO') {
    return new FixtureSaleConnector({ type: spec.type, fixturesDir: opts.fixturesDir, name: spec.name });
  }

  switch (spec.type) {
    case 'ERP_DB':
      return new ErpPostgresConnector({
        connectionString: spec.endpoint,
        name: spec.name,
        view: spec.config?.['view'],
      });

    case 'CRM_API': {
      const token = spec.config?.['token'];
      if (!token) throw new Error(`CRM connector ${spec.name} requires config.token`);
      return new CrmApiConnector({
        baseUrl: spec.endpoint,
        token,
        name: spec.name,
      });
    }

    case 'CSV_HISTORICO':
      // `endpoint` is an absolute path to the CSV file inside the container.
      return new CsvHistoricoConnector({
        filePath: spec.endpoint,
        name: spec.name,
      });

    case 'BASE44_API': {
      // Resolve cada campo na ordem: config (DB) → env var → default.
      // Isso permite ativar a fonte só setando BASE44_API_KEY no Railway,
      // sem precisar tocar no banco. configEncrypted continua sendo
      // override por DataSource quando há múltiplas fontes Base44.
      const apiKey =
        spec.config?.['apiKey'] ?? process.env['BASE44_API_KEY'];
      const entityName =
        spec.config?.['entityName'] ?? process.env['BASE44_ENTITY_NAME'] ?? 'Sale';
      const mapperName =
        spec.config?.['mapperName'] ?? process.env['BASE44_MAPPER_NAME'] ?? 'sale-default';
      const serverUrl =
        spec.config?.['serverUrl'] ?? process.env['BASE44_SERVER_URL'] ?? undefined;
      const incrementalField =
        spec.config?.['incrementalField'] ?? process.env['BASE44_INCREMENTAL_FIELD'] ?? undefined;

      if (!apiKey) {
        throw new Error(
          `Base44 connector ${spec.name}: api key ausente. Set BASE44_API_KEY no env do Railway, ` +
            `ou popule configEncrypted.apiKey via Prisma Studio.`,
        );
      }
      const mapper = BASE44_MAPPERS.get(mapperName);
      if (!mapper) {
        throw new Error(
          `Base44 connector ${spec.name}: mapper '${mapperName}' não registrado. ` +
            `Registrar via registerBase44Mapper() em packages/connectors antes de criar o DataSource.`,
        );
      }
      return new Base44Connector({
        appId: spec.endpoint,
        apiKey,
        entityName,
        mapper,
        ...(incrementalField ? { incrementalField } : {}),
        ...(serverUrl ? { serverUrl } : {}),
        name: spec.name,
      });
    }
  }
}

export function createTargetConnector(spec: DataSourceSpec, opts: FactoryOptions): TargetConnector {
  if (spec.type !== 'XLSX') {
    throw new Error(`createTargetConnector only handles XLSX — got ${spec.type} for ${spec.name}`);
  }

  if (opts.useMock) {
    return new FixtureTargetConnector({ fixturesDir: opts.fixturesDir, name: spec.name });
  }

  const cfg = spec.config ?? {};
  for (const k of ['tenantId', 'clientId', 'clientSecret', 'sitePath']) {
    if (!cfg[k]) throw new Error(`SharePoint connector ${spec.name} requires config.${k}`);
  }

  return new SharePointXlsxConnector({
    tenantId: cfg['tenantId']!,
    clientId: cfg['clientId']!,
    clientSecret: cfg['clientSecret']!,
    sitePath: cfg['sitePath']!,
    filePath: spec.endpoint,
    name: spec.name,
  });
}

/** Default fixtures directory: `<repo-root>/painel_v27`. */
export function defaultFixturesDir(): string {
  return path.resolve(process.cwd(), '..', '..', 'painel_v27');
}
