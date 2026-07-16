# ARQUITETURA E IMPLANTAÇÃO VPS
## representantes.grupocatarina.com | Plataforma do Representante
### Guia técnico de hospedagem, atualização via Excel e evolução | Versão 1.0

---

# 1. O QUE COMPÕE A PLATAFORMA

| Arquivo | Função |
|---|---|
| `plataforma_representantes.html` | A plataforma: login por representante, Painel V27 (2026 vs 2027), Minha Carteira com histórico aberto por coleção e marca, Ações de Marketing, Manuais e Comunicados |
| `formulario.html` | Formulário Análise da Ação + Kit de Ativação, integrado (abre com o cliente pré-preenchido via ?codcli=) |
| Dados embutidos | 2.374 clientes (faturamento por coleção e marca, últimos 2 anos) e 32 representantes do roster V27, carteiras atribuídas por UF de atuação |

Acesso no protótipo: o representante seleciona o nome e digita o próprio Cód RC como código de acesso (ex: Rony = 1, Bruno = 81). Diretoria: opção "Diretoria / Carteira Casa" com código 0000, visão total. Na fase 2, isso vira autenticação real (Seção 5).

---

# 2. IMPLANTAÇÃO NO VPS (FASE 1, ESTÁTICA: no ar em 1 dia)

Requisitos: VPS Ubuntu 22.04+ (1 vCPU / 1GB já atende), acesso root/SSH, e o DNS do domínio grupocatarina.com sob seu controle.

## 2.1 DNS
No painel do domínio, criar o registro: `representantes` do tipo A apontando para o IP do VPS (TTL 3600).

## 2.2 Servidor web + HTTPS

```bash
# no VPS
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/representantes/manuais

# enviar os arquivos (da sua máquina)
scp plataforma_representantes.html usuario@IP:/var/www/representantes/index.html
scp formulario.html usuario@IP:/var/www/representantes/formulario.html
# PDFs de manuais e políticas vão em /var/www/representantes/manuais/
```

Configuração do Nginx em `/etc/nginx/sites-available/representantes`:

