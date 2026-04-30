import type { BriefingPayload } from './engine';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const fmtNum = (v: number) => Math.round(v).toLocaleString('pt-BR');

const MONTH = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const fmtDateLong = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')} de ${MONTH[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;

const HEADLINE_COLOR: Record<string, { bg: string; bar: string; ico: string }> = {
  win:  { bg: '#e8f0e0', bar: '#6b8a5f', ico: '↑' },
  risk: { bg: '#fde0d8', bar: '#b53a4a', ico: '!' },
  goal: { bg: '#f9e6d4', bar: '#c97f7f', ico: '◎' },
};

export function renderBriefingHTML(payload: BriefingPayload): string {
  const { kpis, headlines, risks, decisions, brandSss, periodStart, periodEnd } = payload;

  const risksHTML = risks.length
    ? risks
        .map(
          (r) =>
            `<li class="risk-item"><b>${r.scope === 'BRAND' ? '★' : '◐'} ${r.scopeKey}</b> · ${r.detail}</li>`,
        )
        .join('')
    : '<li class="risk-item ok"><b>Nenhum risco acima do limite (-5%)</b> · operação saudável.</li>';

  return /* html */ `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Briefing Diretoria · V27</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1a0f0a;
    background: #faf3ee;
    line-height: 1.45;
    font-size: 11pt;
  }
  .hero {
    background: linear-gradient(135deg, #3a1820 0%, #5a2735 35%, #8b4a52 75%, #c97f7f 100%);
    color: #fef9f5;
    padding: 24pt 28pt;
    border-radius: 16pt;
    margin-bottom: 16pt;
  }
  .hero .tag {
    display: inline-block;
    background: rgba(212, 146, 143, .25);
    border: 1px solid rgba(212, 146, 143, .4);
    color: #d4928f;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4pt 10pt;
    border-radius: 2pt;
    margin-bottom: 8pt;
  }
  .hero h1 {
    font-family: Georgia, serif;
    font-size: 26pt;
    font-weight: 300;
    letter-spacing: -0.5pt;
  }
  .hero h1 b { font-weight: 800; font-style: italic; color: #d4928f; }
  .hero .meta { font-size: 9.5pt; opacity: .82; margin-top: 6pt; }

  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8pt;
    margin-bottom: 12pt;
  }
  .kpi {
    background: #fef9f5;
    border-left: 3pt solid #d4928f;
    padding: 8pt 10pt;
    border-radius: 6pt;
  }
  .kpi .l { font-style: italic; font-size: 8pt; color: #8a7f74; }
  .kpi .v {
    font-family: Georgia, serif;
    font-size: 16pt;
    font-weight: 700;
    color: #4a1f25;
    line-height: 1.05;
    margin-top: 2pt;
  }
  .kpi .s { font-size: 7.5pt; color: #8a7f74; margin-top: 2pt; }

  h2.section {
    font-family: Georgia, serif;
    font-size: 14pt;
    font-weight: 600;
    color: #4a1f25;
    margin: 16pt 0 6pt;
    padding-bottom: 4pt;
    border-bottom: 1pt solid #d4928f55;
  }

  .headlines {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8pt;
    margin-bottom: 8pt;
  }
  .headline {
    border-radius: 8pt;
    padding: 10pt 12pt;
    border-left: 4pt solid #ccc;
  }
  .headline .ico {
    font-family: Georgia, serif;
    font-size: 14pt;
    font-weight: 800;
    margin-right: 6pt;
  }
  .headline .title {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1pt;
    color: #4a1f25;
    margin-bottom: 4pt;
  }
  .headline .value {
    font-family: Georgia, serif;
    font-size: 22pt;
    font-weight: 700;
    color: #4a1f25;
    line-height: 1;
  }
  .headline .detail { font-size: 8.5pt; color: #4a3a2f; margin-top: 4pt; }

  .risks { background: #fef9f5; border-radius: 8pt; padding: 10pt 14pt; }
  .risk-item {
    list-style: none;
    padding: 6pt 0;
    border-bottom: 1pt dashed #d4928f33;
    font-size: 9.5pt;
    color: #4a3a2f;
  }
  .risk-item:last-child { border-bottom: none; }
  .risk-item.ok b { color: #6b8a5f; }

  .marca-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4pt;
    font-size: 9.5pt;
    background: #fef9f5;
    border-radius: 8pt;
    overflow: hidden;
  }
  .marca-table th, .marca-table td {
    padding: 6pt 8pt;
    text-align: left;
    border-bottom: 1pt solid #d4928f22;
  }
  .marca-table th {
    background: #f5e1d9;
    font-style: italic;
    font-size: 8pt;
    color: #8b4a52;
    font-weight: 600;
  }
  .marca-table td.r { text-align: right; }
  .marca-table tr:last-child td { border-bottom: none; }
  .pos { color: #6b8a5f; font-weight: 700; }
  .neg { color: #b53a4a; font-weight: 700; }

  .decisions { background: #fef9f5; border-radius: 8pt; padding: 10pt 14pt; }
  .decision {
    padding: 6pt 0;
    border-bottom: 1pt dashed #d4928f33;
    display: grid;
    grid-template-columns: auto 80pt;
    gap: 10pt;
    align-items: baseline;
  }
  .decision:last-child { border-bottom: none; }
  .decision .who {
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #c97f7f;
    letter-spacing: 1pt;
    text-align: right;
  }
  .decision .who small { display: block; color: #8a7f74; font-weight: 400; letter-spacing: 0; text-transform: none; }

  .footer {
    margin-top: 20pt;
    padding-top: 8pt;
    border-top: 1pt solid #d4928f33;
    text-align: center;
    font-size: 8pt;
    font-style: italic;
    color: #8a7f74;
  }
</style>
</head>
<body>
  <section class="hero">
    <span class="tag">Briefing Diretoria · V27</span>
    <h1>Verão <b>2027</b> · Grupo Catarina</h1>
    <div class="meta">Período do snapshot: ${fmtDateLong(periodStart)} · ${fmtDateLong(periodEnd)} — gerado em ${fmtDateLong(payload.generatedAt)}</div>
  </section>

  <h2 class="section">Headlines da semana</h2>
  <div class="headlines">
    ${headlines
      .map((h) => {
        const c = HEADLINE_COLOR[h.kind] ?? HEADLINE_COLOR.goal!;
        return `<div class="headline" style="background:${c.bg};border-left-color:${c.bar}">
          <div class="title"><span class="ico" style="color:${c.bar}">${c.ico}</span>${h.title}</div>
          <div class="value">${h.value}</div>
          <div class="detail">${h.detail}</div>
        </div>`;
      })
      .join('')}
  </div>

  <h2 class="section">KPIs do período</h2>
  <div class="kpis">
    <div class="kpi"><div class="l">Faturamento V27</div><div class="v">${fmtBRL(kpis.faturamento)}</div><div class="s">${fmtNum(kpis.pecas)} peças · PM ${fmtBRL(kpis.pm)}</div></div>
    <div class="kpi"><div class="l">SSS YoY (recorrentes)</div><div class="v">${fmtPct(kpis.sssYoY)}</div><div class="s">${kpis.recurringCount} cli recorrentes</div></div>
    <div class="kpi"><div class="l">NOVO 27</div><div class="v">${kpis.novosCount}</div><div class="s">conquistas líquidas</div></div>
    <div class="kpi"><div class="l">Atingimento meta</div><div class="v">${kpis.globalAttainmentPct.toFixed(1)}%</div><div class="s">global · BRL · V27</div></div>
  </div>

  <h2 class="section">SSS por marca</h2>
  <table class="marca-table">
    <thead><tr><th>Marca</th><th class="r">V26</th><th class="r">V27</th><th class="r">SSS YoY</th></tr></thead>
    <tbody>
      ${brandSss
        .map(
          (b) => `<tr>
            <td><b>${b.brand === 'MA' ? 'MENINA ANJO' : b.brand}</b></td>
            <td class="r">${fmtBRL(b.v26)}</td>
            <td class="r"><b>${fmtBRL(b.v27)}</b></td>
            <td class="r ${b.sss >= 0 ? 'pos' : 'neg'}"><b>${fmtPct(b.sss)}</b></td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2 class="section">Riscos rastreados</h2>
  <ul class="risks">${risksHTML}</ul>

  <h2 class="section">Próximas decisões</h2>
  <div class="decisions">
    ${decisions
      .map(
        (d) => `<div class="decision">
          <div>${d.action}</div>
          <div class="who">${d.owner}<small>${d.due}</small></div>
        </div>`,
      )
      .join('')}
  </div>

  <div class="footer">
    Painel V27 · Grupo Catarina · documento confidencial · gerado automaticamente pelo job briefing-diretoria
  </div>
</body>
</html>`;
}
