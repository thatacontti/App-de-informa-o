# Uploads pro Base44 HistoricalUploader

Arquivos CSV pré-processados, prontos pra subir no `/admin/upload` do
app `catarina-vibe-flow.base44.app`.

## Origem

Gerados a partir dos `Pasta1_v0X.csv` da raiz do repo (export bruto do
ERP Excia, Latin-1, semicolon-delim, 21 colunas) via:

```bash
node scripts/transform-pasta1-to-base44.mjs Pasta1_v0X.csv data/base44-uploads/vXX.csv
```

## Diferenças vs Pasta1 original

| | Pasta1 (input) | Base44 upload (output) |
|---|---|---|
| Encoding | Latin-1 | UTF-8 |
| Delimitador | `;` | `,` |
| Colunas | 21 (com extras GRUPO_CLI, DESCRICAO2, DESC_ETIQUETA, etc) | 17 (subset esperado pelo HistoricalUploader) |
| `DESC_GRUPO` | ausente (só `DESC_GRUPO_CLI`, que é grupo de cliente) | mapeado de `DESC_PROD` (ex: "BLUSA INF. FEM.") |

## Notas

- **TROPICAL** coleções não importam: o regex do uploader Base44 só
  reconhece `VER[ÃA]O\s+20\d\d` e `INVERNO\s+20\d\d`. Registros
  TROPICAL ficam ignorados (sem erro, mas perda silenciosa). Pra
  importar TROPICAL é preciso estender o regex no
  `HistoricalUploader.jsx`.
- Limite de 100MB por upload — todos os arquivos aqui ficam abaixo.
- Não tem deduplicação no uploader: re-upload duplica. Use
  `/admin/historical-rebase` pra deletar batches antes de re-upar.