```nginx
server {
  server_name representantes.grupocatarina.com;
  root /var/www/representantes;
  index index.html;

  # proteção básica da fase estática (senha de portal, além do login da tela)
  auth_basic "Grupo Catarina - Area Restrita";
  auth_basic_user_file /etc/nginx/.htpasswd;

  location / { try_files $uri $uri/ =404; }
  location /manuais/ { }

  gzip on;
  gzip_types text/html text/css application/javascript application/json;
}
```

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd representantes   # senha única do portal
sudo ln -s /etc/nginx/sites-available/representantes /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d representantes.grupocatarina.com   # HTTPS automático
```

Importante sobre segurança da fase 1: com o HTML estático, os dados de todas as carteiras viajam no arquivo e o login da tela é apenas organizacional. O `auth_basic` (senha única do portal) mitiga o acesso externo, mas um representante tecnicamente conseguiria ver dados de outro. Aceitável para o piloto interno; a Fase 2 resolve de verdade.

## 2.3 Manuais e políticas
Colocar os PDFs em `/var/www/representantes/manuais/` com nomes fixos (ex: `politica-comercial-2026.pdf`) e trocar os botões "Abrir PDF" da plataforma pelos links reais (posso gerar essa versão quando os arquivos existirem).

---

# 3. ATUALIZAÇÃO DE VENDAS VIA EXCEL (rotina operacional)

O dado da plataforma nasce das mesmas planilhas que você já mantém. Rotina por coleção (ou semanal durante a campanha):

1. Exportar do ERP/Excia a planilha no formato do CADASTRO_DE_CLIENTES.xlsx (clientes x coleções por marca, valores em centavos)
2. Rodar o script de carga `atualiza_plataforma.py` (abaixo), que reprocessa: faturamento por coleção e marca, fat24m, curva por tercil, tendência, e o vínculo cliente-representante
3. O script gera o novo `index.html` e `formulario.html` com os dados embutidos; enviar por `scp` e pronto: a plataforma inteira está atualizada

```python
# atualiza_plataforma.py (esqueleto; a lógica completa é a mesma usada nesta construção)
# entrada: CADASTRO_DE_CLIENTES.xlsx + Representantes.xlsx
# saída:   index.html e formulario.html com o bloco const DATA=... substituído
# passos:  ler planilha -> consolidar colecoes I25..V27 por marca (centavos/100)
#          -> fat24m, curva por tercil, tendencia (I26+T26+V27 vs I25+T25+V26)
#          -> mapear rep por UF (ou por CODREP quando a coluna existir no export)
#          -> injetar JSON no template e salvar
```

Recomendação forte para a próxima extração: incluir a coluna CODREP no export do ERP. Hoje a carteira é atribuída por UF de atuação do representante (aproximação); com CODREP real, o vínculo fica exato e elimina divisões arbitrárias em estados com mais de um representante (SP, MG).

---

# 4. ESTRUTURA DE PASTAS NO SERVIDOR

```
/var/www/representantes/
├── index.html            (plataforma)
├── formulario.html       (análise da ação + kit)
├── manuais/              (PDFs de políticas, manuais, regulamentos, catálogo)
└── comunicados/          (fase 2: JSON editável de comunicados)
```

---

# 5. FASE 2 | BACKEND (autenticação real e fluxo de aprovação vivo)

Quando o piloto validar o uso, evoluir para uma aplicação leve no mesmo VPS:

| Componente | Escolha recomendada | Função |
|---|---|---|
| API | Node.js + Express (ou Fastify) atrás do Nginx (proxy reverso) | Servir dados por representante autenticado |
| Banco | PostgreSQL (ou SQLite no início) | Tabelas do toolkit: clientes, historico_colecoes, diagnosticos, acoes, aprovacoes, usuarios |
| Autenticação | Login por e-mail (os e-mails já estão no Representantes.xlsx) + senha com hash, sessão JWT | Cada representante enxerga apenas a própria carteira, garantido no servidor |
| Carga Excel | Endpoint POST /admin/carga que recebe o xlsx e roda o mesmo processamento do script | Atualização vira upload no navegador, sem SSH |
| Formulário | O mesmo frontend, mas gravando via API nas tabelas reais | Prescrições, protocolos e timeline de aprovação passam a ser vivos |
| Aprovações | Página do gestor (badge) com Aprovar/Reprovar/Ajustar + e-mail via SMTP | Fecha o ciclo do toolkit |

Divisão de responsabilidades idêntica à especificada para o Wix (WIX_IMPLEMENTACAO_FORMULARIO.md, Seções 4 a 8): o que lá era coleção CMS e web module vira tabela PostgreSQL e rota Express; o motor de recomendação é o mesmo JavaScript, sem alteração.

## 5.1 Sequência de evolução sugerida
1. Fase 1 estática no ar (esta semana): piloto com 2 regionais
2. Fase 2a: autenticação + API de carteira (o HTML passa a buscar /api/carteira em vez do JSON embutido)
3. Fase 2b: formulário gravando prescrições e fluxo de aprovação com notificações
4. Fase 2c: upload de Excel pelo painel da diretoria + página de comunicados editável

---

# 6. CHECKLIST DE GO-LIVE (FASE 1)

1. DNS propagado e HTTPS ativo (cadeado no navegador)
2. Senha do portal (auth_basic) distribuída apenas aos representantes do piloto
3. Teste de login: Rony (código 1, 576 clientes, SC/RS/PR), Bruno (81, SP), Diretoria (0000, visão total)
4. Painel V27 conferido contra o Excia: total da carteira de 1 representante batendo com o relatório oficial
5. Clique em um cliente da carteira: histórico aberto por coleção e marca correto
6. Botão "Solicitar ação" abrindo o formulário com o cliente pré-preenchido
7. PDFs dos manuais carregados na pasta /manuais
8. Comunicados revisados pela diretoria antes da divulgação do link
