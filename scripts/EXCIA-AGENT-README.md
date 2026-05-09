# Excia Agent — Setup

Sincroniza pedidos do ERP Excia (intranet `192.168.1.6:211`) pra
entidade Sale do Base44 (`catarina-vibe-flow.base44.app`).

Roda **dentro da rede da empresa** porque a API do Excia só responde
em LAN.

## Requisitos

- Windows 10/11 (ou Linux/Mac)
- Acesso à rede da empresa (consegue pingar `192.168.1.6`)
- Permissão pra instalar Node.js

## Setup (5 minutos, uma vez)

### 1. Instalar Node

Baixa em https://nodejs.org → versão **LTS** (20.x ou 22.x).
Aceita defaults na instalação.

Confirma no Prompt de Comando:
```
node -v
```
Deve responder `v20.x.x` ou superior.

### 2. Baixar o agent

Cria uma pasta no Desktop chamada `ExciaAgent`. Baixa o arquivo:

🔗 https://raw.githubusercontent.com/thatacontti/App-de-informa-o/main/scripts/excia-agent.mjs

Salva como `excia-agent.mjs` dentro de `ExciaAgent`.

### 3. Configurar credenciais

Cria arquivo `.env` ao lado do `excia-agent.mjs` com:

```
EXCIA_BASE=http://192.168.1.6:211
EXCIA_TOKEN=00EE2138AB67015BED838EC09E55C6A9
BASE44_APP_ID=69f3d2ea55300f3afb7e35dc
BASE44_API_KEY=<COLE A API KEY DO BASE44 AQUI>
BASE44_SERVER_URL=https://catarina-vibe-flow.base44.app
```

⚠️ **Trocar a `BASE44_API_KEY`** pela chave real do seu app (a que
vazou no chat foi rotacionada, espero — se não, rotaciona agora).

### 4. Instalar SDK

No Prompt de Comando, dentro da pasta `ExciaAgent`:

```cmd
npm install @base44/sdk
```

(Se der erro de "npm não reconhecido", reinstala o Node escolhendo
"Add to PATH" no instalador.)

## Uso

### Sync de teste (dry run)

```cmd
node excia-agent.mjs --since 01/05/2026 --dry-run
```

Não grava nada — só mostra o que seria sincronizado.

### Sync real

```cmd
node excia-agent.mjs --since 01/01/2026
```

Sincroniza todos os pedidos com `dt_altera >= 01/01/2026`.

### Sync incremental (default = ontem)

```cmd
node excia-agent.mjs
```

Sem flags = pega só do dia anterior. Bom pra rodar diário.

## Agendar diário no Windows

1. Abre **Task Scheduler** (Agendador de Tarefas)
2. **Create Basic Task**
3. Nome: `Excia Sync`
4. Trigger: Daily, 02:00 AM
5. Action: Start a program
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `excia-agent.mjs`
   - Start in: `C:\Users\<seu-user>\Desktop\ExciaAgent`
6. Finish

Pronto. Roda todo dia 02:00.

## Troubleshooting

**"Excia 401" ou "Forbidden"** → token errado ou expirado, atualizar
`.env`.

**"ECONNREFUSED 192.168.1.6"** → máquina não está na rede da empresa.
Conecta na VPN ou roda em máquina dentro do escritório.

**"Base44 401"** → `BASE44_API_KEY` errada ou rotacionada.

**Sale entity não atualiza** → confere via Postman se `/PedidoLista`
retorna pedidos pro intervalo. Se não retorna, é problema do Excia.

## Verificar resultado

Após rodar, abre `https://catarina-vibe-flow.base44.app/admin/excia-sync`
ou olha direto a entidade `Sale` filtrando por `source = 'EXCIA_API_LIVE'`.
