#!/usr/bin/env python3
# Publica o portal do orcamento no Nginx Proxy Manager de forma automatica:
# cria (ou atualiza) o Proxy Host budget.grupocatarina.com -> sgo-portal:80
# e emite o certificado Let's Encrypt, sem clicar na tela do NPM.
#
# Uso (no servidor):
#   python3 scripts/publicar-npm.py
# Ele pergunta o e-mail e a senha de login do NPM (painel da porta 81).
#
# Requisitos: rodar dentro do VPS (a API do NPM responde em 127.0.0.1:81).

import sys, json, urllib.request, urllib.error, getpass

BASE = "http://127.0.0.1:81/api"
DOMAIN = "budget.grupocatarina.com"
FWD_HOST = "sgo-portal"
FWD_PORT = 80


def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            t = resp.read().decode()
            return resp.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t


def main():
    email = input("E-mail de login do NPM: ").strip()
    pw = getpass.getpass("Senha do NPM: ")

    st, j = req("POST", "/tokens", body={"identity": email, "secret": pw})
    if st != 200 or not isinstance(j, dict) or "token" not in j:
        print("ERRO no login do NPM:", j)
        sys.exit(1)
    tok = j["token"]
    print("Login OK.")

    st, hosts = req("GET", "/nginx/proxy-hosts", tok)
    existing = None
    if isinstance(hosts, list):
        existing = next((h for h in hosts if DOMAIN in (h.get("domain_names") or [])), None)

    st, certs = req("GET", "/nginx/certificates", tok)
    cert_id = 0
    if isinstance(certs, list):
        c = next((c for c in certs
                  if DOMAIN in (c.get("domain_names") or []) and c.get("provider") == "letsencrypt"), None)
        if c:
            cert_id = c.get("id")
            print("Certificado ja existe (id %s), reutilizando." % cert_id)

    if not cert_id:
        print("Solicitando certificado Let's Encrypt (pode levar ate 1 minuto)...")
        st, c = req("POST", "/nginx/certificates", tok, {
            "provider": "letsencrypt", "nice_name": DOMAIN, "domain_names": [DOMAIN],
            "meta": {"letsencrypt_email": email, "letsencrypt_agree": True, "dns_challenge": False}})
        if st in (200, 201) and isinstance(c, dict) and c.get("id"):
            cert_id = c["id"]
            print("Certificado emitido (id %s)." % cert_id)
        else:
            print("AVISO: nao consegui emitir o certificado agora:", c)
            print("Vou criar a entrada em HTTP mesmo assim; o SSL pode ser pedido depois.")

    body = {
        "domain_names": [DOMAIN], "forward_scheme": "http", "forward_host": FWD_HOST, "forward_port": FWD_PORT,
        "caching_enabled": False, "block_exploits": True, "allow_websocket_upgrade": True, "access_list_id": 0,
        "certificate_id": cert_id, "ssl_forced": bool(cert_id), "http2_support": bool(cert_id),
        "hsts_enabled": False, "hsts_subdomains": False,
        "meta": {"letsencrypt_agree": True, "dns_challenge": False}, "advanced_config": "", "locations": []}

    if existing:
        st, r = req("PUT", "/nginx/proxy-hosts/%s" % existing["id"], tok, body)
        print("Entrada ATUALIZADA:", "OK" if st in (200, 201) else r)
    else:
        st, r = req("POST", "/nginx/proxy-hosts", tok, body)
        print("Entrada CRIADA:", "OK" if st in (200, 201) else r)

    print("\nPronto. Abra https://%s e de um Ctrl+F5." % DOMAIN)


if __name__ == "__main__":
    main()
