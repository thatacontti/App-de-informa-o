#!/usr/bin/env python3
"""
Build script para Painel Estratégico V27 - Grupo Catarina
=========================================================

Gera dois arquivos HTML self-contained:
  - painel_v27_diretoria.html  (com faturamento, SSS em R$, margens)
  - painel_v27_produto.html    (SSS por peças, sem valores financeiros)

Estrutura do projeto:
  painel_v27/
  ├── build.py                    ← ESTE ARQUIVO (montar os HTMLs)
  ├── template.html               ← estrutura HTML + CSS (16 KB)
  ├── styles.css                  ← CSS do painel (25 KB)
  ├── dashboard_diretoria.js      ← lógica JS versão diretoria (44 KB)
  ├── dashboard_produto.js        ← lógica JS versão produto (53 KB)
  └── dados/
      ├── d_v12.json              ← registros de vendas V27 (recs, reps, SSS, UF)
      ├── sku_final.json          ← imagens base64 originais (320x420 q72)
      ├── v26_por_marca.json      ← V26 segmentado {cli: {marca: fat}}
      ├── cidade_perfil.json      ← classificação IBGE por cidade
      └── Estilista.xls           ← mapa SKU → estilista

Uso:
  python3 build.py

Parâmetros (editar no __main__):
  BASE_VENDAS   = caminho do xlsx de vendas (ex: base_28_04.xlsx)
  IMG_QUALITY   = qualidade JPEG das imagens (65 = boa, 40 = leve)
  IMG_SIZE      = (largura, altura) das imagens
  MAPA_IMG_SIZE = (largura, altura) das imagens no mapa de ataque
"""

import pandas as pd
import json
import re
import base64
import os
from io import BytesIO

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    print("⚠ PIL não encontrado. Imagens serão usadas sem compressão.")


# ============================================================
# CONFIGURAÇÃO
# ============================================================
DIR = os.path.dirname(os.path.abspath(__file__))
DADOS_DIR = os.path.join(DIR, 'dados')

# Arquivos de dados
DADOS_VENDAS   = os.path.join(DADOS_DIR, 'd_v12.json')
DADOS_IMAGENS  = os.path.join(DADOS_DIR, 'sku_final.json')
DADOS_V26M     = os.path.join(DADOS_DIR, 'v26_por_marca.json')
DADOS_CIDADE   = os.path.join(DADOS_DIR, 'cidade_perfil.json')
DADOS_ESTILISTA = os.path.join(DADOS_DIR, 'Estilista.xls')

# Arquivos de código
TEMPLATE   = os.path.join(DIR, 'template.html')
CSS_FILE   = os.path.join(DIR, 'styles.css')
JS_DIR     = os.path.join(DIR, 'dashboard_diretoria.js')
JS_PROD    = os.path.join(DIR, 'dashboard_produto.js')

# Saída
OUTPUT_DIR = os.path.join(DIR, 'output')

# Configuração de imagens
IMG_QUALITY     = 65    # qualidade JPEG para moodboard/rank (0-100)
IMG_SIZE        = (280, 368)   # largura x altura para moodboard/rank
MAPA_IMG_QUALITY = 40   # qualidade JPEG para mapa de ataque
MAPA_IMG_SIZE    = (100, 131)  # largura x altura para mapa (menor = mais leve)

# Faixas de preço
FAIXAS = ['00-50','50-70','70-90','90-110','110-130','130+']
MARCAS = ['KIKI','MENINA ANJO','VALENT']
LINHAS = ['BEBE','PRIMEIROS PASSOS','INFANTIL','TEEN']

# Data de atualização (editar a cada atualização)
DATA_ATUALIZACAO = '28 de abril de 2026'


# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================

def compress_images(imgs_dict, size, quality):
    """Comprime imagens base64 para tamanho e qualidade especificados."""
    if not HAS_PIL:
        return imgs_dict
    result = {}
    for sku, b64 in imgs_dict.items():
        try:
            raw = base64.b64decode(b64)
            img = Image.open(BytesIO(raw)).convert('RGB')
            img = img.resize(size, Image.LANCZOS)
            buf = BytesIO()
            img.save(buf, format='JPEG', quality=quality)
            result[sku] = base64.b64encode(buf.getvalue()).decode()
        except:
            result[sku] = b64
    return result


