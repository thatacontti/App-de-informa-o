// Cliente Firebird (consulta direta ao ERP EXCIA) — uso exclusivo do backend.
// Fonte: jdbc:firebirdsql://179.190.96.196:9083/E:\TI\KIKI.fdb?encoding=ISO8859_1
// Credenciais SÓ em variáveis de ambiente; nunca expostas ao frontend.
//
// Complementa a API REST: para carga em massa (clientes/produtos/pedidos/itens)
// a consulta SQL é uma chamada só, sem a paginação que estoura o sort do
// Firebird via REST. As duas fontes convivem (INTEL_SOURCE controla a carga).
//
// Cuidados descobertos na base KIKI.fdb:
// - O driver node-firebird decodifica DATE/TIMESTAMP errado (ex.: "2500-01-01").
//   Nunca ler datas como objeto Date: trazer ANO/MÊS/DIA via EXTRACT e montar
//   a ISO em JS (ver dataISO()).
// - Preço de venda mora em TABPRECO_001 por CÓDIGO + REGIÃO (= TAB_PRE do
//   pedido). Item (PEDIDO3) não tem preço, só custo.
// - Tabelas têm sufixo de empresa (_001 = empresa principal).
import Firebird from 'node-firebird';

export const FB_EMPRESA = process.env.FIREBIRD_EMPRESA || '001';

const options = {
  host: process.env.FIREBIRD_HOST || '179.190.96.196',
  port: Number(process.env.FIREBIRD_PORT || 9083),
  database: process.env.FIREBIRD_DATABASE || 'E:/TI/KIKI.fdb',
  user: process.env.FIREBIRD_USER || 'kiki',
  password: process.env.FIREBIRD_PASSWORD || '',
  lowercase_keys: true,
  encoding: process.env.FIREBIRD_CHARSET || 'ISO8859_1',
  pageSize: 4096,
};

const POOL_MAX = Number(process.env.FIREBIRD_POOL || 3);
let pool = null;

export function firebirdConfigurado() {
  return Boolean(options.host && options.database && options.user && options.password);
}

function getPool() {
  if (!pool) pool = Firebird.pool(POOL_MAX, options);
  return pool;
}

// Executa uma query e devolve todas as linhas (para result sets limitados).
export function fbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getPool().get((err, db) => {
      if (err) return reject(new Error(`Firebird indisponível: ${err.message || err}`));
      db.query(sql, params, (e, rows) => {
        db.detach(() => {});
        if (e) return reject(new Error(`Firebird SQL: ${e.message || e}`));
        resolve(rows || []);
      });
    });
  });
}

// Streaming linha a linha (para PEDIDO3, com >1M itens) sem carregar tudo na
// memória. db.sequentially entrega os registros de forma síncrona
// (row, index); onRow(lote) DEVE ser síncrono — como better-sqlite3 grava de
// forma síncrona, isso é natural. Erro dentro do onRow aborta a carga.
export function fbStream(sql, params, onRow, { batch = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    getPool().get((err, db) => {
      if (err) return reject(new Error(`Firebird indisponível: ${err.message || err}`));
      let n = 0;
      let buf = [];
      let falhou = null;
      const flush = () => {
        if (!buf.length || falhou) return;
        const lote = buf; buf = [];
        try { onRow(lote); } catch (e2) { falhou = e2; }
      };
      db.sequentially(sql, params, (row) => {
        if (falhou) return;
        buf.push(row); n++;
        if (buf.length >= batch) flush();
      }, (e) => {
        db.detach(() => {});
        if (e) return reject(new Error(`Firebird stream: ${e.message || e}`));
        flush();
        if (falhou) return reject(falhou);
        resolve(n);
      });
    });
  });
}

// Monta ISO 'YYYY-MM-DD' a partir de colunas numéricas (aa, mm, dd) trazidas
// por EXTRACT — evita o Date corrompido do driver.
export function dataISO(aa, mm, dd) {
  if (!aa || aa < 1990 || aa > 2100) return null; // descarta lixo (ex.: 2500)
  const p = (v) => String(v).padStart(2, '0');
  return `${aa}-${p(mm)}-${p(dd)}`;
}

export async function fbPing() {
  const r = await fbQuery('SELECT COUNT(*) AS n FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0');
  return { ok: true, tabelas: r[0]?.n ?? null };
}
