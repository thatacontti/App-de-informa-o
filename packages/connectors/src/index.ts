// @painel/connectors — uniform adapters for ERP / CRM / SharePoint.
// Real implementations land in step 4.

export interface RawRecord {
  source: 'ERP_DB' | 'CRM_API' | 'XLSX';
  fetchedAt: Date;
  payload: unknown;
}

export interface NormalizedRecord {
  source: 'ERP_DB' | 'CRM_API' | 'XLSX';
  externalId: string;
  data: Record<string, unknown>;
}

export interface Connector {
  readonly name: string;
  test(): Promise<boolean>;
  extract(since: Date): Promise<RawRecord[]>;
  transform(raw: RawRecord[]): Promise<NormalizedRecord[]>;
}
