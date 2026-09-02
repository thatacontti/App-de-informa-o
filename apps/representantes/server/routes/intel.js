// API da Inteligência de Compra e Sugestão de Pedido.
// Segurança: token EXCIA nunca sai do backend; representante só analisa
// clientes da própria carteira (diretoria/gestão/marketing veem todos).
import { Router } from 'express';
import { requireAuth, requireRole, isDiretoria } from '../auth.js';
import { idb } from '../lib/intelDb.js';
import { exciaGet, exciaConfigurado } from '../lib/exciaClient.js';
import { syncGeral, syncItensDoCliente, statusSync } from '../lib/intelSync.js';
import { firebirdConfigurado, fbPing } from '../lib/firebirdClient.js';
import {
  perfil360, dnaCompra, clusters, recomendarColecao, perfilEstetico, clientesSemelhantes,
} from '../lib/intelMotor.js';

export const intel = Router();
intel.use(requireAuth);

// Rep 0081 na EXCIA = cod '81' na plataforma (zero à esquerda até 4 dígitos).
const repEhDono = (user, codcli) => {
  const meu = String(user.cod).padStart(4, '0');
  const cli = idb.prepare('SELECT codrep FROM clientes_ex WHERE codcli=?').get(String(codcli));
  const reps = cli ? JSON.parse(cli.codrep || '[]') : [];
  if (reps.some((r) => String(r).padStart(4, '0') === meu)) return true;
  // fallback: pedidos do cliente com o codrep do usuário
  const n = idb.prepare('SELECT COUNT(*) c FROM pedidos WHERE codcli=? AND codrep=?')
    .get(String(codcli), meu).c;
  return n > 0;
};

// Completa cidade/UF/cadastro do cliente via REST BuscarEntidade (uma vez).
async function enriquecerCadastro(codcli) {
  if (!exciaConfigurado()) return;
  const c = idb.prepare('SELECT cidade, cnpj FROM clientes_ex WHERE codcli=?').get(String(codcli));
  if (!c || (c.cidade && c.cidade.trim())) return; // já enriquecido
  if (!c.cnpj) return;
  try {
    const regs = await exciaGet('BuscarEntidade', { cnpj: c.cnpj });
    const e = Array.isArray(regs) ? regs[0] : null;
    if (e) {
      idb.prepare(`UPDATE clientes_ex SET cidade=?, uf=?,
        data_cad=COALESCE(data_cad,?), raw=? WHERE codcli=?`).run(
        e.nome_cid || '', e.cod_est || '',
        (() => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(e.data_cad || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; })(),
        JSON.stringify(e), String(codcli),
      );
    }
  } catch { /* enriquecimento é best-effort */ }
}

function podeVer(req, res, next) {
  const { codcli } = req.params;
  if (isDiretoria(req.user) || repEhDono(req.user, codcli)) return next();
  return res.status(403).json({ error: 'cliente fora da sua carteira' });
}

// ---- status / sync -------------------------------------------------------
intel.get('/status', (req, res) => {
  const contagens = {
    clientes: idb.prepare('SELECT COUNT(*) c FROM clientes_ex').get().c,
    pedidos: idb.prepare('SELECT COUNT(*) c FROM pedidos').get().c,
    pedidos_com_itens: idb.prepare('SELECT COUNT(*) c FROM pedidos WHERE itens_ok=1').get().c,
    itens: idb.prepare('SELECT COUNT(*) c FROM pedido_itens').get().c,
    produtos: idb.prepare('SELECT COUNT(*) c FROM produtos').get().c,
  };
  res.json({
    excia_configurado: exciaConfigurado(),
    firebird_configurado: firebirdConfigurado(),
    fonte: (process.env.INTEL_SOURCE || (firebirdConfigurado() ? 'firebird' : 'rest')).toLowerCase(),
    contagens, sync: statusSync(),
  });
});