def faixa_granular(pm):
    """Classifica PM em faixa de preço."""
    if pm < 50:  return '00-50'
    if pm < 70:  return '50-70'
    if pm < 90:  return '70-90'
    if pm < 110: return '90-110'
    if pm < 130: return '110-130'
    return '130+'


def build_mapa_card(s, imgs, est_map):
    """Gera HTML de um card do mapa de ataque."""
    fc = '#4a8b5a' if s['FAIXA']=='ENTRADA' else '#a08366' if s['FAIXA']=='MÉDIO' else '#8b4a6b' if s['FAIXA']=='PREMIUM' else '#888'
    im = f'<img src="data:image/jpeg;base64,{imgs[s["PROD"]]}" style="width:100%;height:100%;object-fit:cover;display:block">' if s['PROD'] in imgs else '<div style="width:100%;height:100%;background:#f0ebe5"></div>'
    en = est_map.get(s['PROD'], '')
    eh = f'<div style="font-size:.42rem;color:#8b6a8a;font-weight:600">{en}</div>' if en else ''
    return (
        f'<div style="width:68px;border:1px solid #e0d5ca;border-radius:4px;overflow:hidden" '
        f'title="{s["PROD"]} · {s["DESC_PROD"]}{" · "+en if en else ""}">'
        f'<div style="position:relative;width:68px;height:90px;overflow:hidden;background:#f5f0eb">{im}'
        f'<div style="position:absolute;top:2px;right:2px;font-size:.4rem;font-weight:700;text-transform:uppercase;padding:1px 3px;border-radius:2px;color:#fff;background:{fc}">{s["FAIXA"]}</div>'
        f'</div><div style="padding:2px 3px;text-align:center">'
        f'<div style="font-family:Georgia,serif;font-size:.75rem;font-weight:700;color:#2a2520">R$ {s["PM"]:.0f}</div>'
        f'<div style="font-family:monospace;font-size:.46rem;color:#8a7e72">{s["PROD"]}</div>{eh}</div></div>'
    )


def gap_cell():
    return '<td style="padding:4px;border:1px solid #e8e3dd;background:#fdf5f0;vertical-align:middle;text-align:center"><span style="font-size:.48rem;color:#c9a080;font-weight:600;text-transform:uppercase">gap</span></td>'


def marca_header(marca, n):
    co = '#a08366' if marca=='KIKI' else '#8b6a8a' if marca=='MENINA ANJO' else '#4a8b5a'
    return (
        f'<div style="margin-bottom:24px;border:1.5px solid {co}40;border-radius:12px;overflow:hidden;background:#fff">'
        f'<div style="padding:12px 16px;background:{co}10;border-bottom:1.5px solid {co}30;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
        f'<span style="background:{co};color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;font-size:.85rem">{marca}</span>'
        f'<span style="font-size:.72rem;color:#5a5047;font-family:monospace">{n} SKUs</span></div>'
    )


def table_header(first_col):
    h = (f'<table style="width:100%;border-collapse:collapse"><thead><tr>'
         f'<th style="padding:8px 6px;background:#f5f0eb;font-size:.62rem;text-transform:uppercase;letter-spacing:.8px;color:#8a7e72;font-weight:600;border:1px solid #e8e3dd;text-align:left;min-width:140px">{first_col}</th>')
    for fx in FAIXAS:
        h += f'<th style="padding:8px 4px;background:#f5f0eb;font-size:.62rem;text-transform:uppercase;letter-spacing:.6px;color:#8a7e72;font-weight:600;border:1px solid #e8e3dd;text-align:center;min-width:90px">R$ {fx}</th>'
    return h + '</tr></thead><tbody>'


