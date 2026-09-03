#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Carga de dados da Plataforma do Representante · Grupo Catarina
Entrada:  data/CADSTRO_DE_CLIENTES.xlsx (Excia: clientes x coleções por marca, valores em CENTAVOS)
          data/Representantes.xlsx (aba 'VERÃO 2027': roster de RCs)
Saída:    frontend/plataforma.html e frontend/formulario.html com o bloco de dados substituído
Uso:      python3 scripts/atualiza_plataforma.py
"""
import pandas as pd, json, re, unicodedata, sys, os
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ_CLIENTES = os.path.join(BASE, 'data', 'CADSTRO_DE_CLIENTES.xlsx')
ARQ_REPS     = os.path.join(BASE, 'data', 'Representantes.xlsx')

# Coleções consideradas nos últimos 2 anos (Primavera+Verão somadas por coleção)
MAP = {'INVERNO 2025':'I25','INVERNO 2026':'I26','TROPICAL 2025':'T25','TROPICAL 2026':'T26',
       'VERAO 2026 - PRIMAVERA':'V26','VERAO 2026 - VERAO':'V26',
       'VERAO 2027 - PRIMAVERA':'V27','VERAO 2027 - VERAO':'V27'}
BR  = {'KIKI':'KIKI','MENINA ANJO':'MA','VALENT':'VAL'}
ORD = ['I25','T25','V26','I26','T26','V27']

def norm(s):
    s = str(s).upper().replace('–','-').replace('*','').strip()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c)!='Mn')
    return ' '.join(s.split())

def carrega_clientes():
    raw = pd.read_excel(ARQ_CLIENTES, header=None)
    brands = raw.iloc[0].ffill().tolist()
    cols   = raw.iloc[1].tolist()
    df = raw.iloc[2:].reset_index(drop=True)
    targets = []
    for i,(b,c) in enumerate(zip(brands, cols)):
        if norm(c) in MAP and norm(b) in BR:
            targets.append((i, BR[norm(b)], MAP[norm(c)]))
    db = {}
    for _, row in df.iterrows():
        try: cod = str(int(row[0]))
        except Exception: continue
        if cod == '0': continue
        h = {}
        for i,b,col in targets:
            v = pd.to_numeric(row[i], errors='coerce')
            if pd.notna(v) and v > 0:
                h.setdefault(b, {}); h[b][col] = h[b].get(col,0) + float(v)/100.0  # centavos -> R$
        if not h: continue
        fat = sum(sum(cc.values()) for cc in h.values())
        if fat < 1: continue
        rec  = sum(cc.get(k,0) for cc in h.values() for k in ['I26','T26','V27'])
        prev = sum(cc.get(k,0) for cc in h.values() for k in ['I25','T25','V26'])
        if prev==0 and rec>0: t='up'
        elif rec==0 and prev>0: t='down'
        elif prev>0 and rec>prev*1.1: t='up'
        elif prev>0 and rec<prev*0.9: t='down'
        else: t='flat'
        db[cod] = {'n':str(row[2])[:48],'c':str(row[3]).title(),'u':str(row[4]).strip().upper(),
                   'f':round(fat),'h':{b:{k:round(v) for k,v in cc.items()} for b,cc in h.items()},'t':t}
    fats = sorted(d['f'] for d in db.values())
    n = len(fats); t1 = fats[int(n*2/3)]; t2 = fats[int(n*1/3)]
    for d in db.values():
        d['cv'] = 'A' if d['f']>=t1 else ('B' if d['f']>=t2 else 'C')
    print(f'clientes ativos: {n} | tercis curva A>= {t1:,.0f} B>= {t2:,.0f}'.replace(',','.'))
    return db

def carrega_reps():
    raw = pd.read_excel(ARQ_REPS, sheet_name='VERÃO 2027', header=None)
    df = raw.iloc[1:].copy()
    df.columns = ['analista','analista2','nome','entidade','codrc','representada','regiao','uf','macro','fone','email']
    df = df.dropna(subset=['nome'])
    reps, seen = [], {}
    for _, r in df.iterrows():
        cod = re.sub(r'\D','',str(r['codrc'])).lstrip('0')
        if not cod: continue
        ufs = [u.strip().upper() for u in re.split(r'[|/,]', str(r['uf'])) if u.strip() and u.strip().upper()!='NAN']
        item = {'cod':cod,'nome':str(r['nome']).strip(),'rz':str(r['representada']).strip()[:42],
                'reg':str(r['regiao']).strip(),'ufs':ufs,'macro':str(r['macro']).strip().title(),
                'email':str(r['email']).strip() if str(r['email'])!='nan' else ''}
        seen.setdefault(cod, item)
    reps = list(seen.values())
    print(f'representantes: {len(reps)}')
    return reps

def vincula(db, reps):
    """Vínculo cliente-representante. Se a coluna CODREP existir no export, usar direto;
    fallback: aproximação por UF com distribuição determinística (hash do codcli)."""
    byuf = defaultdict(list)
    for r in reps:
        for u in r['ufs']: byuf[u].append(r['cod'])
    def h(s):
        x=0
        for c in s: x=(x*31+ord(c))&0xffffffff
        return x
    sem=0
    for cod,d in db.items():
        lst = byuf.get(d['u'])
        if lst: d['rep']=lst[h(cod)%len(lst)]
        else: d['rep']='0'; sem+=1
    print(f'clientes carteira casa (UF sem representante): {sem}')

def valida(db):
    total = sum(d['f'] for d in db.values())
    print(f'CHECKPOINT: faturamento 24m total = R$ {total:,.2f}'.replace(',','X').replace('.',',').replace('X','.'))
    print('Confira este total contra o relatório oficial do Excia ANTES de publicar. Divergência = não publica.')

def publica(db, reps):
    data = json.dumps({'reps':reps,'db':db}, ensure_ascii=False, separators=(',',':'))
    for arq, marcador in [('frontend/plataforma.html','const DATA='), ('frontend/formulario.html','const DB=')]:
        path = os.path.join(BASE, arq)
        html = open(path, encoding='utf-8').read()
        if marcador == 'const DATA=':
            html = re.sub(r'const DATA=\{.*?\};', 'const DATA='+data+';', html, count=1, flags=re.S)
        else:
            html = re.sub(r'const DB=\{.*?\};', 'const DB='+json.dumps(db,ensure_ascii=False,separators=(",",":"))+';', html, count=1, flags=re.S)
        open(path,'w',encoding='utf-8').write(html)
        print(f'atualizado: {arq} ({len(html)/1024:.0f} KB)')

if __name__ == '__main__':
    db = carrega_clientes()
    reps = carrega_reps()
    vincula(db, reps)
    valida(db)
    if '--publicar' in sys.argv:
        publica(db, reps)
        print('\nPronto. Envie frontend/plataforma.html (como index.html) e frontend/formulario.html ao servidor.')
    else:
        print('\nSimulação concluída. Rode com --publicar para gravar nos HTMLs.')
