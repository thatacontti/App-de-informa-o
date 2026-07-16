# Configuração de e-mail · grupocatarina.com (SkyMail / emailemnuvem)

Base: respostas do TI (Anderson Faria dos Santos, 15/07/2026). Este documento
transforma o questionário em valores prontos para colar. Cobre o que a
**plataforma do representante** precisa (SMTP de notificação) e a infra de
e-mail compartilhada (SPF/DKIM/DMARC/IMAP) usada também pela campanha
(CatarinaMail / Apps Script / n8n — fora deste repositório).

> ⚠️ Antes de aplicar, resolver os **4 pontos críticos** da última seção.

---

## 1. SMTP — envio (plataforma + campanha)

| Campo | Valor |
|---|---|
| Host | `sender.skymail.net.br` |
| Porta | `587` (STARTTLS) · alternativa `465` (SSL/TLS) |
| Auth | LOGIN (usuário + senha) |
| Usuário | `contato@grupocatarina.com` (secundário: `marketing@grupocatarina.com`) |
| Remetente (From) | mesma conta autenticada, p/ alinhar SPF/DKIM |

Na plataforma, preencher no `.env` do VPS (`apps/representantes/.env`):

```env
SMTP_HOST=sender.skymail.net.br
SMTP_PORT=587
SMTP_USER=contato@grupocatarina.com
SMTP_PASS=<senha da conta contato@>
SMTP_FROM=contato@grupocatarina.com
```

O `server/lib/mailer.js` já trata 587 (STARTTLS) e 465 (SSL) automaticamente.

---

## 2. IMAP — leitura de respostas (real-time)

| Campo | Valor |
|---|---|
| Host | `imap.emailemnuvem.com.br` |
| Porta | **`993` (SSL/TLS) — usar esta** |
| Auth | LOGIN |
| Usuário | `contato@grupocatarina.com` |
| IDLE | ✅ habilitado (push em tempo real) |
| Conexões simultâneas | 5 por conta |

> **Correção:** a resposta Q3 ("STARTTLS = 587") está errada — 587 é porta de
> SMTP. IMAP STARTTLS seria 143. Como o SSL direto (993) funciona e o IDLE
> está ligado, use **993** e ignore o STARTTLS.

**Recomendação de arquitetura:** como IMAP + IDLE estão disponíveis, ler as
respostas direto do IMAP de `contato@` **dispensa o forward para o Gmail**
(Bloco 6). É o caminho mais elegante e preserva 100% dos headers
(`In-Reply-To`, `References`, `Message-ID`) para casar as respostas com o
envio original. O forward Gmail fica só como plano B.

---

## 3. DNS (GoDaddy · grupocatarina.com) — registros para colar

TI tem acesso direto ao painel GoDaddy (Q24), SLA de mudança ~1h (Q25).

### 3.1 SPF (um único registro TXT no host `@`)

```
Tipo: TXT
Host: @
Valor: v=spf1 include:spf.emailemnuvem.com.br -all
```

> Só pode existir **um** registro SPF. Se já houver outro `v=spf1...`, mesclar
> os `include:` num só. `-all` (hard fail) é seguro **se todo envio sair pela
> SkyMail**. Durante o rollout inicial, considere `~all` (softfail) para não
> rejeitar e-mail legítimo enquanto valida, e volte a `-all` depois.

### 3.2 DKIM (TXT)

```
Tipo: TXT
Host: selector._domainkey        (→ selector._domainkey.grupocatarina.com)
Valor: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFESahhNEQ1bUIUfR/y3ZVnbPwUcVKcu8mbyVRzcc79QQzJNja7l8PFhLHf2jhaE7LO5U+fqw0wAwB2ikYeLj4TaHTaL48L7hL2TlTTK9ulvHWLAYQWsmkvVIm+xrWBxdFexVdQ7u0HI0TmrTd2YoVYuRIh33vHto1NcSaod9uKwIDAQAB
```

