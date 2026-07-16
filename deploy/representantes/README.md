# Deploy · representantes.grupocatarina.com (Hostinger VPS)

Artefatos para colocar a **Plataforma do Representante** no ar. O domínio
`representantes.grupocatarina.com` **ainda não foi liberado** — por isso o
objetivo aqui é deixar **todas as pontas prontas** no VPS: o app sobe, é
navegável pelo IP, a integração Excia e os formulários funcionam, e o único
passo que falta (DNS + certificado HTTPS) fica documentado e a um comando de
distância assim que o subdomínio existir.

## Conteúdo

| Arquivo | Função |
|---|---|
| `docker-compose.yml` | Sobe o app (`representantes`, porta interna 8080) + `nginx` (80/443) |
| `nginx-representantes.conf` | Server block do subdomínio (HTTP agora; HTTPS pronto p/ habilitar) |
| `deploy.sh` | `build + up + healthcheck` |
| `manuais/` | PDFs de políticas/manuais (montados em `/manuais` no app) — coloque os arquivos aqui |
| `certbot-www/` | Webroot do desafio ACME (criado pelo deploy.sh) |

## 1. Subir agora (antes do domínio)

Pré-requisitos no VPS: Ubuntu 22.04+, Docker + Docker Compose.

```bash
git clone <repo> && cd <repo>/deploy/representantes
# ajuste os segredos do app:
cp ../../apps/representantes/.env.example ../../apps/representantes/.env
nano ../../apps/representantes/.env      # JWT_SECRET, EXCIA_*, SMTP_*
./deploy.sh
```

O app já responde em **HTTP** na porta 80. Como o DNS ainda não aponta,
teste pelo IP do VPS: `http://SEU_IP/` (a plataforma) e `http://SEU_IP/healthz`.

> O banco SQLite e as fotos ficam em volumes Docker (`gcrep-db`, `gcrep-uploads`),
> então sobrevivem a `up`/`down`/`rebuild`. O seed roda sozinho no primeiro boot.

## 2. Quando o subdomínio for liberado (go-live HTTPS)

> **Ordem:** o HTTPS **não** é pré-requisito do domínio. Primeiro aponta-se o
> DNS; o certificado só pode ser emitido **depois** que o domínio resolve para
> o VPS (o Let's Encrypt valida acessando o domínio). Então:

1. **DNS:** criar registro `A` de `representantes` → IP do VPS (TTL 3600).
   Confirmar propagação: `dig +short representantes.grupocatarina.com`.
2. **Ativar HTTPS — um comando** (emite o certificado e ativa o HTTPS sozinho):
   ```bash
   cd deploy/representantes && ./enable-https.sh ti@grupocatarina.com
   ```
   O script confere o DNS, sobe o app em HTTP, emite o certificado via webroot
   (certbot em container), troca o nginx para a config HTTPS
   (`nginx-https.conf`) e reinicia. Ao final imprime a linha de cron da
   **renovação automática** para colar no `crontab -e` do host.

Variantes de nginx no diretório: `nginx-representantes.conf` (ativa, começa em
HTTP) e `nginx-https.conf` (aplicada pelo `enable-https.sh`). Nada de edição
manual.

## 3. Integração Excia no VPS

O VPS **não** alcança a LAN do Excia (`192.168.1.6:211`). Portanto:

- Manter `EXCIA_MODE=file` no `.env` do VPS. A plataforma serve o último
  export (`data/colecao_data.json` + banco semeado).
- A carga de vendas/coleção é feita **dentro da rede da empresa**
  (`scripts/excia-agent.mjs` ou, no modo `live`, `node server/lib/excia.js --sync`)
  e o resultado é publicado no VPS. Documentado no README do app.

## 4. Checklist de go-live

- [ ] `.env` do app preenchido (JWT_SECRET forte, COOKIE_SECURE=true, EXCIA_MODE=file)
- [ ] `./deploy.sh` sobe app + nginx; `/healthz` responde `ok`
- [ ] Login testado: Rony (1/1), Bruno (81/81), Diretoria (0/0000)
- [ ] Segregação conferida: representante só vê a própria carteira (403 em cliente de outro)
- [ ] Painel V27 bate com o Excia (total de 1 representante) — registrar o número
- [ ] Formulário abre com `?codcli=` pré-preenchido e grava a prescrição (protocolo real)
- [ ] Fila de aprovações funciona (aprovar avança o status; reprovar exige justificativa)
- [ ] PDFs de manuais colocados em `deploy/representantes/manuais/`
- [ ] DNS apontado + HTTPS ativo (cadeado no navegador)
- [ ] Senha do 1º acesso comunicada; troca obrigatória validada

## Alternativa sem Docker (systemd)

Para 1 vCPU / 1 GB, dá para rodar direto:

```bash
cd apps/representantes && npm ci --omit=dev && cp .env.example .env  # editar
node server/seed.js
# criar unit /etc/systemd/system/gc-representantes.service com:
#   ExecStart=/usr/bin/node /caminho/apps/representantes/server/index.js
#   Environment=PORT=8080 (e demais do .env via EnvironmentFile)
# e um server block Nginx no host apontando para 127.0.0.1:8080.
```
