# Guia passo a passo — publicar na Hostinger (sem ser técnico)

Para a Thatiane fazer manualmente. Ao final você terá o **IP** e o site no ar;
aí é só passar o IP para o Anderson criar o domínio.

> Regra de ouro: **nunca compartilhe senhas em chat.** Só cole o *texto que a
> tela mostra* (mensagens de resultado).

---

## Parte 1 · Ter um VPS na Hostinger

**Se você AINDA NÃO tem VPS:**
1. Entre em **hpanel.hostinger.com**.
2. Menu **VPS** → **Comprar/Adquirir VPS** (ou "Setup").
3. Plano: **KVM 1** já atende (pode subir depois se precisar).
4. Sistema operacional: escolha **Ubuntu 22.04** (ou 24.04) — *sem* painel extra.
5. Localização: **Brasil** (ou a mais próxima).
6. Defina a **senha de root** quando pedir (guarde num gerenciador; não me mande).
7. Finalize. Em ~2 minutos o VPS fica "Ativo".

**Se você JÁ tem VPS:** siga para a Parte 2.

---

## Parte 2 · Pegar o IP do VPS

1. hPanel → **VPS** → clique no seu servidor.
2. Na aba **Visão geral**, copie o número do campo **IPv4** (ex.: `191.96.10.20`).

Guarde esse número — é ele que vai para o Anderson no fim.

---

## Parte 3 · Abrir o terminal (a "tela preta")

1. Ainda na página do VPS, procure **Browser terminal** (ou "Terminal do
   navegador" / "Terminal SSH").
2. Clique — abre uma tela preta onde você digita/cola comandos.
   - Se pedir login: usuário `root` e a senha de root que você definiu.

> Dica: nessa tela, **colar** costuma ser `Ctrl+Shift+V` (ou botão direito).

---

## Parte 4 · Baixar o projeto (colar 1 comando)

Cole esta linha e tecle Enter:

```
cd /opt && git clone -b claude/grupo-catarina-domain-setup-hfu1vy https://github.com/thatacontti/App-de-informa-o.git gc && cd gc
```

- Se aparecer **"Username"**: digite `thatacontti` e Enter.
- Se aparecer **"Password"**: cole um **token do GitHub** (não a senha do site) e Enter.
  - Como gerar o token (1 min): github.com → sua foto → **Settings** →
    **Developer settings** → **Personal access tokens** → **Tokens (classic)** →
    **Generate new token (classic)** → marque a caixa **repo** → **Generate** →
    copie o código (começa com `ghp_...`) e cole no "Password".
  - *(Ou peça esse token ao Anderson — é diferente de mexer no servidor.)*

Deu certo se aparecer algo como `Cloning...` e voltar para a linha de comando.

---

## Parte 5 · Publicar (colar 1 comando)

Cole e Enter:

```
sudo bash deploy/representantes/provision-vps.sh
```

Isso instala tudo, gera as chaves de segurança sozinho e sobe o site.
Leva alguns minutos. No final ele imprime uma caixa com:

```
✅ SITE NO AR (HTTP) ...
   Teste agora no navegador:   http://SEU_IP/
```

---

## Parte 6 · Testar

Abra no navegador **http://SEU_IP/** (o IP da Parte 2).
- Deve aparecer a tela de login da plataforma.
- Entre como **Diretoria**: usuário `0`, senha `0000` (ele pede troca de senha).

Se abriu e logou → **publicação OK.** 🎉

---

## Parte 7 · Passar o IP para o Anderson (o domínio)

Mande ao Anderson:

> Anderson, o site já está no ar na VPS. Pode criar no GoDaddy
> (domínio grupocatarina.com) este registro:
> - Tipo: **A** · Nome/Host: **representantes** · Valor: **‹IP do VPS›** · TTL: 1 hora

---

## Parte 8 · Ativar o cadeado (HTTPS) — depois que o domínio apontar

Quando o Anderson confirmar o domínio, volte ao terminal e cole:

```
cd /opt/gc/deploy/representantes && sudo bash enable-https.sh ti@grupocatarina.com
```

Pronto: `https://representantes.grupocatarina.com` com cadeado.

---

## Se travar em qualquer ponto

Copie o **texto que apareceu na tela** (sem senhas) e me mande aqui — eu te digo
exatamente o próximo passo ou corrijo o erro.
