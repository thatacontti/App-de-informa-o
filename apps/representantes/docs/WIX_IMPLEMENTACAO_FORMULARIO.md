# IMPLEMENTAÇÃO WIX | ÁREA EXCLUSIVA DO REPRESENTANTE
## Formulário Análise da Ação + Kit de Ativação | Toolkit Sell-Out Grupo Catarina
### Guia técnico Velo (Wix Studio) | Versão 1.0

---

# 1. ARQUITETURA NO WIX

O formulário deixa de ser HTML avulso e vira uma página dentro da **Área de Membros (Members Area)** do site, com login obrigatório. A linguagem muda de HTML/JS puro para o padrão Wix: **elementos do editor + código Velo** (frontend com `$w`, backend com web modules `.jsw`) e **coleções CMS** no lugar do banco simulado.

```
ÁREA DE MEMBROS (login obrigatório)
├── /minha-carteira ............ lista de clientes do representante logado
├── /analise-da-acao ........... O FORMULÁRIO (esta especificação)
├── /minhas-prescricoes ........ protocolos enviados e status da timeline
└── /aprovacoes (perfil gestor) . fila de aprovação comercial e marketing
```

**Papéis via Badges de membro (Site Members):**

| Badge | Quem | Acesso |
|---|---|---|
| Representante | Força de vendas | Formulário, carteira própria, prescrições próprias |
| GestorComercial | Gestores regionais | Fila de aprovação comercial da sua regional |
| Marketing | Trade/Brand | Fila de aprovação marketing, todas as prescrições |
| Admin | Produto & Marketing | Tudo + coleções |

---

# 2. COLEÇÕES CMS (Content Manager)

Espelham as tabelas da Seção 5 do toolkit. Criar com estes IDs de coleção e field keys exatos (o código depende deles).

## 2.1 `Clientes` (importada/sincronizada do ERP)
| Field key | Tipo | Nota |
|---|---|---|
| `codcli` | Text | chave de busca, indexar |
| `fantasia` | Text | |
| `cidade`, `uf` | Text | |
| `codrep` | Text | e-mail ou ID do membro representante |
| `fat24m` | Number | soma VALOR_LIQ últimos 2 anos |
| `curva` | Text | A/B/C, recalculada por coleção |
| `tendencia` | Text | up/flat/down |
| `ultimasColecoes` | Text | ex: "V27 · I26 · V26" |

Permissões: leitura Membros do site, escrita Admin (a carga vem do ERP por importação CSV ou API, nunca do formulário).

## 2.2 `Diagnosticos`
| Field key | Tipo |
|---|---|
| `codcli` | Text |
| `representante` | Text (e-mail do membro logado) |
| `tipologia` | Text (P1 a P4) |
| `motivo` | Text |
| `notas` | Object (JSON C1 a C10) |
| `contrapartida` | Text (alta/media/baixa) |
| `janelaLocal` | Text |
| `fotos` | Media Gallery / Array de URLs |
| `protocolo` | Text |

Permissões: criar Membro do site; ler Autor + Admin (Custom).

## 2.3 `Acoes`
`protocolo`, `codcli`, `acoes` (Object: lista do kit com nome, investimento, contrapartida), `investMin`, `investMax`, `meta`, `alcada`, `status` (Text: em_aprovacao_comercial, em_aprovacao_marketing, aguardando_termo, em_producao, em_execucao, concluida, reprovada), `alertas` (Object).

## 2.4 `Aprovacoes`
`protocolo`, `instancia` (comercial/marketing/shopping), `aprovador`, `decisao`, `justificativa`, `dataDecisao`.

Permissões de 2.3 e 2.4: escrita somente via backend (`suppressAuth`), leitura por badge.

---

# 3. PÁGINA /analise-da-acao: ELEMENTOS DO EDITOR

Montar a página no editor com estes IDs (painel Propriedades). A cópia de tela segue a linguagem já definida: passos numerados, "Análise da ação" como título do passo 04.