> **CONFIRMAR o selector** (ver ponto crítico #1). "selector" costuma ser um
> *placeholder* — o valor real do SkyMail costuma ser algo como `skymail`,
> `default` ou `key1`. O host precisa bater exatamente com o selector que a
> SkyMail assina, senão o DKIM falha.

### 3.3 DMARC (TXT) — subir em fases

Fase 1 (monitorar, 1–2 semanas) — **recomendado começar assim**:

```
Tipo: TXT
Host: _dmarc
Valor: v=DMARC1; p=none; rua=mailto:suporte@brsolucoes.inf.br; fo=1; pct=100
```

Fase 2 (após confirmar SPF+DKIM alinhados nos relatórios): trocar `p=none`
por `p=quarantine` (valor que o TI já quer usar), depois `p=reject`.

> Ir direto a `p=quarantine` (resposta Q13) antes de validar o alinhamento
> arrisca mandar e-mail legítimo para spam. Suba `p=none` primeiro.
> **Atenção `rua` externo:** como o destino dos relatórios
> (`brsolucoes.inf.br`) é outro domínio, ele precisa autorizar publicando:
> `grupocatarina.com._report._dmarc.brsolucoes.inf.br  TXT  "v=DMARC1"`.
> Sem isso, os relatórios agregados não chegam.

---

## 4. Limites de envio e throttle da campanha

| Limite (SkyMail) | Valor |
|---|---|
| Por hora | 500 |
| Por dia | 3.000 |
| Destinatários por e-mail | 100 |
| Ao estourar | alerta e continua (não bloqueia) |

Campanha: **820 e-mails na terça 9h, janela ~2h** = ~410/h em média → dentro
do limite diário e horário. Para não encostar no teto de 500/h em nenhuma
janela deslizante e proteger reputação:

- **`wait_between_sends = 8s`** (com jitter ±1s) → ~450/h → 820 e-mails em
  **~1h49m**. Cabe na janela e fica sob o limite.
- Se priorizar entregabilidade sobre velocidade: 9–10s (≈360–400/h).
- Nunca abaixo de ~7,2s (=500/h) — aí encosta no limite.

---

## 5. Pontos críticos a resolver com o TI (antes de aplicar)

1. **DKIM selector (Q10):** confirmar o selector real. "selector" parece
   placeholder — pedir o nome exato que a SkyMail usa (ex.: `skymail`).
2. **DKIM gerado x publicado (Q9 vs Q12):** Q9 diz "precisa solicitar
   geração", Q12 diz "já publicado e funcionando no mxtoolbox". Contradição —
   confirmar se a chave acima já está no ar. Validar em
   `mxtoolbox.com/dkim.aspx` com o selector correto.
3. **IMAP STARTTLS (Q3):** resposta 587 está errada; usar **993/SSL** (IDLE ok).
4. **DMARC (Q13):** subir `p=none` primeiro (não `quarantine`) e autorizar o
   `rua` externo em `brsolucoes.inf.br` (registro `_report._dmarc`).

## 6. Validação end-to-end (depois de publicar o DNS)

- [ ] `dig TXT grupocatarina.com` mostra 1 SPF válido
- [ ] `dig TXT selector._domainkey.grupocatarina.com` retorna a chave DKIM
- [ ] `dig TXT _dmarc.grupocatarina.com` retorna o DMARC
- [ ] Enviar teste para `check-auth@verifier.port25.com` (ou mail-tester.com)
      → SPF **pass**, DKIM **pass**, DMARC **pass**, nota ≥ 9/10
- [ ] Plataforma: preencher `SMTP_*` no `.env` do VPS e disparar uma
      prescrição de teste → e-mail chega para gestor + `thatiane.marques@`
- [ ] IMAP: conectar em `imap.emailemnuvem.com.br:993` com IDLE e confirmar
      leitura de uma resposta de teste com headers preservados