def build_mapa_estatico(sku_df, imgs_mapa, est_map):
    """Gera o HTML completo dos dois mapas de ataque (estático)."""
    
    # MAPA 1: Preço × Tamanho
    m1 = '<h2 style="font-family:Georgia,serif;font-size:1.3rem;margin:32px 0 6px;color:#2a2520">Mapa de Preço por Tamanho e Marca</h2><p style="font-size:.78rem;color:#8a7e72;margin-bottom:16px">Marca × Linha/Idade · preço crescente</p>'
    for mk in MARCAS:
        ms = sku_df[sku_df['DESC_MARCA']==mk]
        if ms.empty: continue
        m1 += marca_header(mk, len(ms)) + table_header('Linha')
        for ln in LINHAS:
            ls = ms[ms['DESC_LINHA']==ln]
            if ls.empty: continue
            m1 += f'<tr><td style="padding:8px 10px;background:#faf8f5;font-family:Georgia,serif;font-size:.8rem;font-weight:600;color:#5a5047;border:1px solid #e8e3dd;vertical-align:top">{ln}<br><span style="font-size:.55rem;color:#a09080;font-weight:400">{len(ls)} SKUs</span></td>'
            for fx in FAIXAS:
                fs = ls[ls['PM'].apply(faixa_granular)==fx].sort_values('PM')
                if not fs.empty:
                    m1 += '<td style="padding:4px;border:1px solid #e8e3dd;vertical-align:top"><div style="display:flex;flex-wrap:wrap;gap:4px">'
                    for _,s in fs.iterrows(): m1 += build_mapa_card(s, imgs_mapa, est_map)
                    m1 += '</div></td>'
                else: m1 += gap_cell()
            m1 += '</tr>'
        m1 += '</tbody></table></div>'

    # MAPA 2: Tipo × Faixa
    m2 = '<hr style="border:none;border-top:2px solid #e0d5ca;margin:32px 0"><h2 style="font-family:Georgia,serif;font-size:1.3rem;margin:0 0 6px;color:#2a2520">Mapa de Ataque por Tipo de Produto</h2><p style="font-size:.78rem;color:#8a7e72;margin-bottom:16px">Tipo × Faixa por Marca e Linha</p>'
    for mk in MARCAS:
        ms = sku_df[sku_df['DESC_MARCA']==mk]
        if ms.empty: continue
        m2 += marca_header(mk, len(ms)) + table_header('Tipo / Linha')
        for ln in LINHAS:
            ls = ms[ms['DESC_LINHA']==ln]
            if ls.empty: continue
            tipos = sorted(ls['DESC_GRUPO'].unique(), key=lambda t: ls[ls['DESC_GRUPO']==t]['qtd'].sum(), reverse=True)
            m2 += f'<tr><td colspan="{len(FAIXAS)+1}" style="padding:6px 10px;background:#f0ebe5;font-family:Georgia,serif;font-size:.8rem;font-weight:600;border:1px solid #e8e3dd;border-bottom:2px solid #d4c9bc">{ln} ({len(ls)})</td></tr>'
            for tp in tipos:
                ts = ls[ls['DESC_GRUPO']==tp]
                m2 += f'<tr><td style="padding:6px 8px;background:#faf8f5;font-size:.7rem;font-weight:600;color:#5a5047;border:1px solid #e8e3dd;vertical-align:top">{tp} <span style="font-size:.55rem;color:#a09080">({len(ts)})</span></td>'
                for fx in FAIXAS:
                    fs = ts[ts['PM'].apply(faixa_granular)==fx].sort_values('PM')
                    if not fs.empty:
                        m2 += '<td style="padding:4px;border:1px solid #e8e3dd;vertical-align:top"><div style="display:flex;flex-wrap:wrap;gap:4px">'
                        for _,s in fs.iterrows(): m2 += build_mapa_card(s, imgs_mapa, est_map)
                        m2 += '</div></td>'
                    else: m2 += gap_cell()
                m2 += '</tr>'
        m2 += '</tbody></table></div>'

    return m1 + m2


