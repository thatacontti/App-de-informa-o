// Factory — given a DataSource record + the USE_MOCK_CONNECTORS flag,
// returns the right connector instance. Keeps the call sites in
// packages/jobs free of the real-vs-mock branching.

import * as path from 'node:path';
import { CrmApiConnector } from './crm-api';
import { ErpPostgresConnector } from './erp-postgres';
import { FixtureSaleConnector, FixtureTargetConnector } from './fixture';
import { SharePointXlsxConnector } from './sharepoint-xlsx';
import type { ConnectorType, SaleConnector, TargetConnector } from './types';

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

  if (opts.useMock) {
    return new FixtureSaleConnector({ type: spec.type, fixturesDir: opts.fixturesDir, name: spec.name });
  }

  if (spec.type === 'ERP_DB') {
    return new ErpPostgresConnector({
      connectionString: spec.endpoint,
      name: spec.name,
      view: spec.config?.['view'],
    });
  }

  // CRM_API
  const token = spec.config?.['token'];
  if (!token) throw new Error(`CRM connector ${spec.name} requires config.token`);
  return new CrmApiConnector({
    baseUrl: spec.endpoint,
    token,
    name: spec.name,
  });
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