| ID do elemento | Tipo Wix | Função |
|---|---|---|
| `#inpCodcli` | Input Text | Código da loja |
| `#btnBuscar` | Button | Buscar histórico |
| `#inpFantasia`, `#inpRep` | Input Text | `#inpRep` pré-preenchido e travado com o membro logado |
| `#boxErp` | Container (collapsed) | Painel do histórico ERP |
| `#txtFat`, `#txtCol`, `#txtCurva`, `#txtTend` | Text | Valores do ERP |
| `#selTipologia` | Selection Tags ou Radio Group | P1 a P4 |
| `#upFotos` | Upload Button (imagens, múltiplo) | Fotos do PDV, mínimo 2 |
| `#galFotos` | Gallery | Pré-visualização |
| `#inpMotivo` | Text Box | Motivo da ação |
| `#repDores` | Repeater | 10 itens (C1 a C10) |
| `#txtDor` (no item) | Text | Texto da dor + gatilho |
| `#rateDor` (no item) | Ratings Input (1 a 5) | Nota da dor |
| `#selContra` | Radio Group | alta/media/baixa |
| `#inpJanela` | Input Text | Janela local |
| `#btnGerar` | Button | "Gerar formulário" |
| `#txtWarn` | Text (collapsed) | Validações |
| `#boxRx` | Container (collapsed) | Cartão da prescrição |
| `#txtRxNum`, `#txtRxCliente`, `#txtRxPerfil`, `#txtRxFat`, `#txtRxDores`, `#txtRxMotivo` | Text | Cabeçalho da prescrição |
| `#repAcoes` | Repeater | Ações do kit (nome, mecânica, reason why, materiais, investimento, KPI, contrapartida) |
| `#txtTotInv`, `#txtTotMeta`, `#txtTotN` | Text | Totais |
| `#boxAlerta` | Container (collapsed) | Alertas do motor |
| `#btnEnviar` | Button | "Enviar para aprovação comercial" |
| `#boxProtocolo` | Container (collapsed) | Tela de protocolo |
| `#repTimeline` | Repeater | Etapas do fluxo com status |
| `#txtResumo` | Text Box (readonly) | Resumo para o gestor |
| `#btnCopiar` | Button | Copiar resumo |
| `#txtProx` | Text | O que o representante faz agora |

---

# 4. BACKEND: `backend/sellout.jsw`

```javascript
import wixData from 'wix-data';

// Curva e tendência vêm prontas da coleção Clientes (carga do ERP).
export async function getHistoricoCliente(codcli) {
  const res = await wixData.query('Clientes')
    .eq('codcli', String(codcli).trim())
    .limit(1)
    .find({ suppressAuth: true });
  if (res.items.length === 0) {
    return { encontrado: false };
  }
  const c = res.items[0];
  return {
    encontrado: true,
    fantasia: c.fantasia,
    fat24m: c.fat24m,
    curva: c.curva,
    tendencia: c.tendencia,
    ultimasColecoes: c.ultimasColecoes
  };
}

// Grava diagnóstico + ações + primeira instância de aprovação, tudo em backend.
export async function enviarPrescricao(payload) {
  const protocolo = payload.codcli + '-' +
    new Date().getFullYear().toString().slice(2) +
    Math.floor(100 + Math.random() * 900);

  await wixData.insert('Diagnosticos', {
    codcli: payload.codcli,
    representante: payload.representante,
    tipologia: payload.tipologia,
    motivo: payload.motivo,
    notas: payload.notas,
    contrapartida: payload.contrapartida,
    janelaLocal: payload.janela,
    fotos: payload.fotos,
    protocolo
  }, { suppressAuth: true });

  await wixData.insert('Acoes', {
    protocolo,
    codcli: payload.codcli,
    acoes: payload.kit,
    investMin: payload.invMin,
    investMax: payload.invMax,
    meta: payload.meta,
    alcada: payload.alcada,
    alertas: payload.alertas,
    status: 'em_aprovacao_comercial'
  }, { suppressAuth: true });

  await wixData.insert('Aprovacoes', {
    protocolo,
    instancia: 'comercial',
    decisao: 'pendente'
  }, { suppressAuth: true });

  // Notificação ao gestor: usar Triggered Email ou Automação Wix
  // disparada pela criação do item em Aprovacoes.

  return { protocolo };
}
```

---

# 5. FRONTEND: código da página /analise-da-acao