def build_panel(version, template_html, css, js_code, data_block, mapa_html, reps_btns, data_str):
    """
    Monta o HTML final do painel.
    version: 'diretoria' ou 'produto'
    """
    html = template_html
    
    # Inserir CSS inline
    html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>{css}</style>')
    
    # Inserir mapa estático
    html = html.replace('<!-- MAPA_ATAQUE_PLACEHOLDER -->', mapa_html)
    
    # Inserir reps
    pattern = re.compile(
        r'(<div class="fgrp"><span class="flbl">Representante</span>).*?(</div><div class="fgrp"><span class="flbl">Tipo Produto</span>)',
        re.DOTALL
    )
    html = pattern.sub(r'\1' + reps_btns + r'\2', html)
    
    # Atualizar data
    html = re.sub(r'\d+ de abril de 2026', data_str, html)
    
    # Ajustes de título para versão produto
    if version == 'produto':
        replacements = {
            'Painel V27 · Atualizado': 'Painel V27 · Versão Produto',
            'Análise estratégica completa': 'SSS por peças vendidas · mix e arquitetura de preço',
            'Same Store Sales · V26': 'Same Store Sales · Peças V26 est vs V27',
            'Performance por Estado · V26 vs V27': 'Peças por Estado',
            'SSS por Perfil · Recorrentes': 'Peças por Perfil de Cliente',
            'Top 20 Clientes': 'Top 20 Clientes por Volume de Peças',
            'SSS por Marca · V26 estimado vs V27': 'SSS Peças por Marca · V26 est vs V27',
            'SSS por Marca × Linha / Idade': 'SSS Peças por Marca × Linha',
            '>SSS por Linha / Idade<': '>SSS Peças por Linha / Idade<',
            'Performance por Perfil de Cidade · Classificação IBGE': 'Peças por Perfil de Cidade · IBGE',
            'Performance por Faixa Granular de Preço (PM)': 'Peças por Faixa de Preço',
            'V26 por marca = base oficial segmentada': 'V26 peças estimadas = faturamento V26 ÷ PM V27 por marca',
            'Match real cliente × marca × ano. Sem estimativa.': 'Peças V26 estimadas · V27 peças reais.',
            'V26 não tem informação de linha.': 'SSS por peças: V26 estimado, V27 real.',
            'Cada linha está positiva?': 'SSS peças por linha:',
            'Cards mostram SSS estimado por linha': 'Cards mostram SSS por volume de peças',
        }
        for old, new in replacements.items():
            html = html.replace(old, new)
    
    # Inserir script
    script_placeholder = html.find('<script>')
    script_end = html.rfind('</script>') + len('</script>')
    html = html[:script_placeholder] + '<script>' + data_block + js_code + '</script>' + html[script_end:]
    
    return html


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("BUILD PAINEL V27 - GRUPO CATARINA")
    print("=" * 60)
    
    # 1. Carregar dados
    print("\n[1/6] Carregando dados...")
    d = json.load(open(DADOS_VENDAS))
    imgs_orig = json.load(open(DADOS_IMAGENS))
    v26m = json.load(open(DADOS_V26M))
    cid_perfil = json.load(open(DADOS_CIDADE))
    pm_marca = d.get('pm_marca_v27', {'KIKI': 78, 'MENINA ANJO': 86, 'VALENT': 75})
    
    # Estilista
    est_map = {}
    if os.path.exists(DADOS_ESTILISTA):
        est_df = pd.read_excel(DADOS_ESTILISTA)
        est_df['Código'] = est_df['Código'].astype(str).str.upper().str.strip()
        est_map = dict(zip(
            est_df[est_df['Estilista'].notna()]['Código'],
            est_df[est_df['Estilista'].notna()]['Estilista']
        ))
        print(f"  Estilistas: {len(est_map)} SKUs mapeados")
    
    print(f"  Records: {len(d['recs'])} | SKUs imagem: {len(imgs_orig)} | Reps: {len(d['reps_full'])}")
    
    # 2. Comprimir imagens
    print("\n[2/6] Comprimindo imagens...")
    imgs_good = compress_images(imgs_orig, IMG_SIZE, IMG_QUALITY)
    imgs_mapa = compress_images(imgs_orig, MAPA_IMG_SIZE, MAPA_IMG_QUALITY)
    print(f"  Moodboard/rank: {sum(len(v) for v in imgs_good.values())/1024/1024:.1f} MB ({IMG_SIZE[0]}x{IMG_SIZE[1]} q{IMG_QUALITY})")
    print(f"  Mapa de ataque: {sum(len(v) for v in imgs_mapa.values())/1024/1024:.1f} MB ({MAPA_IMG_SIZE[0]}x{MAPA_IMG_SIZE[1]} q{MAPA_IMG_QUALITY})")
    
    # 3. Carregar template e código
    print("\n[3/6] Carregando template e código...")
    template = open(TEMPLATE).read()
    css = open(CSS_FILE).read()
    js_dir = open(JS_DIR).read()
    js_prod = open(JS_PROD).read()
    print(f"  Template: {len(template)/1024:.0f} KB | CSS: {len(css)/1024:.0f} KB")
    print(f"  JS Diretoria: {len(js_dir)/1024:.0f} KB | JS Produto: {len(js_prod)/1024:.0f} KB")
    
    # 4. Construir mapa de ataque estático
    print("\n[4/6] Construindo mapa de ataque...")
    # Precisa do sku_df para o mapa - extrair dos records
    sku_dict = {}
    for r in d['recs']:
        p = r['p']
        if p not in sku_dict:
            sku_dict[p] = {'PROD': p, 'DESC_PROD': r['dp'], 'DESC_MARCA': r['m'],
                          'DESC_LINHA': r['l'], 'DESC_GRUPO': r['g'], 'FAIXA': r['fx'],
                          'fat': 0, 'qtd': 0}
        sku_dict[p]['fat'] += r['f']
        sku_dict[p]['qtd'] += r['q']
    sku_df = pd.DataFrame(sku_dict.values())
    sku_df['PM'] = sku_df['fat'] / sku_df['qtd']
    
    mapa_html = build_mapa_estatico(sku_df, imgs_mapa, est_map)
    print(f"  Mapa estático: {len(mapa_html)/1024/1024:.1f} MB | Estilistas: {mapa_html.count('8b6a8a')} cards")
    
    # 5. Preparar data block
    print("\n[5/6] Montando data blocks...")
    reps_btns = '<button class="fb act" data-r="ALL" onclick="setF(\'r\',this,\'ALL\')">Todos</button>'
    for r in d['reps_full']:
        full = r['full'].replace("'", "\\'")
        reps_btns += f'<button class="fb" data-r="{full}" onclick="setF(\'r\',this,\'{full}\')" title="{r["full"]}">{r["short"]}</button>'
    
    sep = (',', ':')  # JSON compacto
    db_base = (
        'const D=' + json.dumps(d['recs'], ensure_ascii=False, separators=sep) +
        ';const IMG=' + json.dumps(imgs_good, separators=sep) +
        ';const SSSM=' + json.dumps(d['sss_marca'], ensure_ascii=False, separators=sep) +
        ';const V26M=' + json.dumps(v26m, separators=sep) +
        ';const UFYOY=' + json.dumps(d['uf_rank_yoy'], ensure_ascii=False, separators=sep) +
        ';const CIDADE_PERFIL=' + json.dumps(cid_perfil, ensure_ascii=False, separators=sep) + ';'
    )
    db_prod = db_base + 'const PM_V27=' + json.dumps(pm_marca, separators=sep) + ';'
    
    # 6. Montar HTMLs finais
    print("\n[6/6] Montando HTMLs finais...")
    
    diretoria = build_panel('diretoria', template, css, js_dir, db_base, mapa_html, reps_btns, DATA_ATUALIZACAO)
    out_dir = os.path.join(OUTPUT_DIR, 'painel_v27_diretoria.html')
    open(out_dir, 'w', encoding='utf-8').write(diretoria)
    print(f"  ✓ Diretoria: {len(diretoria)/1024/1024:.1f} MB → {out_dir}")
    
    produto = build_panel('produto', template, css, js_prod, db_prod, mapa_html, reps_btns, DATA_ATUALIZACAO)
    out_prod = os.path.join(OUTPUT_DIR, 'painel_v27_produto.html')
    open(out_prod, 'w', encoding='utf-8').write(produto)
    print(f"  ✓ Produto:   {len(produto)/1024/1024:.1f} MB → {out_prod}")
    
    print("\n" + "=" * 60)
    print("BUILD CONCLUÍDO")
    print("=" * 60)