// Diagnóstico da conexão direta ao Firebird (admin).
intel.get('/firebird/ping', requireRole('admin'), async (req, res) => {
  if (!firebirdConfigurado()) return res.status(503).json({ error: 'Firebird não configurado' });
  try {
    res.json(await fbPing());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

intel.post('/sync', requireRole('admin'), async (req, res) => {
  try {
    res.json(await syncGeral());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- coleções disponíveis ------------------------------------------------
intel.get('/colecoes', (req, res) => {
  const rows = idb.prepare(`
    SELECT p.colecao AS codigo, COALESCE(c.descricao, p.colecao) AS descricao,
           COUNT(*) AS produtos
    FROM produtos p LEFT JOIN catalogos c ON c.tipo='colecao' AND c.codigo=p.colecao
    WHERE p.ativo='S' AND p.colecao <> ''
    GROUP BY p.colecao ORDER BY CAST(p.colecao AS INTEGER) DESC LIMIT 12
  `).all();
  res.json(rows);
});

// ---- busca por nome (autocomplete do campo Código do Cliente) ------------
intel.get('/clientes', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  let rows = idb.prepare(`
    SELECT codcli, nome, fantasia, cidade, uf FROM clientes_ex
    WHERE codcli LIKE ? OR nome LIKE ? OR fantasia LIKE ? LIMIT 40
  `).all(`${q}%`, `%${q}%`, `%${q}%`);
  if (!isDiretoria(req.user)) rows = rows.filter((r) => repEhDono(req.user, r.codcli));
  res.json(rows.slice(0, 15));
});

// ---- análise do cliente --------------------------------------------------
intel.get('/cliente/:codcli', podeVer, async (req, res) => {
  const { codcli } = req.params;
  try {
    // Cache-first: sincroniza itens pendentes deste cliente (1 chamada/pedido,
    // uma vez). Com a carga Firebird os itens já vêm todos, então isto vira
    // no-op; segue como enriquecimento/fallback quando algum pedido ficou sem itens.
    let syncInfo = null;
    if (exciaConfigurado()) {
      try {
        syncInfo = await syncItensDoCliente(codcli);
      } catch (e) {
        syncInfo = { erro: `sincronização parcial: ${e.message}` };
      }
      // Cidade/UF não vêm na carga em massa do Firebird — completa uma vez via REST.
      await enriquecerCadastro(codcli);
    }
    const perfil = perfil360(codcli);
    if (!perfil) return res.status(404).json({ error: 'cliente sem cadastro e sem pedidos na base analítica' });
    const dna = dnaCompra(codcli);
    res.json({
      perfil,
      dna,
      clusters: clusters(codcli, perfil, dna),
      estetica: perfilEstetico(codcli),
      semelhantes: clientesSemelhantes(codcli, 8).map((s) => ({
        codcli: s.codcli,
        similaridade: Math.round(s.sim * 100),
        nome: idb.prepare('SELECT nome FROM clientes_ex WHERE codcli=?').get(s.codcli)?.nome || s.codcli,
      })),
      sync: syncInfo,
    });
  } catch (e) {
    console.error('[intel] analise falhou:', e);
    res.status(500).json({ error: e.message });
  }
});

intel.get('/cliente/:codcli/recomendacoes', podeVer, (req, res) => {
  const { codcli } = req.params;
  const colecao = String(req.query.colecao || '').trim();
  if (!colecao) return res.status(400).json({ error: 'informe ?colecao=' });
  try {
    const r = recomendarColecao(codcli, colecao);
    if (r.erro) return res.status(422).json({ error: r.erro });
    res.json(r);
  } catch (e) {
    console.error('[intel] recomendacao falhou:', e);
    res.status(500).json({ error: e.message });
  }
});

// ---- feedback do representante ------------------------------------------
intel.post('/feedback', podeVerBody, (req, res) => {
  const { codcli, colecao, codigo, sugestao, acao, alteracao } = req.body || {};
  if (!codcli || !codigo || !['aceito', 'alterado', 'rejeitado'].includes(acao)) {
    return res.status(400).json({ error: 'campos obrigatórios: codcli, codigo, acao (aceito|alterado|rejeitado)' });
  }
  const r = idb.prepare(`INSERT INTO feedback_sugestao
    (codcli, colecao, codigo, sugestao, acao, alteracao, usuario, usuario_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    String(codcli), String(colecao || ''), String(codigo),
    JSON.stringify(sugestao || {}), acao,
    alteracao ? JSON.stringify(alteracao) : null,
    String(req.user.cod), req.user.nome || '',
  );
  res.json({ ok: true, id: r.lastInsertRowid });
});
function podeVerBody(req, res, next) {
  const codcli = req.body?.codcli;
  if (!codcli) return next();
  if (isDiretoria(req.user) || repEhDono(req.user, codcli)) return next();
  return res.status(403).json({ error: 'cliente fora da sua carteira' });
}

intel.get('/feedback', (req, res) => {
  const rows = idb.prepare(`
    SELECT * FROM feedback_sugestao
    ${isDiretoria(req.user) ? '' : 'WHERE usuario = ?'}
    ORDER BY criado_em DESC LIMIT 200
  `).all(...(isDiretoria(req.user) ? [] : [String(req.user.cod)]));
  res.json(rows);
});

// ---- imagem do produto (proxy + cache; token fica no servidor) ----------
intel.get('/imagem/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).trim();
  const cache = idb.prepare('SELECT * FROM img_cache WHERE codigo=?').get(codigo);
  if (cache) {
    if (!cache.base64) return res.status(404).end(); // "sem imagem" também é cacheado
    res.set('Cache-Control', 'public, max-age=86400');
    return res.type('image/jpeg').send(Buffer.from(cache.base64, 'base64'));
  }
  if (!exciaConfigurado()) return res.status(404).end();
  try {
    const regs = await exciaGet('CarregaImagemProduto', { codigo, tipo_item: 'P' });
    const img = Array.isArray(regs) ? regs[0]?.imagens?.[0] : null;
    if (!img?.imagem) {
      idb.prepare(`INSERT OR REPLACE INTO img_cache (codigo, arquivo, base64, atualizado_em)
        VALUES (?, '', '', datetime('now'))`).run(codigo);
      return res.status(404).end();
    }
    idb.prepare(`INSERT OR REPLACE INTO img_cache (codigo, arquivo, base64, atualizado_em)
      VALUES (?, ?, ?, datetime('now'))`).run(codigo, img.arquivo || '', img.imagem);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.type('image/jpeg').send(Buffer.from(img.imagem, 'base64'));
  } catch {
    return res.status(404).end();
  }
});