```javascript
import { getHistoricoCliente, enviarPrescricao } from 'backend/sellout.jsw';
import { currentMember } from 'wix-members-frontend';
import wixWindow from 'wix-window';

/* ---------- dados do motor (idênticos ao toolkit v1.2) ---------- */
const DORES = [
  { id: 'C1',  t: 'As vendedoras não conhecem ou não indicam nossas marcas', a: [1] },
  { id: 'C2',  t: 'A coleção chega e não acontece nada, sem evento de novidade', a: [2] },
  { id: 'C3',  t: 'A loja não gera demanda digital, Instagram fraco ou sem material', a: [3] },
  { id: 'C4',  t: 'Consumidoras da cidade não conhecem ou não pedem a marca', a: [4, 7] },
  { id: 'C5',  t: 'O produto fica escondido, vitrine e exposição fracas', a: [5] },
  { id: 'C6',  t: 'O lojista quer destacar a marca mas não tem estrutura ou mobiliário', a: [6] },
  { id: 'C7',  t: 'A marca não aparece na cidade, concorrente domina a praça', a: [7] },
  { id: 'C8',  t: 'O giro está lento e o lojista pede promoção ou desconto', a: [8] },
  { id: 'C9',  t: 'Estoque parado de coleções anteriores trava a recompra', a: [8] },
  { id: 'C10', t: 'O lojista compra pouco mix, só básicos, não leva coordenados', a: [5, 1] }
];

const ACOES = {
  1: { n: 'Incentivo de Vendedoras', inv: [800, 2500],
       mec: 'Ciclo de 45 dias com meta individual por vendedora, treinamento relâmpago semanal via WhatsApp e premiação escalonada.',
       rw: 'No multimarca, quem decide o que sai da arara é a vendedora. Engajada por incentivo, ela vira força de vendas terceirizada com o menor custo por peça incremental do cardápio.',
       kit: 'Regulamento 1 página; Cartela de metas; Vídeos de treinamento; Arte convite WhatsApp; Planilha de apuração',
       kpi: 'Peças por vendedora por ciclo vs baseline',
       contra: 'Liberar as vendedoras e garantir frente de arara' },
  2: { n: 'Ativação de Lançamento', inv: [1500, 5000],
       mec: 'Dia de Lançamento em até 10 dias da chegada da coleção: vitrine temática, mini evento para a criança, convite via WhatsApp e brinde exclusivo (nunca desconto).',
       rw: 'Novidade é o principal driver de tráfego na moda. O evento cria urgência e transforma a chegada do produto em mídia gratuita e experiência de marca.',
       kit: 'Vitrine temática; Convite digital editável; Roteiro do evento; Brindes por faixa de pedido; Playlist da marca',
       kpi: 'Sell-out 30 dias pós-lançamento vs coleção anterior',
       contra: 'Custear a experiência local e disparar convites; meta de 20% do pedido em 30 dias' },
  3: { n: 'Redes Sociais Cooperadas', inv: [0, 3000],
       mec: 'Pack mensal Reels-first por coleção e por marca, calendário editorial, roteiros de Reels e mídia local cooperada 50/50 no nível avançado.',
       rw: 'A compradora decide onde comprar pelo Instagram local. A marca tem o conteúdo, o lojista tem a audiência: o co-marketing junta os dois a custo marginal quase zero.',
       kit: 'Pack de 12 artes/mês; Banco de vídeos; Roteiros de Reels; Guia de tom de voz; Tutorial de impulsionamento',
       kpi: '8+ posts/mês com material do grupo e alcance local',
       contra: 'Marcar o perfil da marca e seguir o guia de uso' },
  4: { n: 'Influenciador Local', inv: [1500, 4000], prog: 'AÇÃO PROGRAMADA A',
       mec: 'O lojista indica a influenciadora da cidade; validado o perfil, ela recebe caixa com até R$2.000 em produtos + briefing e entrega 1 Reel + 3 stories marcando a loja.',
       rw: 'Mãe confia em mãe. A indicação partir do lojista garante relevância local real e co-responsabilidade; o conteúdo regionalizado encurta o caminho entre desejo e prateleira.',
       kit: 'Caixa de produtos até R$2.000; Briefing visual; Roteiro de conteúdo; Guia de impulsionamento; Contrato modelo',
       kpi: 'Vendas declaradas na janela da campanha',
       contra: 'Repostar o conteúdo e destacar os produtos da caixa na loja' },
  5: { n: 'Trade PDV: Vitrine e Sinalização', inv: [300, 1200],
       mec: 'Kit vitrine da coleção + stopper de arara, tag de coordenado e régua de tamanhos. Programa Vitrine Premiada garante execução com foto auditada.',
       rw: 'A maior parte da decisão acontece dentro do PDV, e produto sem sinalização é produto invisível. A tag de coordenado sugere o look completo e eleva o ticket.',
       kit: 'Fundo de vitrine; Stoppers; Tags de coordenado; Régua E/M/P; Guia de montagem',
       kpi: 'Sell-out das peças sinalizadas e ticket médio',
       contra: 'Montar conforme o guia e enviar foto em 5 dias' },
  6: { n: 'Espaço Permanente Mobiliário/Gôndola', inv: [150, 8000], prog: 'AÇÃO PROGRAMADA C',
       mec: 'Mobiliário exclusivo (fixo ou móvel) em comodato de até 24 meses, com planograma, atualização visual por coleção e auditoria semestral.',
       rw: 'Espaço fixo é share de loja garantido: eleva percepção de valor, organiza o sortimento e cria barreira física contra concorrentes.',
       kit: 'Mobiliário; Planograma; Kit visual sazonal; Termo de comodato',
       kpi: 'Recompra 90 dias pré vs pós instalação',
       contra: 'Mix completo no espaço, exclusividade e volume mínimo anual' },
  7: { n: 'OOH de Proximidade', inv: [2000, 12000],
       mec: 'Outdoor de entrada de cidade, busdoor e painel próximo a escola, cooperado 60/40 e geolocalizado, em janela casada com a coleção.',
       rw: 'No interior, marca que aparece na rua é marca grande. O OOH legitima a marca perante a consumidora e o próprio lojista.',
       kit: 'Arte por praça; Compra de mídia homologada; Plano de janela',
       kpi: 'Sell-out da loja parceira na janela',
       contra: '40% do investimento de mídia e exposição interna reforçada' },
  8: { n: 'Campanha Promocional', inv: [3000, 30000],
       mec: 'Janela de 30 a 45 dias casada com pico sazonal, nos formatos Guarda-Roupa KIKI ou Compre e Ganhe Livro de Colorir.',
       rw: 'Premiação acelera a decisão e eleva o ticket mantendo preço cheio, além de capturar cadastro da consumidora final.',
       kit: 'Regulamento e registro; Cartaz e display; Urna ou QR; Artes digitais; Roteiro para vendedoras',
       kpi: 'Incremento de sell-out na janela vs período anterior',
       contra: 'Registro das compras no caixa e divulgação para a base' }
};

const A8 = {
  guarda: { n: 'Guarda-Roupa KIKI · Compre e Concorra', prog: 'AÇÃO PROGRAMADA D', inv: [8000, 30000],
    mec: 'A consumidora que mais comprar KIKI na janela ganha R$2.000 em produtos. Cadastro no caixa, ranking semanal e kit completo. Registro SPA obrigatório.',
    rw: 'O prêmio agregador concentra recompra na janela: cada visita vira chance de subir no ranking, e o cadastro constrói a base de consumidoras finais.' },
  livro: { n: 'Compre e Ganhe Livro de Colorir', prog: 'AÇÃO PROGRAMADA B', inv: [3000, 8000],
    mec: 'A cada 2 produtos do Grupo Catarina, 1 livro de colorir exclusivo. Kit com livros, cartazes e display de balcão.',
    rw: 'Brinde certo dispensa registro legal e roda em qualquer loja. A mecânica leve 2 empurra a segunda peça e o livro estende a marca para dentro de casa.' }
};

const TEND = { up: 'Crescendo', flat: 'Estável', down: 'Caindo' };
const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR');

/* ---------- estado ---------- */
let ERP = null;
let FOTOS = [];
let LAST = null;

/* ---------- onReady ---------- */
$w.onReady(async () => {
  // representante = membro logado (campo travado)
  const member = await currentMember.getMember();
  if (member) {
    $w('#inpRep').value = member.contactDetails?.firstName
      ? `${member.contactDetails.firstName} ${member.contactDetails.lastName || ''}`.trim()
      : member.loginEmail;
    $w('#inpRep').readOnly = true;
  }

  // repeater da análise da ação
  $w('#repDores').data = DORES.map(d => ({
    _id: d.id,
    texto: `${d.t}`,
    gatilho: `${d.id} · dispara Ação ${d.a.map(x => String(x).padStart(2, '0')).join(' + ')}`
  }));
  $w('#repDores').onItemReady(($item, itemData) => {
    $item('#txtDor').text = itemData.texto + '\n' + itemData.gatilho;
    $item('#rateDor').value = 1;
  });

  $w('#btnBuscar').onClick(buscarERP);
  $w('#inpCodcli').onBlur(() => { if ($w('#inpCodcli').value.trim()) buscarERP(); });
  $w('#upFotos').onChange(uploadFotos);
  $w('#btnGerar').onClick(gerar);
  $w('#btnEnviar').onClick(enviar);
  $w('#btnCopiar').onClick(() => wixWindow.copyToClipboard($w('#txtResumo').value));
});

/* ---------- histórico ERP pelo código do cliente ---------- */
async function buscarERP() {
  const cod = $w('#inpCodcli').value.trim();
  if (!cod) return warn('Informe o código da loja para buscar o histórico.');
  const d = await getHistoricoCliente(cod);
  if (!d.encontrado) return warn('Código não encontrado na base de clientes. Confirme com o comercial.');
  ERP = { cod, ...d };
  if (d.fantasia && !$w('#inpFantasia').value) $w('#inpFantasia').value = d.fantasia;
  $w('#txtFat').text = fmt(d.fat24m);
  $w('#txtCol').text = d.ultimasColecoes;
  $w('#txtCurva').text = 'Curva ' + d.curva;
  $w('#txtTend').text = TEND[d.tendencia];
  $w('#boxErp').expand();
  hideWarn();
}

/* ---------- fotos do PDV ---------- */
async function uploadFotos() {
  if ($w('#upFotos').value.length === 0) return;
  const uploads = await $w('#upFotos').uploadFiles();
  FOTOS = FOTOS.concat(uploads.map(u => u.fileUrl));
  $w('#galFotos').items = FOTOS.map(src => ({ src }));
}

/* ---------- motor de recomendação ---------- */
function gerar() {
  const codcli = $w('#inpCodcli').value.trim();
  const motivo = $w('#inpMotivo').value.trim();
  if (!codcli) return warn('Preencha o código da loja.');
  if (!ERP || ERP.cod !== codcli) return warn('Busque o histórico do cliente antes de gerar.');
  if (FOTOS.length < 2) return warn('Suba pelo menos 2 fotos do PDV (fachada + exposição das marcas).');
  if (!motivo) return warn('Descreva o motivo da ação.');
  hideWarn();

  const tip = $w('#selTipologia').value;           // P1..P4
  const contra = $w('#selContra').value;           // alta/media/baixa
  const janela = $w('#inpJanela').value.trim();
  const curva = ERP.curva, tend = ERP.tendencia;

  // notas do repeater
  const notas = {};
  $w('#repDores').forEachItem(($item, itemData) => {
    notas[itemData._id] = $item('#rateDor').value || 1;
  });
  const prioritarias = DORES.filter(d => notas[d.id] >= 4)
    .sort((a, b) => notas[b.id] - notas[a.id]);

  // score
  const score = {};
  prioritarias.forEach(d => d.a.forEach(a => {
    score[a] = (score[a] || 0) + (notas[d.id] - 3) + 1;
  }));

  // filtros de elegibilidade (Seção 6.1 do toolkit)
  const alertas = [];
  const bloq = new Set();
  if (curva === 'C' && tend === 'down') {
    [2, 4, 6, 7, 8].forEach(a => bloq.add(a));
    alertas.push('Histórico ERP: cliente curva C em queda. Ações de alto investimento bloqueadas; kit limitado a Incentivo, Redes básico e Trade leve. Pauta comercial recomendada.');
  }
  if (curva === 'A' && tend === 'up') { score[6] = (score[6] || 0) + 2; score[2] = (score[2] || 0) + 2; }
  if (contra === 'baixa') {
    if (score[2]) score[2] -= 2; if (score[7]) score[7] -= 2;
    if (score[3]) score[3] += 1; if (score[5]) score[5] += 1;
    alertas.push('Contrapartida baixa: motor rebaixou ações dependentes do lojista e priorizou autoportantes.');
  }
  if (tip === 'P3') alertas.push('Loja de shopping: OOH vira mall media + digital geolocalizado; anuência da administração adiciona 5 dias úteis ao fluxo.');
  if (curva === 'C') bloq.add(6);

  let ranked = Object.entries(score)
    .filter(([a, s]) => s > 0 && !bloq.has(+a))
    .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([a]) => +a);
  if (ranked.length === 0) {
    ranked = [5, 3];
    alertas.push('Nenhuma dor crítica sinalizada: kit de manutenção sugerido (Trade leve + Redes básico).');
  }

  let a8v = null;
  if (ranked.includes(8)) a8v = (notas.C9 >= 4 || curva === 'C') ? A8.livro : A8.guarda;

  // montar kit
  let invMin = 0, invMax = 0;
  const kit = ranked.map((a, i) => {
    let d = { ...ACOES[a] };
    if (a === 8 && a8v) d = { ...d, ...a8v };
    if (a === 7 && tip === 'P3') d = { ...d, n: 'Mall Media + Digital Geolocalizado (substitui OOH)' };
    invMin += d.inv[0]; invMax += d.inv[1];
    return {
      _id: 'a' + a, rank: (i + 1) + 'ª AÇÃO · ' + String(a).padStart(2, '0'),
      nome: d.n, prog: d.prog || '', mec: d.mec, rw: 'Reason why: ' + d.rw,
      materiais: d.kit, invTxt: fmt(d.inv[0]) + ' a ' + fmt(d.inv[1]),
      foot: 'KPI: ' + d.kpi + ' · CONTRAPARTIDA: ' + d.contra, contra: d.contra
    };
  });

  const meta = 10 + ranked.length * 3 +
    (curva === 'B' && tend === 'up' ? 4 : 0) + (contra === 'alta' ? 3 : 0);
  const alcada = invMax <= 1500 ? 'Gestor regional + Trade'
    : (invMax <= 5000 ? 'Gerência comercial + Head Produto & Marketing'
    : 'Comitê mensal (Comercial + Marketing + Diretoria)');

  // render da prescrição
  $w('#txtRxNum').text = 'PRESCRIÇÃO Nº ' + codcli + '-provisório';
  $w('#txtRxCliente').text = codcli + ($w('#inpFantasia').value ? ' · ' + $w('#inpFantasia').value : '');
  $w('#txtRxPerfil').text = `${tip} · Curva ${curva} · ${TEND[tend]}`;
  $w('#txtRxFat').text = fmt(ERP.fat24m);
  $w('#txtRxDores').text = prioritarias.length
    ? 'Dores prioritárias: ' + prioritarias.map(d => `${d.id} (${notas[d.id]})`).join(' · ')
    : 'Nenhuma dor crítica sinalizada na análise.';
  $w('#txtRxMotivo').text = 'Motivo: "' + motivo + '"' + (janela ? ' · Janela local: ' + janela : '');
  $w('#repAcoes').data = kit;
  $w('#repAcoes').onItemReady(($item, it) => {
    $item('#txtRank').text = it.rank + (it.prog ? '  ' + it.prog : '');
    $item('#txtNome').text = it.nome;
    $item('#txtMec').text = it.mec;
    $item('#txtRw').text = it.rw;
    $item('#txtMat').text = 'Kit de materiais: ' + it.materiais;
    $item('#txtInv').text = it.invTxt;
    $item('#txtFoot').text = it.foot;
  });
  $w('#txtTotInv').text = fmt(invMin) + ' a ' + fmt(invMax);
  $w('#txtTotMeta').text = '+' + meta + '%';
  $w('#txtTotN').text = ranked.length + ' de 3';
  if (alertas.length) { $w('#boxAlerta').expand(); $w('#txtAlerta').text = alertas.join('\n'); }
  else $w('#boxAlerta').collapse();

  LAST = { codcli, fantasia: $w('#inpFantasia').value, tip, curva, tend,
           fat: ERP.fat24m, motivo, janela, contra, notas, kit, invMin, invMax,
           meta, alcada, alertas, fotos: FOTOS };
  $w('#boxProtocolo').collapse();
  $w('#boxRx').expand();
  $w('#boxRx').scrollTo();
}

/* ---------- envio: grava no CMS e abre a tela de protocolo ---------- */
async function enviar() {
  if (!LAST) return;
  $w('#btnEnviar').disable();
  const { protocolo } = await enviarPrescricao({
    codcli: LAST.codcli,
    representante: $w('#inpRep').value,
    tipologia: LAST.tip,
    motivo: LAST.motivo,
    notas: LAST.notas,
    contrapartida: LAST.contra,
    janela: LAST.janela,
    fotos: LAST.fotos,
    kit: LAST.kit,
    invMin: LAST.invMin, invMax: LAST.invMax,
    meta: LAST.meta, alcada: LAST.alcada, alertas: LAST.alertas
  });

  const hoje = new Date().toLocaleDateString('pt-BR');
  const etapas = [
    { _id: 'e1', t: 'Análise da ação e prescrição', s: 'Formulário enviado com ' + LAST.fotos.length + ' foto(s) de baseline', sla: hoje, st: 'CONCLUÍDO' },
    { _id: 'e2', t: 'Aprovação comercial', s: 'Alçada: ' + LAST.alcada, sla: 'SLA 3 dias úteis', st: 'EM ANDAMENTO' },
    { _id: 'e3', t: 'Aprovação marketing', s: 'Verba, marca e conformidade legal', sla: 'SLA 3 dias úteis', st: '' }
  ];
  if (LAST.tip === 'P3') etapas.push({ _id: 'e3b', t: 'Anuência do shopping', s: 'Aprovação do empreendimento', sla: '+5 dias úteis', st: '' });
  etapas.push(
    { _id: 'e4', t: 'Termo de contrapartida do lojista', s: 'Sem termo, o kit não é enviado', sla: '5 dias úteis', st: '' },
    { _id: 'e5', t: 'Produção e envio do kit', s: 'Materiais físicos e digitais', sla: '7 dias úteis', st: '' },
    { _id: 'e6', t: 'Ativação na loja com evidência', s: 'Foto ou vídeo obrigatório', sla: 'data acordada', st: '' },
    { _id: 'e7', t: 'Mensuração 30 / 60 / 90', s: 'Recompra vs baseline recalibra o motor', sla: 'automático', st: '' }
  );
  $w('#repTimeline').data = etapas;
  $w('#repTimeline').onItemReady(($item, e) => {
    $item('#txtEtapa').text = e.t + (e.st ? '  [' + e.st + ']' : '');
    $item('#txtEtapaSub').text = e.s;
    $item('#txtEtapaSla').text = e.sla;
  });

  const linhas = LAST.kit.map((k, i) => (i + 1) + '. ' + k.nome + ' (' + k.invTxt + ')').join('\n');
  $w('#txtResumo').value =
    'ASSUNTO: Aprovação de kit de ativação, cliente ' + LAST.codcli + (LAST.fantasia ? ' ' + LAST.fantasia : '') + '\n\n' +
    'Prescrição ' + protocolo + ' registrada em ' + hoje + ' por ' + $w('#inpRep').value + '.\n\n' +
    'CLIENTE: ' + LAST.codcli + ', tipologia ' + LAST.tip + ', curva ' + LAST.curva +
    ', tendência ' + TEND[LAST.tend].toLowerCase() + ', faturamento 24 meses de ' + fmt(LAST.fat) + ' (ERP).\n\n' +
    'MOTIVO DA AÇÃO: ' + LAST.motivo + '\n\n' +
    'KIT RECOMENDADO:\n' + linhas + '\n\n' +
    'INVESTIMENTO TOTAL: ' + fmt(LAST.invMin) + ' a ' + fmt(LAST.invMax) + '\n' +
    'META SUGERIDA 60 DIAS: +' + LAST.meta + '%\n' +
    'ALÇADA: ' + LAST.alcada + '. Solicito retorno em até 3 dias úteis para manter o ciclo de 20 dias até a ativação.';

  $w('#txtProx').text =
    'O que você faz agora: 1. Encaminhe o resumo ao gestor comercial. ' +
    '2. Alinhe as contrapartidas com o lojista para o termo sair sem atraso. ' +
    '3. Reserve a data de ativação' + (LAST.janela ? ' aproveitando a janela local (' + LAST.janela + ')' : '') + '. ' +
    '4. Após a ativação, suba as fotos do depois neste protocolo: sem evidência, o cliente não recebe a próxima ação.';

  $w('#txtRxNum').text = 'PRESCRIÇÃO Nº ' + protocolo;
  $w('#boxProtocolo').expand();
  $w('#boxProtocolo').scrollTo();
  $w('#btnEnviar').enable();
}

/* ---------- util ---------- */
function warn(msg) { $w('#txtWarn').text = msg; $w('#txtWarn').expand(); }
function hideWarn() { $w('#txtWarn').collapse(); }
```

