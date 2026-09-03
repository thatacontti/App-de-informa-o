// Motor de recomendação — porte fiel de frontend/formulario.html (gerar()).
// Fonte da verdade no servidor: o cliente mostra a prévia, aqui é oficial.
// Regras: docs/TOOLKIT_SELLOUT_GRUPOCATARINA.md §6 e §7.

export const DORES = [
  { id: 'C1', a: [1] }, { id: 'C2', a: [2] }, { id: 'C3', a: [3] },
  { id: 'C4', a: [4, 7] }, { id: 'C5', a: [5] }, { id: 'C6', a: [6] },
  { id: 'C7', a: [7] }, { id: 'C8', a: [8] },
  { id: 'C9', a: [8], flag: 'queima' }, { id: 'C10', a: [5, 1], flag: 'coord' },
];

export const ACOES = {
  1: { n: 'Incentivo de Vendedoras', inv: [800, 2500] },
  2: { n: 'Ativação de Lançamento', inv: [1500, 5000] },
  3: { n: 'Redes Sociais Cooperadas', inv: [0, 3000] },
  4: { n: 'Influenciador Local', inv: [1500, 4000], prog: 'AÇÃO PROGRAMADA A' },
  5: { n: 'Trade PDV: Vitrine e Sinalização', inv: [300, 1200] },
  6: { n: 'Espaço Permanente Mobiliário/Gôndola', inv: [150, 8000], prog: 'AÇÃO PROGRAMADA C' },
  7: { n: 'OOH de Proximidade', inv: [2000, 12000] },
  8: { n: 'Campanha Promocional (Compre e Concorra / Compre e Ganhe)', inv: [3000, 30000] },
};

export const A8_VARIANTES = {
  guarda: { n: 'Guarda-Roupa KIKI · Compre e Concorra', prog: 'AÇÃO PROGRAMADA D', inv: [8000, 30000] },
  livro: { n: 'Compre e Ganhe Livro de Colorir', prog: 'AÇÃO PROGRAMADA B', inv: [3000, 8000] },
};

// Alçada por valor (toolkit §7): ≤1.500 regional; ≤5.000 gerência+head; acima comitê.
export function alcadaPorValor(invMax) {
  if (invMax <= 1500) return 'Gestor regional + Trade';
  if (invMax <= 5000) return 'Gerência comercial + Head Produto & Marketing';
  return 'Comitê mensal (Comercial + Marketing + Diretoria)';
}

/**
 * Executa o motor. `input`:
 *   { curva, tend, tipologia, contra, notas:{C1..C10}, ranked? }
 * Retorna { ranked, kit, invMin, invMax, meta, alertas, alcada, a8v }.
 */
export function prescrever({ curva, tend, tipologia, contra, notas = {} }) {
  const alertas = [];
  const prioritarias = DORES
    .filter((d) => (notas[d.id] || 0) >= 4)
    .sort((a, b) => (notas[b.id] || 0) - (notas[a.id] || 0));

  // score por ação
  const score = {};
  prioritarias.forEach((d) =>
    d.a.forEach((a) => { score[a] = (score[a] || 0) + ((notas[d.id] || 0) - 3) + 1; }));

  // filtros de elegibilidade (§6.1)
  const bloqueadas = new Set();
  if (curva === 'C' && tend === 'down') {
    [2, 4, 6, 7, 8].forEach((a) => bloqueadas.add(a));
    alertas.push('Histórico ERP: cliente curva C em queda. Ações de alto investimento bloqueadas pelo motor; kit limitado a Incentivo, Redes básico e Trade leve. Recomenda-se pauta comercial antes de ampliar verba.');
  }
  if (curva === 'A' && tend === 'up') { score[6] = (score[6] || 0) + 2; score[2] = (score[2] || 0) + 2; }
  if (contra === 'baixa') {
    if (score[2]) score[2] -= 2;
    if (score[7]) score[7] -= 2;
    if (score[3]) score[3] += 1;
    if (score[5]) score[5] += 1;
    alertas.push('Disposição de contrapartida baixa: o motor rebaixou ações dependentes do lojista e priorizou ações autoportantes.');
  }
  if (tipologia === 'P3') {
    alertas.push('Loja de shopping: OOH substituído por mall media + digital geolocalizado; toda ação exige anuência da administração (+5 dias úteis no fluxo).');
  }
  if (curva === 'C') bloqueadas.add(6);

  // seleção top 3
  let ranked = Object.entries(score)
    .filter(([a, s]) => s > 0 && !bloqueadas.has(+a))
    .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([a]) => +a);

  if (ranked.length === 0) {
    ranked = [5, 3];
    alertas.push('Nenhuma dor crítica (nota 4 ou 5) sinalizada: o motor sugere o kit de manutenção (Trade leve + Redes básico). Revise a análise se a leitura de campo indicar problema real.');
  }

  // variante da ação 8
  let a8v = null;
  if (ranked.includes(8)) {
    a8v = (notas.C9 >= 4 || curva === 'C') ? A8_VARIANTES.livro : A8_VARIANTES.guarda;
  }

  // kit + investimento
  let invMin = 0, invMax = 0;
  const kit = ranked.map((a) => {
    let d = { ...ACOES[a] };
    if (a === 8 && a8v) d = { ...d, ...a8v };
    if (a === 7 && tipologia === 'P3') d = { ...d, n: 'Mall Media + Digital Geolocalizado (substitui OOH)' };
    invMin += d.inv[0];
    invMax += d.inv[1];
    return { num: a, nome: d.n, inv: d.inv, prog: d.prog || null };
  });

  const meta = 10 + ranked.length * 3 +
    (curva === 'B' && tend === 'up' ? 4 : 0) + (contra === 'alta' ? 3 : 0);

  return { ranked, kit, invMin, invMax, meta, alertas, alcada: alcadaPorValor(invMax), a8v: a8v?.n || null };
}
