# Implantação do orçamento no VPS grupocatarina-vps

Este servidor **já roda outros sistemas** (Directus, n8n, um painel) atrás de um
**Nginx Proxy Manager** (NPM), que controla as portas 80/443 e o HTTPS. O portal
do orçamento é encaixado ao lado deles, **sem alterar nada do que já existe**:

- o **banco** do orçamento fica interno (sem porta pública) — não concorre com o PostgreSQL existente na 5432;
- o **portal** serve em HTTP interno e entra na mesma rede Docker do NPM;
- o **NPM** publica `https://budget.grupocatarina.com` encaminhando para `sgo-portal:80` e cuida do certificado.

## Endereço e DNS

- Endereço final: **https://budget.grupocatarina.com**
- Registro DNS necessário (pedir ao TI):

  | Campo | Valor |
  |---|---|
  | Tipo | `A` |
  | Nome/Host | `budget` |
  | Valor | `179.197.73.36` |
  | TTL | `3600` (ou `300` durante a implantação) |

  Se o DNS estiver na Cloudflare, deixar como **"DNS only"** (nuvem cinza) até o certificado emitir.

## Passo 1 — Reabrir o servidor

No PowerShell do Windows:

    ssh root@179.197.73.36

Digite a senha de root. Depois:

    cd /root/sgo-app

## Passo 2 — Aplicar a configuração e subir (não afeta os outros sistemas)

Cole o bloco inteiro. Ele detecta a rede do NPM, reescreve `docker-compose.yml` e
`infra/Caddyfile` já no formato correto, e sobe o orçamento:

    cd /root/sgo-app

    NET=$(docker inspect grupocatarina-vps-proxy-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
    echo "Rede do NPM detectada: $NET"
    grep -q '^REDE_EXTERNA=' .env && sed -i "s|^REDE_EXTERNA=.*|REDE_EXTERNA=$NET|" .env || echo "REDE_EXTERNA=$NET" >> .env
    grep -q '^DOMINIO=' .env && sed -i "s|^DOMINIO=.*|DOMINIO=budget.grupocatarina.com|" .env || echo "DOMINIO=budget.grupocatarina.com" >> .env

    cat > docker-compose.yml <<'YAML'
    services:
      banco:
        image: postgres:16-alpine
        container_name: sgo-banco
        restart: unless-stopped
        environment:
          POSTGRES_USER: ${POSTGRES_USER}
          POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
          POSTGRES_DB: ${POSTGRES_DB}
        volumes:
          - dados_banco:/var/lib/postgresql/data
          - ./docs/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
          - ./backups:/backups
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
          interval: 10s
          timeout: 5s
          retries: 5
      portal:
        build: .
        container_name: sgo-portal
        restart: unless-stopped
        environment:
          SENHA_PORTAL_HASH: ${SENHA_PORTAL_HASH}
        depends_on:
          banco:
            condition: service_healthy
        networks:
          - default
          - externa
      adminer:
        image: adminer:latest
        container_name: sgo-adminer
        restart: unless-stopped
        environment:
          ADMINER_DEFAULT_SERVER: banco
        networks:
          - default
    volumes:
      dados_banco:
    networks:
      externa:
        external: true
        name: ${REDE_EXTERNA}
    YAML

    cat > infra/Caddyfile <<'CADDY'
    :80 {
    	encode gzip
    	handle_path /adminer* {
    		basic_auth {
    			admin {$SENHA_PORTAL_HASH}
    		}
    		reverse_proxy adminer:8080
    	}
    	handle {
    		basic_auth {
    			admin {$SENHA_PORTAL_HASH}
    		}
    		root * /srv
    		try_files {path} /index.html
    		file_server
    	}
    }
    CADDY

    docker compose up -d --build
    echo "----- aguardando 15s -----"; sleep 15
    docker compose ps
    echo "===== teste interno (deve responder 401) ====="
    docker exec sgo-portal wget -S -qO /dev/null http://localhost/ 2>&1 | grep -i 'HTTP/' | head -1

Esperado: `sgo-banco` e `sgo-portal` como **Up** (banco `healthy`), e o teste interno
mostrando **401** (o portal está servindo, protegido por senha). Os contêineres
`grupocatarina-vps-*` continuam intactos.

## Passo 3 — Publicar no Nginx Proxy Manager

1. Abra **http://179.197.73.36:81** e faça login no NPM.
2. **Hosts → Proxy Hosts → Add Proxy Host.**
3. Aba **Details**:
   - Domain Names: `budget.grupocatarina.com`
   - Scheme: `http`
   - Forward Hostname / IP: `sgo-portal`
   - Forward Port: `80`
   - Block Common Exploits: ligado
4. Aba **SSL** (só depois do DNS propagar):
   - SSL Certificate: **Request a new SSL Certificate** (Let's Encrypt)
   - Force SSL: ligado
   - aceite os termos e salve.
5. Se o certificado não emitir, confirme que `budget.grupocatarina.com` já resolve
   para `179.197.73.36` (o DNS pode levar de minutos a horas).

## Passo 4 — Ver a senha do portal

    cat /root/sgo-app/SENHA-PORTAL.txt

Pronto: **https://budget.grupocatarina.com** (usuário `admin` + a senha). O Adminer
fica em **/adminer**.

## Atualizar no futuro

Reenvie os arquivos (Passo 2 do DEPLOY-WINDOWS.md) e rode:

    cd /root/sgo-app && docker compose up -d --build

O `.env` e o banco são preservados.