---

# 6. FLUXO DE APROVAÇÃO E NOTIFICAÇÕES

1. **Automação Wix:** gatilho "item criado na coleção Aprovacoes" dispara e-mail/notificação ao GestorComercial da regional (campo `codrep` liga cliente a regional).
2. **Página /aprovacoes:** repeater filtrado por `status = em_aprovacao_comercial` (badge GestorComercial) ou `em_aprovacao_marketing` (badge Marketing), com botões Aprovar / Reprovar / Ajustar que atualizam `Acoes.status` e inserem a decisão em `Aprovacoes` via backend (justificativa obrigatória em reprovação, regra de ouro nº 4 do toolkit).
3. **Página /minhas-prescricoes:** o representante acompanha a mesma timeline lendo `Acoes.status`, agora alimentada por decisões reais em vez de simulação.
4. Upload das fotos do "depois" no protocolo: mesmo `#uploadButton`, gravando na linha do diagnóstico.

# 7. ORDEM DE IMPLANTAÇÃO NO WIX

1. Ativar Members Area e criar os 4 badges
2. Criar as 4 coleções com os field keys da Seção 2 e importar a base Clientes (CSV do ERP)
3. Montar a página /analise-da-acao com os IDs da Seção 3
4. Colar o backend (Seção 4) e o código da página (Seção 5)
5. Configurar a Automação de notificação e as páginas de fila e acompanhamento
6. Testar com 3 clientes reais de curvas diferentes antes de liberar ao piloto (2 regionais, conforme roadmap do toolkit)

