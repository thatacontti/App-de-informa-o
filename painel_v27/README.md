# Painel Estratégico V27 · Grupo Catarina

Dashboard interativo HTML para análise da coleção Verão 2027 (B2B moda infantil: KIKI, Menina Anjo, Valent).

## Estrutura do Projeto

```
painel_v27/
├── README.md                      ← este arquivo
├── build.py                       ← script que monta os HTMLs finais
│
├── template.html                  ← HTML estrutural do painel (16 KB)
│   └── 4 abas: Negócio · Marca/Cidade · Produto/Estratégia · Mapa de Ataque
│   └── 6 filtros: Marca · Estado · Representante · Tipo · Linha · Faixa
│   └── Divs com IDs para cada seção (kpis, sss-macro, sss-mca, etc.)
│
├── styles.css                     ← CSS completo do painel (25 KB)
│
├── dashboard_diretoria.js         ← lógica JS versão DIRETORIA (44 KB)
│   └── KPIs com faturamento, PM, margem
│   └── SSS em R$ (Same Store Sales financeiro)
│   └── Rank por faturamento
│   └── Todas as análises em valores R$
│
├── dashboard_produto.js           ← lógica JS versão PRODUTO (53 KB)
│   └── KPIs com peças vendidas (sem faturamento)
│   └── SSS em PEÇAS (V26 estimado via PM V27 por marca)
│   └── Rank por volume de peças
│   └── Preços unitários (PM) mantidos
│
├── dados/                         ← arquivos de dados
│   ├── d_v12.json                 ← dataset principal (recs, reps, SSS marca, UF YoY)
│   ├── sku_final.json             ← banco de imagens base64 (320x420 q72)
│   ├── v26_por_marca.json         ← V26 segmentado {cli_id: {marca: faturamento}}
│   ├── cidade_perfil.json         ← classificação IBGE por cidade
│   └── Estilista.xls              ← mapa SKU → nome da estilista
│
└── output/                        ← HTMLs gerados (self-contained)
    ├── painel_v27_diretoria.html  ← ~11 MB
    └── painel_v27_produto.html    ← ~11 MB
```

## Como atualizar com nova base de vendas

1. Processar o novo xlsx com o pipeline de dados (gera d_vXX.json)
2. Editar `build.py`:
   - `DADOS_VENDAS = 'dados/d_vXX.json'`
   - `DATA_ATUALIZACAO = 'DD de abril de 2026'`
3. Rodar: `python3 build.py`

## Seções do Painel (IDs dos divs)

### Aba Negócio (`v-neg`)
| ID | Conteúdo |
|---|---|
| `kpis` | KPIs macro (Fat/Peças, PM, SKUs, Clientes, Pedidos) |
| `marca-share` | Participação por marca (cards visuais) |
| `sss-macro` | SSS banner (V26 → V27 → variação) |
| `sss-perf` | SSS por perfil de cliente (VIP/A/B/C/NOVO) |
| `cli-rk` | Top 20 clientes |
| `uf-yoy` | Rank por estado YoY |

### Aba Marca/Cidade (`v-mca`)
| ID | Conteúdo |
|---|---|
| `sss-mca` | SSS por marca (tabela V26/V27/SSS%) |
| `sss-marca-linha` | SSS por marca × linha/idade |
| `sss-linha` | Cards SSS por linha (BEBE/PP/INFANTIL/TEEN) |
| `cid-perfil-ibge` | Performance por perfil de cidade IBGE |
| `cp-cards` | Cards visuais por perfil de cidade |
| `bx-cross` | Matriz Marca × Perfil |
| `cid-rk` | Top 15 cidades |

### Aba Produto/Estratégia (`v-prd`)
| ID | Conteúdo |
|---|---|
| `strat-summary` | Resumo estratégico |
| `fx-cards` | Faixas de preço (ENTRADA/MÉDIO/PREMIUM) |
| `fx-table` | Tabela detalhada por faixa |
| `faixas-granular` | 14 faixas granulares contínuas |
| `mix-opt` | Otimização de mix por tipo |
| `abc` | Curva ABC |
| `moodboard` | Top 30 SKUs com foto (por peças) |
| `rank-all` | Rank geral de todos os SKUs |
| `rank-b` / `rank-c` | Ranks B e C |
| `coord` | Coordenados |
| `ins-h` / `ins-a` / `ins-b` | Insights automáticos |

### Aba Mapa de Ataque (`v-mapa`)
| ID | Conteúdo |
|---|---|
| `mapa-ataque` | HTML estático com 2 mapas visuais (pré-renderizado) |

## Diferenças Diretoria vs Produto

| Aspecto | Diretoria | Produto |
|---|---|---|
| KPIs | Fat · Peças · PM | Peças · SKUs · Clientes |
| SSS | R$ (V26 → V27 em faturamento) | Peças (V26 est → V27 em volume) |
| Rank | Por faturamento | Por volume de peças |
| Marca share | % R$ | % peças |
| Top clientes | V26/V27 em R$ | Pç V26 est / Pç V27 |
| Faixas | Fat/SKU | Pç/SKU |
| PM unitários | ✅ mantidos | ✅ mantidos |
| Moodboard | ✅ | ✅ |
| Mapa Ataque | ✅ | ✅ |

## Dados Validados (base 28/04)

- 301 clientes · 236 recorrentes · 65 novos
- R$ 4.788.565 faturamento · 60.437 peças · 358 SKUs
- SSS geral: +1,3% (faturamento) / +2,0% estimado (peças)
- SSS por marca: KIKI +0,5% · MA +5,9% · Valent −0,9%
- PM por marca: KIKI R$ 78,35 · MA R$ 86,21 · Valent R$ 75,14
