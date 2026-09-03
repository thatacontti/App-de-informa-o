// Cliente HTTP da API EXCIA — uso exclusivo do backend.
// Contrato (intranet.excia.com.br/api, cópia local em 05_fontes_excia/api_real):
// - Autenticação: header `Token: <valor>` em toda requisição (nunca vai ao frontend).
// - Paginação: `?pagina=N`, 300 registros/página; fim da lista responde HTTP 400.
// - Rate limit: HTTP 429 + headers X-RateLimit-Limit/-Remaining/-Reset e
//   Retry-After (milissegundos).
// - Erros de negócio: HTTP 400 com [{ "error"|"method-error-400": "..." }].
const BASE = (process.env.EXCIA_BASE || '').replace(/\/+$/, '');
const TOKEN = process.env.EXCIA_TOKEN || '';
const TIMEOUT_MS = Number(process.env.EXCIA_TIMEOUT_MS || 40000);
const MAX_RETRIES_429 = 5;
const MAX_RETRIES_REDE = 3; // timeout/queda de conexão: retry com backoff

export function exciaConfigurado() {
  return Boolean(BASE && TOKEN && !/^troque/.test(TOKEN));
}

export class ExciaError extends Error {
  constructor(message, { status = 0, body = null, url = '' } = {}) {
    super(message);
    this.name = 'ExciaError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Estado do rate limit observado nos headers da última resposta.
const rl = { remaining: null, resetMs: 0, observadoEm: 0 };

function lerRateLimit(res) {
  const rem = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  if (rem !== null) {
    rl.remaining = Number(rem);
    rl.resetMs = Number(reset || 0);
    rl.observadoEm = Date.now();
  }
}

// Espera preventiva quando o ciclo atual está esgotado (evita tomar 429).
async function respeitarRateLimit() {
  if (rl.remaining !== null && rl.remaining <= 1) {
    const desde = Date.now() - rl.observadoEm;
    const falta = Math.max(rl.resetMs - desde, 0);
    if (falta > 0 && falta < 10000) await sleep(falta + 50);
    rl.remaining = null;
  }
}

/**
 * GET na API EXCIA. Retorna o JSON (a API sempre responde arrays).
 * Lança ExciaError; status 400 chega com .status=400 para o chamador
 * decidir (fim de paginação é um 400 documentado).
 */
export async function exciaGet(path, params = {}) {
  if (!exciaConfigurado()) {
    throw new ExciaError('EXCIA_BASE/EXCIA_TOKEN não configurados no ambiente', { status: 0 });
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${BASE}/${path.replace(/^\/+/, '')}${qs.size ? `?${qs}` : ''}`;

  let errosRede = 0;
  for (let tentativa = 0; ; tentativa++) {
    await respeitarRateLimit();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { headers: { Token: TOKEN }, signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      const motivo = e.name === 'AbortError' ? `timeout após ${TIMEOUT_MS}ms` : e.message;
      if (++errosRede <= MAX_RETRIES_REDE) {
        await sleep(1500 * 2 ** (errosRede - 1)); // 1,5s → 3s → 6s
        continue;
      }
      throw new ExciaError(`falha de rede na EXCIA: ${motivo}`, { url });
    }
    clearTimeout(timer);
    errosRede = 0;
    lerRateLimit(res);

    if (res.status === 429) {
      if (tentativa >= MAX_RETRIES_429) {
        throw new ExciaError('limite de requisições EXCIA excedido (429) após retries', { status: 429, url });
      }
      // Retry-After vem em milissegundos (documentado).
      const retryAfter = Number(res.headers.get('retry-after') || 0);
      await sleep(retryAfter > 0 && retryAfter < 60000 ? retryAfter : 1000 * (tentativa + 1));
      continue;
    }

    let body = null;
    const texto = await res.text();
    try { body = texto ? JSON.parse(texto) : null; } catch { body = texto; }

    if (!res.ok) {
      const detalhe = Array.isArray(body) && body[0]
        ? (body[0].error || body[0]['method-error-400'] || JSON.stringify(body[0]))
        : String(body || res.statusText).slice(0, 300);
      throw new ExciaError(`EXCIA ${res.status}: ${detalhe}`, { status: res.status, body, url });
    }
    return body;
  }
}

/**
 * Percorre todas as páginas de um endpoint paginado (?pagina=N).
 * Fim da lista = HTTP 400 (documentado) ou página vazia.
 * `onPage(regs, pagina)` é chamado a cada página; retorna o total de registros.
 */
export async function exciaTodasPaginas(path, params = {}, onPage) {
  let total = 0;
  for (let pagina = 1; ; pagina++) {
    let regs;
    try {
      regs = await exciaGet(path, { ...params, pagina });
    } catch (e) {
      if (e instanceof ExciaError && e.status === 400) {
        // Fim da lista (paginação) ou consulta sem registros — ambos documentados como 400.
        if (pagina > 1 || /nenhum registro/i.test(e.message)) break;
      }
      throw e;
    }
    if (!Array.isArray(regs) || regs.length === 0) break;
    total += regs.length;
    await onPage(regs, pagina);
    if (regs.length < 300) break; // página incompleta = última
  }
  return total;
}

// Datas EXCIA: DD/MM/AAAA (e DD/MM/AAAA HH:MM:SS) <-> ISO.
export function dataExciaParaISO(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
export function isoParaDataExcia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