Nota: a rotina de recálculo de curva e tendência continua fora do Wix (extração ERP conforme metodologia da Seção 5.3 do toolkit); o Wix consome o resultado via importação periódica ou API externa (wix-fetch em job agendado).

---

# 8. ADENDO | CARGA DO BANCO REAL E HISTÓRICO ABERTO POR COLEÇÃO E MARCA

A base real já foi processada a partir do CADASTRO_DE_CLIENTES.xlsx e está pronta em dois arquivos de importação:

| Arquivo | Coleção Wix de destino | Conteúdo |
|---|---|---|
| `wix_Clientes.csv` | `Clientes` | 2.374 clientes com faturamento nos últimos 2 anos: codcli, fantasia, cidade, uf, fat24m, curva (tercil real: A a partir de R$147.707, B a partir de R$18.259), tendencia (I26+T26+V27 vs I25+T25+V26) e ultimasColecoes |
| `wix_HistoricoColecoes.csv` | `HistoricoColecoes` (nova) | 8.313 linhas: uma por cliente + marca + coleção, com colecaoId (I25, T25, V26, I26, T26, V27), rótulo, ordem cronológica e valor em R$ |

## 8.1 Nova coleção `HistoricoColecoes`
| Field key | Tipo |
|---|---|
| `codcli` | Text (indexar) |
| `marca` | Text (KIKI, MENINA ANJO, VALENT) |
| `colecaoId` | Text |
| `colecao` | Text |
| `ordem` | Number |
| `valor` | Number (R$) |

Permissões: leitura Membros do site, escrita Admin. Importar via CMS, "Importar itens", CSV com cabeçalho batendo com as field keys.

## 8.2 Backend: buscar histórico aberto

Adicionar ao `backend/sellout.jsw`:

```javascript
export async function getHistoricoAberto(codcli) {
  const res = await wixData.query('HistoricoColecoes')
    .eq('codcli', String(codcli).trim())
    .ascending('ordem')
    .limit(100)
    .find({ suppressAuth: true });
  return res.items; // [{marca, colecaoId, colecao, ordem, valor}]
}
```

## 8.3 Frontend: montar a tabela do histórico

Elementos novos na página: `#txtCidade` (Text) e `#repHist` (Repeater com `#txtHistCol`, `#txtHistKiki`, `#txtHistMa`, `#txtHistVal`, `#txtHistTot`). No `buscarERP()` da página, após preencher curva e tendência:

```javascript
import { getHistoricoAberto } from 'backend/sellout.jsw';

const itens = await getHistoricoAberto(cod);
const cols = {};
itens.forEach(i => {
  cols[i.colecaoId] = cols[i.colecaoId] || { colecao: i.colecao, ordem: i.ordem, KIKI: 0, 'MENINA ANJO': 0, VALENT: 0 };
  cols[i.colecaoId][i.marca] += i.valor;
});
const linhas = Object.entries(cols)
  .sort((a, b) => a[1].ordem - b[1].ordem)
  .map(([id, c]) => ({
    _id: id, colecao: c.colecao,
    kiki: c.KIKI ? fmt(c.KIKI) : '-',
    ma: c['MENINA ANJO'] ? fmt(c['MENINA ANJO']) : '-',
    val: c.VALENT ? fmt(c.VALENT) : '-',
    tot: fmt(c.KIKI + c['MENINA ANJO'] + c.VALENT)
  }));
$w('#repHist').data = linhas;
$w('#repHist').onItemReady(($item, l) => {
  $item('#txtHistCol').text = l.colecao;
  $item('#txtHistKiki').text = l.kiki;
  $item('#txtHistMa').text = l.ma;
  $item('#txtHistVal').text = l.val;
  $item('#txtHistTot').text = l.tot;
});
```

## 8.4 Validação da carga (fazer antes de liberar)
1. Conferir 3 clientes contra o ERP: 144 (curva A, três marcas), 433 (curva B caindo), 2 (curva C caindo)
2. Confirmar a premissa de conversão: os valores da planilha original estavam em centavos e foram divididos por 100
3. Rodar o formulário completo com um cliente de cada curva e verificar bloqueios do motor

