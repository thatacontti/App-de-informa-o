const F={m:'ALL',uf:'ALL',r:'ALL',g:'ALL',fx:'ALL',li:'ALL'};
const brl=v=>'R$ '+Math.round(v||0).toLocaleString('pt-BR');
const num=v=>Math.round(v||0).toLocaleString('pt-BR');
const img=(s,sz)=>IMG[s]?`<img src="data:image/jpeg;base64,${IMG[s]}" style="width:${sz}px;height:${sz}px;border-radius:5px;object-fit:cover;display:block">`:`<div style="width:${sz}px;height:${sz}px;background:#f5efe5;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#c9b8a3;font-size:.65rem">—</div>`;
const mcls=m=>m==='KIKI'?'mk':m==='MENINA ANJO'?'mm':'mv';
const pcX=p=>p==='VIP 3+'?'VIP3':p.replace(/\s/g,'');
const mgcls=g=>g>=65?'mg-h':g>=50?'mg-m':'mg-l';
const fxcls=f=>f==='SEM CADASTRO'?'SEM':f==='MÉDIO'?'MED':f.substring(0,3);
const filt=()=>D.filter(r=>(F.m==='ALL'||r.m===F.m)&&(F.uf==='ALL'||r.uf===F.uf)&&(F.r==='ALL'||r.rp===F.r)&&(F.g==='ALL'||r.g===F.g)&&(F.fx==='ALL'||r.fx===F.fx)&&(F.li==='ALL'||r.l===F.li));

function render(){
  const X=filt();
  if(!X.length){document.getElementById('kpis').innerHTML='<div style="padding:30px;text-align:center;color:#8a7f74">Sem dados</div>';return;}
  const fat=X.reduce((s,r)=>s+r.f,0),qtd=X.reduce((s,r)=>s+r.q,0),ct=X.reduce((s,r)=>s+r.ct,0);
  const cli=new Set(X.map(r=>r.c)).size,sku=new Set(X.map(r=>r.p)).size;
  const mg=fat?(fat-ct)/fat*100:0,pm=qtd?fat/qtd:0;
  document.getElementById('kpis').innerHTML=`<div class="kpi"><div class="l">Peças vendidas</div><div class="v">${num(qtd)}</div></div><div class="kpi"><div class="l">SKUs</div><div class="v">${sku}</div></div><div class="kpi"><div class="l">Clientes</div><div class="v">${cli}</div></div><div class="kpi"><div class="l">Pedidos</div><div class="v">${new Set(X.map(r=>r.p+'|'+r.c)).size}</div></div>`;
  // PARTICIPAÇÃO POR MARCA
  const mkShare={};let mkTot=0;
  X.forEach(r=>{mkShare[r.m]=(mkShare[r.m]||0)+r.q;mkTot+=r.q});
  let msH='<div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin:16px 0">';
  ['KIKI','MENINA ANJO','VALENT'].forEach(m=>{
    const v=mkShare[m]||0;const pct=mkTot?v/mkTot*100:0;
    const co=m==='KIKI'?'#a08366':m==='MENINA ANJO'?'#8b6a8a':'#4a8b5a';
    msH+='<div style="text-align:center;padding:14px 20px;border:1.5px solid '+co+'40;border-radius:10px;background:'+co+'08;min-width:180px"><div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.8px;color:'+co+';font-weight:600;margin-bottom:6px">'+m+'</div><div style="font-family:Fraunces,serif;font-size:1.5rem;font-weight:700;color:#2a2520">'+pct.toFixed(1)+'%</div><div style="font-size:.75rem;color:#5a5047;margin-top:2px">'+num(v)+' peças</div></div>';
  });
  msH+='</div>';
  const msEl=document.getElementById('marca-share');
  if(msEl)msEl.innerHTML=msH;

  // SSS macro — MESMO método da tabela SSS Marca: todos os cli recorrentes, zero quando não comprou
  // Recorte sem filtro de marca (para identificar cli recorrentes)
  const dataMacro=D.filter(r=>(F.uf==='ALL'||r.uf===F.uf)&&(F.r==='ALL'||r.rp===F.r)&&(F.g==='ALL'||r.g===F.g)&&(F.fx==='ALL'||r.fx===F.fx)&&(F.li==='ALL'||r.l===F.li));
  const clisInRecorte=new Set(dataMacro.map(r=>r.c));
  const clisRec=[...clisInRecorte].filter(c=>V26M[c]);
  // V26 e V27 por cliente para identificar outliers
  const cliF26={}, cliF27={};
  clisRec.forEach(c=>{
    if(F.m!=='ALL') cliF26[c]=(V26M[c][F.m]||0);
    else cliF26[c]=Object.values(V26M[c]).reduce((s,v)=>s+v,0);
    cliF27[c]=0;
  });
  dataMacro.filter(r=>clisInRecorte.has(r.c)&&V26M[r.c]&&(F.m==='ALL'||r.m===F.m)).forEach(r=>{cliF27[r.c]=(cliF27[r.c]||0)+r.f});
  // Identificar outliers (>+100%)
  const outliers=clisRec.filter(c=>cliF26[c]>0&&((cliF27[c]-cliF26[c])/cliF26[c]*100)>100);
  const cliNormais=clisRec.filter(c=>!outliers.includes(c));
  // Totais com todos os recorrentes
  let macroV26=0, macroV27=0;
  clisRec.forEach(c=>{macroV26+=cliF26[c]||0;macroV27+=cliF27[c]||0});
  const vSSS=macroV26?(macroV27-macroV26)/macroV26*100:0;
  // Totais SEM outliers
  let v26Norm=0, v27Norm=0;
  cliNormais.forEach(c=>{v26Norm+=cliF26[c]||0;v27Norm+=cliF27[c]||0});
  const sssNorm=v26Norm?(v27Norm-v26Norm)/v26Norm*100:0;
  // Outliers separados
  let v26Out=0, v27Out=0;
  outliers.forEach(c=>{v26Out+=cliF26[c]||0;v27Out+=cliF27[c]||0});
  // NOVO 27 (sem V26)
  let macroNovoF=0, macroNovoCli=new Set();
  X.forEach(r=>{if(!V26M[r.c]){macroNovoF+=r.f;macroNovoCli.add(r.c)}});
  const f27Tot=X.reduce((s,r)=>s+r.f,0);
  // Banner principal + linha de análise sem outliers
  let macroHTML=`<div class="heroSSS"><div class="hcard"><div class="hh">V26 · ${clisRec.length} cli recorrentes</div><div class="hv">${num(Math.round(macroV26/80))}</div></div><div class="harr">→</div><div class="hcard v27"><div class="hh">V27 dos mesmos ${clisRec.length} cli</div><div class="hv">${num(Math.round(macroV27/80))}</div></div><div class="harr">=</div><div class="hcard var"><div class="hh">SSS YoY</div><div class="hv gr">${vSSS>=0?'+':''}${vSSS.toFixed(1)}%</div><div class="hh" style="margin-top:6px">+ ${num(qNovo)} de ${macroNovoCli.size} NOVO 27</div><div class="hh" style="margin-top:4px;opacity:.8">Carteira total V27: <b>${num(qTot)}</b></div></div></div>`;
  // Linha de análise normalizada
  if(outliers.length>0){
    const sssNcl=sssNorm>=0?'gr':'rd';
    macroHTML+=`<div class="sss-norm"><div class="sss-norm-hdr"><b>Análise normalizada</b> · excluindo ${outliers.length} cliente${outliers.length>1?'s':''} com crescimento &gt; +100% (outliers)</div><div class="sss-norm-grid"><div class="snc"><div class="snc-l">${cliNormais.length} cli normais</div><div class="snc-v">V26 ${num(Math.round(v26Norm/80))} pç → V27 ${num(Math.round(v27Norm/80))} pç</div><div class="snc-r ${sssNcl}">SSS ${sssNorm>=0?'+':''}${sssNorm.toFixed(1)}%</div></div><div class="snc snc-out"><div class="snc-l">${outliers.length} outlier${outliers.length>1?'s':''} (&gt;+100%)</div><div class="snc-v"></div><div class="snc-r gr">+${v26Out?((v27Out-v26Out)/v26Out*100).toFixed(0):0}%</div></div></div><div class="sss-norm-foot">Os outliers contribuíram com <b>—</b> de crescimento absoluto · <b>${(((v27Out-v26Out)/(macroV27-macroV26))*100).toFixed(0)}%</b> do delta YoY total veio deles</div></div>`;
  }
  
  // SSS MACRO POR PEÇAS
  var qV26Tot=0,qV27Tot=0;
  var PM_MK={'KIKI':PM_V27.KIKI||78,'MENINA ANJO':PM_V27['MENINA ANJO']||86,'VALENT':PM_V27.VALENT||75};
  var cliRecSet2=new Set(clisRec);
  clisRec.forEach(function(c){
    if(!V26M[c])return;
    Object.entries(V26M[c]).forEach(function(e){qV26Tot+=e[1]/(PM_MK[e[0]]||80)});
  });
  qV27Tot=dataMacro.filter(function(r){return cliRecSet2.has(r.c)&&(F.m==='ALL'||r.m===F.m)}).reduce(function(s,r){return s+r.q},0);
  if(F.m!=='ALL'){qV26Tot=0;clisRec.forEach(function(c){if(V26M[c]&&V26M[c][F.m])qV26Tot+=V26M[c][F.m]/(PM_MK[F.m]||80)})}
  var qNovo=X.filter(function(r){return !V26M[r.c]}).reduce(function(s,r){return s+r.q},0);
  var qNovoC=new Set(X.filter(function(r){return !V26M[r.c]}).map(function(r){return r.c})).size;
  var qTot=X.reduce(function(s,r){return s+r.q},0);
  var sssQ=qV26Tot?(qV27Tot-qV26Tot)/qV26Tot*100:0;
  var sssQcl=sssQ>=0?'gr':'rd';
  document.getElementById('sss-macro').innerHTML='<div class="heroSSS"><div class="hcard"><div class="hh">V26 est · '+clisRec.length+' cli recorrentes</div><div class="hv">'+num(Math.round(qV26Tot))+' pç</div></div><div class="harr">→</div><div class="hcard v27"><div class="hh">V27 dos mesmos '+clisRec.length+' cli</div><div class="hv">'+num(qV27Tot)+' pç</div></div><div class="harr">=</div><div class="hcard var"><div class="hh">SSS Peças YoY</div><div class="hv '+sssQcl+'">'+(sssQ>=0?'+':'')+sssQ.toFixed(1)+'%</div><div class="hh" style="margin-top:6px">+ '+num(qNovo)+' pç de '+qNovoC+' NOVO 27</div><div class="hh" style="margin-top:4px;opacity:.8">Total V27: <b>'+num(qTot)+' peças</b></div></div></div>';


  // Construir cArr para o resto da aba (perfil, top clientes) usando lógica consistente
  const cm={};
  clisRec.forEach(c=>{
    const sample=dataMacro.find(r=>r.c===c);
    let f26cli=F.m!=='ALL'?(V26M[c][F.m]||0):Object.values(V26M[c]).reduce((s,v)=>s+v,0);
    cm[c]={nm:sample.nm,uf:sample.uf,cid:sample.cid,pf:sample.pf,f26:f26cli,f27:0,q:0,mc:new Set()};
  });
  X.forEach(r=>{if(cm[r.c]){cm[r.c].f27+=r.f;cm[r.c].q+=r.q;cm[r.c].mc.add(r.m)}});
  const novosCli={};
  X.forEach(r=>{
    if(V26M[r.c])return;
    if(!novosCli[r.c])novosCli[r.c]={nm:r.nm,uf:r.uf,cid:r.cid,pf:'NOVO 27',f26:0,f27:0,q:0,mc:new Set()};
    novosCli[r.c].f27+=r.f;novosCli[r.c].q+=r.q;novosCli[r.c].mc.add(r.m);
  });
  const cArr=[...Object.entries(cm).map(([c,v])=>({c:+c,...v,mc:v.mc.size})),...Object.entries(novosCli).map(([c,v])=>({c:+c,...v,mc:v.mc.size}))];
  const recur=cArr.filter(c=>c.f26>0);
  const novos=cArr.filter(c=>!c.f26||c.f26===0);
  // Nota: sss-macro já foi renderizado acima com método correto via V26M; não sobrescrever aqui.

  // SSS perfil
  const pm_={};cArr.forEach(c=>{if(!pm_[c.pf])pm_[c.pf]={n:0,f26:0,f27:0};pm_[c.pf].n++;pm_[c.pf].f26+=c.f26;pm_[c.pf].f27+=c.f27});
  const ORD=['VIP 3+','VIP','FREQUENTE','REGULAR','NOVO 27'];
  let ph='<table class="m"><thead><tr><th>Perfil</th><th class="r">Cli</th><th class="r">Pç V26 est</th><th class="r">Pç V27</th><th class="r">Var %</th><th class="r">Pç médio</th></tr></thead><tbody>';
  ORD.filter(p=>pm_[p]).forEach(p=>{const v=pm_[p];const vr=v.f26?(v.f27-v.f26)/v.f26*100:null;const cl=v.f26?(vr>0?'vu':'vd'):'nv';ph+=`<tr><td><span class="ppill cl-${pcX(p)}">${p}</span></td><td class="num">${v.n}</td><td class="money">${v.f26?num(Math.round(v.f26/80)):'—'}</td><td class="money"><b>${num(Math.round(v.f27/80))}</b></td><td class="num ${cl}"><b>${vr!==null?(vr>=0?'+':'')+vr.toFixed(0)+'%':'NOVO'}</b></td><td class="money">${num(Math.round(v.f27/80/v.n))}</td></tr>`});
  var pfPc={};X.forEach(function(r){var p=r.pf||'?';if(!pfPc[p])pfPc[p]={q:0,cli:new Set()};pfPc[p].q+=r.q;pfPc[p].cli.add(r.c)});
  var pfPcH='<table class="m"><thead><tr><th>Perfil</th><th class="r">Clientes</th><th class="r">Peças</th><th class="r">% Peças</th></tr></thead><tbody>';
  var pfTotQ=Object.values(pfPc).reduce(function(s,v){return s+v.q},0)||1;
  Object.entries(pfPc).sort(function(a,b){return b[1].q-a[1].q}).forEach(function(e){pfPcH+='<tr><td><b>'+e[0]+'</b></td><td class="num">'+e[1].cli.size+'</td><td class="num"><b>'+num(e[1].q)+'</b></td><td class="num">'+(e[1].q/pfTotQ*100).toFixed(1)+'%</td></tr>'});
  document.getElementById('sss-perf').innerHTML=pfPcH+'</tbody></table>';
  var _x=ph+'</tbody></table>';

  // Top clientes por peças
  cArr.sort((a,b)=>b.q-a.q);
  var q26est={};clisRec.forEach(function(c){if(V26M[c])Object.entries(V26M[c]).forEach(function(e){q26est[c]=(q26est[c]||0)+e[1]/(PM_MK[e[0]]||80)})});
  let ch='<table class="m"><thead><tr><th>#</th><th>Cliente</th><th>Cidade</th><th>UF</th><th>Perfil</th><th class="r">Pç V26 est</th><th class="r">Pç V27</th><th class="r">Var %</th></tr></thead><tbody>';
  cArr.slice(0,20).forEach((c,i)=>{const q26=Math.round(q26est[c.c]||0);const vr=q26?(c.q-q26)/q26*100:null;const cl=q26?(vr>20?'vu':vr<-20?'vd':'ve'):'nv';ch+=`<tr><td class="rk">#${i+1}</td><td><b>${c.nm.substring(0,28)}</b></td><td>${c.cid.substring(0,16)}</td><td>${c.uf}</td><td><span class="ppill cl-${pcX(c.pf)}">${c.pf}</span></td><td class="num">${q26?num(q26):'—'}</td><td class="num"><b>${num(c.q)}</b></td><td class="num ${cl}"><b>${vr!==null?(vr>=0?'+':'')+vr.toFixed(0)+'%':'NOVO'}</b></td></tr>`});
  document.getElementById('cli-rk').innerHTML=ch+'</tbody></table>';

  // SSS marca EXATO usando V26 segmentada — comparar APENAS clientes que existem em V26 (apple-to-apple)
  const dataNoMarca=D.filter(r=>(F.uf==='ALL'||r.uf===F.uf)&&(F.r==='ALL'||r.rp===F.r)&&(F.g==='ALL'||r.g===F.g)&&(F.fx==='ALL'||r.fx===F.fx)&&(F.li==='ALL'||r.l===F.li));
  const cliInRecorte=new Set(dataNoMarca.map(r=>r.c));
  // Apenas clientes RECORRENTES (que estão em V26M)
  const cliRec=new Set([...cliInRecorte].filter(c=>V26M[c]));
  const MARCAS_SSS=['KIKI','MENINA ANJO','VALENT'];
  const sssDynamic=MARCAS_SSS.map(m=>{
    let f26=0,f27=0;
    cliRec.forEach(c=>{if(V26M[c]&&V26M[c][m])f26+=V26M[c][m]});
    dataNoMarca.filter(r=>r.m===m&&cliRec.has(r.c)).forEach(r=>{f27+=r.f});
    const varP=f26?((f27-f26)/f26*100):0;
    return {DESC_MARCA:m,fat26:f26,fat27:f27,var:+varP.toFixed(1)};
  });
  let sh='<table class="m"><thead><tr><th>Marca</th><th class="r">V26 real</th><th class="r">V27 dos recorrentes</th><th class="r">Var %</th></tr></thead><tbody>';
  sssDynamic.forEach(s=>{const cl=s.var>0?'vu':'vd';sh+=`<tr><td><span class="pill pl-${mcls(s.DESC_MARCA)}">${s.DESC_MARCA}</span></td><td class="money">${num(Math.round(s.fat26/80))}</td><td class="money"><b>${num(Math.round(s.fat27/80))}</b></td><td class="num ${cl}"><b>${s.var>=0?'+':''}${s.var}%</b></td></tr>`});
  
  var shQ='<table class="m"><thead><tr><th>Marca</th><th class="r">V26 est (peças)</th><th class="r">V27 (peças)</th><th class="r">SSS Peças</th></tr></thead><tbody>';
  ['KIKI','MENINA ANJO','VALENT'].forEach(function(m){
    var q26=0;cliRec.forEach(function(c){if(V26M[c]&&V26M[c][m])q26+=V26M[c][m]/(PM_MK[m]||80)});
    var q27=dataNoMarca.filter(function(r){return r.m===m&&cliRec.has(r.c)}).reduce(function(s,r){return s+r.q},0);
    var sQ=q26?(q27-q26)/q26*100:0;var cl2=sQ>=0?'vu':'vd';
    shQ+='<tr><td><span class="pill pl-'+mcls(m)+'">'+m+'</span></td><td class="num">'+num(Math.round(q26))+'</td><td class="num"><b>'+num(q27)+'</b></td><td class="num '+cl2+'"><b>'+(sQ>=0?'+':'')+sQ.toFixed(1)+'%</b></td></tr>';
  });
  document.getElementById('sss-mca').innerHTML=shQ+'</tbody></table>';


  // SSS POR MARCA × LINHA
  const mlData={};
  const LINHAS_ORD=['BEBE','PRIMEIROS PASSOS','INFANTIL','TEEN'];
  const MARCAS_ORD=['KIKI','MENINA ANJO','VALENT'];
  // V27 por marca × linha (dos recorrentes)
  const cliRecSet=new Set(clisRec);
  MARCAS_ORD.forEach(m=>{mlData[m]={sss:0,f26:0,f27:0,linhas:{}};
    let f26m=0;cliRecSet.forEach(c=>{if(V26M[c]&&V26M[c][m])f26m+=V26M[c][m]});
    let f27m=0;
    LINHAS_ORD.forEach(l=>{
      const fl=dataMacro.filter(r=>r.m===m&&r.l===l&&cliRecSet.has(r.c)).reduce((s,r)=>s+r.f,0);
      mlData[m].linhas[l]=fl;f27m+=fl;
    });
    mlData[m].f26=f26m;mlData[m].f27=f27m;
    mlData[m].sss=f26m?(f27m-f26m)/f26m*100:0;
  });
  // Totais por linha (todas as marcas)
  const linhaTotals={};
  LINHAS_ORD.forEach(l=>{
    linhaTotals[l]=MARCAS_ORD.reduce((s,m)=>s+(mlData[m].linhas[l]||0),0);
  });
  const f27RecTotal=MARCAS_ORD.reduce((s,m)=>s+mlData[m].f27,0)||1;
  // Render tabela
  let mlH='<table class="m"><thead><tr><th>Marca</th><th class="r">Pç V26 est</th><th class="r">V27 total</th><th class="r">SSS YoY</th>';
  LINHAS_ORD.forEach(l=>{mlH+='<th class="r">'+l+'</th>'});
  mlH+='</tr></thead><tbody>';
  MARCAS_ORD.forEach(m=>{
    const d=mlData[m];const cl=d.sss>=0?'vu':'vd';
    mlH+='<tr><td><span class="pill pl-'+mcls(m)+'">'+m+'</span></td>';
    mlH+='<td class="num">'+num(Math.round(d.f26/80))+' pç</td>';
    mlH+='<td class="num"><b>'+num(Math.round(d.f27/80))+' pç</b></td>';
    mlH+='<td class="num '+cl+'"><b>'+(d.sss>=0?'+':'')+d.sss.toFixed(1)+'%</b></td>';
    LINHAS_ORD.forEach(l=>{
      const v=d.linhas[l]||0;
      const pct=d.f27?v/d.f27*100:0;
      mlH+='<td class="money">'+(v>0?num(Math.round(v/80))+' pç<br><span style="font-size:.6rem;color:#8a7e72">'+pct.toFixed(0)+'%</span>':'<span style="font-size:.6rem;color:#c9a080">—</span>')+'</td>';
    });
    mlH+='</tr>';
  });
  // Linha totais
  mlH+='<tr style="font-weight:600;background:#f5f0eb"><td>TOTAL</td>';
  const f26Tot=MARCAS_ORD.reduce((s,m)=>s+mlData[m].f26,0);
  const f27Tot2=MARCAS_ORD.reduce((s,m)=>s+mlData[m].f27,0);
  const sssTot=f26Tot?(f27Tot2-f26Tot)/f26Tot*100:0;
  const clTot=sssTot>=0?'vu':'vd';
  mlH+='<td class="num">'+num(Math.round(f26Tot/80))+' pç</td><td class="num"><b>'+num(Math.round(f27Tot2/80))+' pç</b></td>';
  mlH+='<td class="num '+clTot+'"><b>'+(sssTot>=0?'+':'')+sssTot.toFixed(1)+'%</b></td>';
  LINHAS_ORD.forEach(l=>{
    const v=linhaTotals[l]||0;const pct=f27Tot2?v/f27Tot2*100:0;
    mlH+='<td class="num"><b>'+num(Math.round(v/80))+' pç</b><br><span style="font-size:.6rem;color:#8a7e72">'+pct.toFixed(0)+'%</span></td>';
  });
  mlH+='</tr></tbody></table>';
  const mlEl=document.getElementById('sss-marca-linha');
  
  var mlQ='<table class="m"><thead><tr><th>Marca</th><th class="r">V26 pç (est)</th><th class="r">V27 pç</th><th class="r">SSS Peças</th>';
  LINHAS_ORD.forEach(function(l){mlQ+='<th class="r">'+l+'</th>'});
  mlQ+='</tr></thead><tbody>';
  MARCAS_ORD.forEach(function(m){
    var q26m=0;cliRecSet.forEach(function(c){if(V26M[c]&&V26M[c][m])q26m+=V26M[c][m]/(PM_MK[m]||80)});
    var q27m=0;var lqs={};
    LINHAS_ORD.forEach(function(l){var q=dataMacro.filter(function(r){return r.m===m&&r.l===l&&cliRecSet.has(r.c)}).reduce(function(s,r){return s+r.q},0);lqs[l]=q;q27m+=q});
    var sQ=q26m?(q27m-q26m)/q26m*100:0;var cl3=sQ>=0?'vu':'vd';
    mlQ+='<tr><td><span class="pill pl-'+mcls(m)+'">'+m+'</span></td>';
    mlQ+='<td class="num">'+num(Math.round(q26m))+'</td><td class="num"><b>'+num(q27m)+'</b></td>';
    mlQ+='<td class="num '+cl3+'"><b>'+(sQ>=0?'+':'')+sQ.toFixed(1)+'%</b></td>';
    LINHAS_ORD.forEach(function(l){var q=lqs[l]||0;mlQ+='<td class="num">'+(q>0?num(q)+'<br><span style="font-size:.6rem;color:#8a7e72">'+(q27m?q/q27m*100:0).toFixed(0)+'%</span>':'<span style="font-size:.6rem;color:#c9a080">—</span>')+'</td>'});
    mlQ+='</tr>'});
  if(mlEl)mlEl.innerHTML=mlQ+'</tbody></table>';


  // SSS POR LINHA (BEBE / PP / INFANTIL / TEEN)
  const linhaSSS={};
  LINHAS_ORD.forEach(l=>{
    // Clientes recorrentes que compraram essa linha
    const cliLinha=new Set();
    dataMacro.filter(r=>r.l===l&&cliRecSet.has(r.c)).forEach(r=>cliLinha.add(r.c));
    if(!cliLinha.size){linhaSSS[l]={f27:0,f26est:0,sss:0,cli:0,marcas:{}};return;}
    // V27 desses cli nessa linha
    const f27l=dataMacro.filter(r=>r.l===l&&cliLinha.has(r.c)&&(F.m==='ALL'||r.m===F.m)).reduce((s,r)=>s+r.f,0);
    // V27 TOTAL desses cli
    const f27tot=dataMacro.filter(r=>cliLinha.has(r.c)&&(F.m==='ALL'||r.m===F.m)).reduce((s,r)=>s+r.f,0)||1;
    // V26 total desses cli
    let f26tot=0;cliLinha.forEach(c=>{
      if(F.m!=='ALL')f26tot+=(V26M[c]&&V26M[c][F.m])||0;
      else if(V26M[c])f26tot+=Object.values(V26M[c]).reduce((s,v)=>s+v,0);
    });
    const peso=f27l/f27tot;
    const f26est=f26tot*peso;
    const sss=f26est?(f27l-f26est)/f26est*100:0;
    // Marcas dentro da linha
    const marcas={};
    dataMacro.filter(r=>r.l===l&&cliLinha.has(r.c)).forEach(r=>{marcas[r.m]=(marcas[r.m]||0)+r.f});
    linhaSSS[l]={f27:f27l,f26est:f26est,sss:sss,cli:cliLinha.size,marcas:marcas};
  });
  // Render cards + tabela
  let lsH='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0">';
  LINHAS_ORD.forEach(l=>{
    const d=linhaSSS[l];if(!d||!d.cli)return;
    const cl=d.sss>=0?'#4a8b5a':'#c94a2a';
    const bgcl=d.sss>=0?'#4a8b5a08':'#c94a2a08';
    const brcl=d.sss>=0?'#4a8b5a40':'#c94a2a40';
    lsH+='<div style="padding:16px;border:1.5px solid '+brcl+';border-radius:10px;background:'+bgcl+';text-align:center">';
    lsH+='<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.8px;color:#5a5047;font-weight:600;margin-bottom:8px">'+l+'</div>';
    lsH+='<div style="font-family:Fraunces,serif;font-size:1.6rem;font-weight:700;color:'+cl+'">'+(d.sss>=0?'+':'')+d.sss.toFixed(1)+'%</div>';
    lsH+='<div style="font-size:.72rem;color:#5a5047;margin-top:4px">'+num(Math.round(d.f27/80))+' pç</div>';
    lsH+='<div style="font-size:.6rem;color:#8a7e72;margin-top:2px">'+d.cli+' clientes</div>';
    // Mini barras de marca
    const mTot=Object.values(d.marcas).reduce((s,v)=>s+v,0)||1;
    lsH+='<div style="display:flex;gap:2px;margin-top:8px;height:6px;border-radius:3px;overflow:hidden">';
    if(d.marcas['KIKI'])lsH+='<div style="width:'+(d.marcas['KIKI']/mTot*100)+'%;background:#a08366"></div>';
    if(d.marcas['MENINA ANJO'])lsH+='<div style="width:'+(d.marcas['MENINA ANJO']/mTot*100)+'%;background:#8b6a8a"></div>';
    if(d.marcas['VALENT'])lsH+='<div style="width:'+(d.marcas['VALENT']/mTot*100)+'%;background:#4a8b5a"></div>';
    lsH+='</div>';
    // Legenda marcas
    lsH+='<div style="font-size:.5rem;color:#8a7e72;margin-top:4px;text-align:left">';
    ['KIKI','MENINA ANJO','VALENT'].forEach(m=>{
      if(d.marcas[m]){const co=m==='KIKI'?'#a08366':m==='MENINA ANJO'?'#8b6a8a':'#4a8b5a';
      lsH+='<span style="color:'+co+'">● '+m+' '+(d.marcas[m]/mTot*100).toFixed(0)+'%</span> ';}
    });
    lsH+='</div></div>';
  });
  lsH+='</div>';
  const lsEl=document.getElementById('sss-linha');
  
  var lsQ='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0">';
  LINHAS_ORD.forEach(function(l){
    var d3=linhaSSS[l];if(!d3||!d3.cli)return;
    var qL=dataMacro.filter(function(r){return r.l===l&&cliRecSet.has(r.c)}).reduce(function(s,r){return s+r.q},0);
    // Estimar V26 peças dessa linha: proporção do V27 peças × V26 peças total estimado
    var qTotLinha=dataMacro.filter(function(r){return cliRecSet.has(r.c)}).reduce(function(s,r){return s+r.q},0)||1;
    var pesoL=qL/qTotLinha;
    var q26TotEst=0;cliRecSet.forEach(function(c){if(V26M[c])Object.entries(V26M[c]).forEach(function(e){q26TotEst+=e[1]/(PM_MK[e[0]]||80)})});
    var q26Est=q26TotEst*pesoL;
    var sssL=q26Est?(qL-q26Est)/q26Est*100:0;
    var clL=sssL>=0?'#4a8b5a':'#c94a2a';var bgL=sssL>=0?'#4a8b5a08':'#c94a2a08';var brL=sssL>=0?'#4a8b5a40':'#c94a2a40';
    var mTot3=Object.values(d3.marcas).reduce(function(s,v){return s+v},0)||1;
    lsQ+='<div style="padding:16px;border:1.5px solid '+brL+';border-radius:10px;background:'+bgL+';text-align:center">';
    lsQ+='<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.8px;color:#5a5047;font-weight:600;margin-bottom:8px">'+l+'</div>';
    lsQ+='<div style="font-family:Fraunces,serif;font-size:1.6rem;font-weight:700;color:'+clL+'">'+(sssL>=0?'+':'')+sssL.toFixed(1)+'%</div>';
    lsQ+='<div style="font-size:.72rem;color:#5a5047;margin-top:4px">'+num(qL)+' peças</div>';
    lsQ+='<div style="font-size:.6rem;color:#8a7e72;margin-top:2px">'+d3.cli+' clientes</div>';
    lsQ+='<div style="display:flex;gap:2px;margin-top:8px;height:6px;border-radius:3px;overflow:hidden">';
    if(d3.marcas['KIKI'])lsQ+='<div style="width:'+(d3.marcas['KIKI']/mTot3*100)+'%;background:#a08366"></div>';
    if(d3.marcas['MENINA ANJO'])lsQ+='<div style="width:'+(d3.marcas['MENINA ANJO']/mTot3*100)+'%;background:#8b6a8a"></div>';
    if(d3.marcas['VALENT'])lsQ+='<div style="width:'+(d3.marcas['VALENT']/mTot3*100)+'%;background:#4a8b5a"></div>';
    lsQ+='</div>';
    lsQ+='<div style="font-size:.5rem;color:#8a7e72;margin-top:4px;text-align:left">';
    ['KIKI','MENINA ANJO','VALENT'].forEach(function(m4){if(d3.marcas[m4]){var co4=m4==='KIKI'?'#a08366':m4==='MENINA ANJO'?'#8b6a8a':'#4a8b5a';lsQ+='<span style="color:'+co4+'">● '+m4+' '+(d3.marcas[m4]/mTot3*100).toFixed(0)+'%</span> '}});
    lsQ+='</div></div>'});
  lsQ+='</div>';
  if(lsEl)lsEl.innerHTML=lsQ;




  // Cidades
  const ciM={};X.forEach(r=>{const k=r.cid+'|'+r.uf;if(!ciM[k])ciM[k]={cid:r.cid,uf:r.uf,f:0,q:0,cli:new Set(),pf:{}};ciM[k].f+=r.f;ciM[k].q+=r.q;ciM[k].cli.add(r.c);ciM[k].pf[r.pf]=(ciM[k].pf[r.pf]||0)+r.f});
  const ciA=Object.values(ciM).map(c=>({...c,cli:c.cli.size,pfd:Object.entries(c.pf).sort((a,b)=>b[1]-a[1])[0][0]})).sort((a,b)=>b.f-a.f).slice(0,15);
  let dh='<table class="m"><thead><tr><th>#</th><th>Cidade</th><th>UF</th><th>Perfil dom.</th><th class="r">Cli</th><th class="r">Pç</th><th class="r">Fat</th></tr></thead><tbody>';
  ciA.forEach((c,i)=>{dh+=`<tr><td class="rk">#${i+1}</td><td><b>${c.cid}</b></td><td>${c.uf}</td><td><span class="ppill cl-${pcX(c.pfd)}">${c.pfd}</span></td><td class="num">${c.cli}</td><td class="num">${num(c.q)}</td><td class="num"><b>${num(c.q)} pç</b></td></tr>`});
  document.getElementById('cid-rk').innerHTML=dh+'</tbody></table>';

  // CITY PROFILE PERFORMANCE - novo!
  const allCiA=Object.values(ciM).map(c=>({...c,cli:c.cli.size,pfd:Object.entries(c.pf).sort((a,b)=>b[1]-a[1])[0][0]}));
  const cpM={};allCiA.forEach(c=>{if(!cpM[c.pfd])cpM[c.pfd]={cities:0,cli:0,f:0,q:0};cpM[c.pfd].cities++;cpM[c.pfd].cli+=c.cli;cpM[c.pfd].f+=c.f;cpM[c.pfd].q+=c.q});
  const cpT=Object.values(cpM).reduce((s,v)=>s+v.f,0);
  const ORD2=['VIP 3+','VIP','FREQUENTE','REGULAR','NOVO 27'];
  let cph='<div class="cpcards">';
  ORD2.filter(p=>cpM[p]).forEach(p=>{const v=cpM[p];const pct=cpT?v.f/cpT*100:0;const pm=v.q?v.f/v.q:0;cph+=`<div class="cpcard"><div class="cpttl"><span class="ppill cl-${pcX(p)}">${p}</span></div><div class="cpbig">${num(v.q)} pç</div><div class="cpsub">${pct.toFixed(1)}% das peças</div><div class="cpbar"><div style="width:${pct}%"></div></div><div class="cpstats"><div><b>${v.cities}</b><small>cidades</small></div><div><b>${v.cli}</b><small>clientes</small></div><div><b>${num(v.q)}</b><small>peças</small></div></div></div>`});
  document.getElementById('cp-cards').innerHTML=cph+'</div>';

  // Brand × City profile cross-tab
  const bxc={};X.forEach(r=>{const k=r.cid+'|'+r.uf;const cid_pf=Object.entries(ciM[k].pf).sort((a,b)=>b[1]-a[1])[0][0];const key=r.m+'|'+cid_pf;if(!bxc[key])bxc[key]={m:r.m,pf:cid_pf,f:0,q:0};bxc[key].f+=r.f;bxc[key].q+=r.q});
  const MARCAS_O=['KIKI','MENINA ANJO','VALENT'];
  let bxh='<table class="m"><thead><tr><th>Marca</th>';
  ORD2.filter(p=>cpM[p]).forEach(p=>{bxh+=`<th class="r">${p}</th>`});
  bxh+='<th class="r">Total</th></tr></thead><tbody>';
  MARCAS_O.forEach(m=>{let tot=0;let cells='';ORD2.filter(p=>cpM[p]).forEach(p=>{const v=bxc[m+'|'+p];const fv=v?v.q:0;tot+=fv;cells+=`<td class="money">${fv?num(fv)+' pç':'—'}</td>`});
    bxh+=`<tr><td><span class="pill pl-${mcls(m)}">${m}</span></td>${cells}<td class="num"><b>${num(tot)} pç</b></td></tr>`});
  bxh+='<tr style="background:#fbf7f0;font-weight:700"><td>TOTAL</td>';
  let gt=0;
  ORD2.filter(p=>cpM[p]).forEach(p=>{const v=cpM[p].q;gt+=v;bxh+=`<td class="num"><b>${num(v)} pç</b></td>`});
  bxh+=`<td class="num"><b>${num(gt)} pç</b></td></tr></tbody></table>`;
  document.getElementById('bx-cross').innerHTML=bxh;

  // FAIXA analysis
  const FX=['ENTRADA','MÉDIO','PREMIUM'];
  const fm={};FX.forEach(f=>fm[f]={f:0,q:0,ct:0,sku:new Set(),cli:new Set()});
  X.forEach(r=>{if(fm[r.fx]){fm[r.fx].f+=r.f;fm[r.fx].q+=r.q;fm[r.fx].ct+=r.ct;fm[r.fx].sku.add(r.p);fm[r.fx].cli.add(r.c)}});
  const fT=FX.reduce((s,f)=>s+fm[f].f,0);const sT=FX.reduce((s,f)=>s+fm[f].sku.size,0);
  const cds=FX.map(f=>{const x=fm[f];const pmx=x.q?x.f/x.q:0;const fp=fT?x.f/fT*100:0;const sp=sT?x.sku.size/sT*100:0;const fatPorSku=x.sku.size?x.f/x.sku.size:0;const pcsPorSku=x.sku.size?x.q/x.sku.size:0;const pcsEquiv=pmx?x.f/pmx:0;const code=f==='ENTRADA'?'ENT':f==='MÉDIO'?'MED':'PRE';return `<div class="fxc ${code}"><div class="fxs">${f}</div><div class="fxn">${num(x.q)} pç</div><div class="fxd">${fp.toFixed(1)}% das peças</div><div class="fxbar"><div style="width:${fp}%"></div></div><div class="fxstats"><div><b>${x.sku.size}</b><small>SKUs (${sp.toFixed(0)}%)</small></div><div><b>${num(x.q)}</b><small>peças</small></div><div><b>${x.cli.size}</b><small>clientes</small></div><div><b>${brl(pmx)}</b><small>PM unitário</small></div></div><div class="fxprod"><div class="fxprod-row"><span>Peças por SKU</span><b>${(x.q/x.skus).toFixed(1)}</b></div><div class="fxprod-row"><span>Peças vendidas por SKU</span><b>${pcsPorSku.toFixed(1)}</b></div><div class="fxprod-row"><span>Peças equivalentes (Fat÷PM)</span><b>${num(Math.round(pcsEquiv))}</b></div></div></div>`}).join('');
  document.getElementById('fx-cards').innerHTML=`<div class="fxgrid">${cds}</div>`;

  let fxh='<table class="m"><thead><tr><th>Faixa</th><th class="r">SKUs</th><th class="r">% Mix</th><th class="r">Peças</th><th class="r">Clientes</th><th class="r">PM unitário</th><th class="r">Fat / SKU</th><th class="r">Peças / SKU</th><th class="r">Peças equiv</th><th class="r">Peças</th><th class="r">% Total</th><th class="r">Eficiência</th></tr></thead><tbody>';
  FX.forEach(f=>{const x=fm[f];const pmx=x.q?x.f/x.q:0;const fp=fT?x.f/fT*100:0;const sp=sT?x.sku.size/sT*100:0;const ef=sp?fp/sp:0;const ec=ef>1.2?'vu':ef<0.8?'vd':'ve';const fatPorSku=x.sku.size?x.f/x.sku.size:0;const pcsPorSku=x.sku.size?x.q/x.sku.size:0;const pcsEquiv=pmx?x.f/pmx:0;fxh+=`<tr><td><span class="fxp fxp-${fxcls(f)}">${f}</span></td><td class="num">${x.sku.size}</td><td class="num">${sp.toFixed(0)}%</td><td class="num">${num(x.q)}</td><td class="num">${x.cli.size}</td><td class="money">${brl(pmx)}</td><td class="num"><b>${(x.q/x.skus).toFixed(1)} pç</b></td><td class="num"><b>${pcsPorSku.toFixed(1)}</b></td><td class="num"><b>${num(Math.round(pcsEquiv))}</b></td><td class="num"><b>${num(x.q)} pç</b></td><td class="num">${fp.toFixed(1)}%</td><td class="num ${ec}"><b>${ef.toFixed(2)}×</b></td></tr>`});
  document.getElementById('fx-table').innerHTML=fxh+'</tbody></table>';

  // SKU aggregation
  const sm={};X.forEach(r=>{if(!sm[r.p])sm[r.p]={p:r.p,dp:r.dp,m:r.m,l:r.l,co:r.co,g:r.g,fx:r.fx,q:0,f:0,cu:r.cu,cli:new Set(),est:r.est||''};sm[r.p].q+=r.q;sm[r.p].f+=r.f;sm[r.p].cli.add(r.c)});
  const sA=Object.values(sm).map(s=>({...s,cli:s.cli.size,pm:s.f/s.q,mg:((s.f/s.q-s.cu)/(s.f/s.q)*100)})).sort((a,b)=>b.f-a.f);
  const tot=sA.reduce((s,r)=>s+r.f,0);let ac=0;sA.forEach((r,i)=>{r.rk=i+1;ac+=r.f;r.ABC=tot?((ac/tot*100)<=80?'A':(ac/tot*100)<=95?'B':'C'):'C'});
  const ab={A:{n:0,f:0},B:{n:0,f:0},C:{n:0,f:0}};sA.forEach(r=>{ab[r.ABC].n++;ab[r.ABC].f+=r.f});
  let abh='<div style="display:flex;gap:10px">';['A','B','C'].forEach(k=>{const c={A:'#c94a2a',B:'#d4a574',C:'#8a7f74'}[k];const pct=tot?(ab[k].f/tot*100).toFixed(1):'0.0';abh+=`<div style="flex:${ab[k].f||1};border-radius:8px;overflow:hidden;min-width:140px;box-shadow:0 2px 6px rgba(0,0,0,.06)"><div style="background:${c};color:#fff;padding:8px 12px;font-weight:700">Classe ${k} · ${pct}%</div><div style="background:#fff;padding:10px 12px;font-size:.82rem"><b style="color:#8b4a3a">${ab[k].n} SKUs</b><br>${num(ab[k].q)} pç</div></div>`});
  document.getElementById('abc').innerHTML=abh+'</div>';

  // === STRATEGIC EXECUTIVE SUMMARY (usando sA já computado) ===
  const totFat2=sA.reduce((s,r)=>s+r.f,0);
  const topA=sA.filter(r=>r.ABC==='A'),topAPct=totFat2?topA.reduce((s,r)=>s+r.f,0)/totFat2*100:0;
  const mkSh2={};X.forEach(r=>{mkSh2[r.m]=(mkSh2[r.m]||0)+r.f});
  const mkE=Object.entries(mkSh2).sort((a,b)=>b[1]-a[1]);const mkTop=mkE.length?mkE[0]:['—',0];
  const fxShare={};X.forEach(r=>{if(r.fx!=='SEM CADASTRO')fxShare[r.fx]=(fxShare[r.fx]||0)+r.f});
  const fxTot2=Object.values(fxShare).reduce((s,v)=>s+v,0)||1;
  const fxPct={ENTRADA:(fxShare.ENTRADA||0)/fxTot2*100,'MÉDIO':(fxShare['MÉDIO']||0)/fxTot2*100,PREMIUM:(fxShare.PREMIUM||0)/fxTot2*100};
  const lowMg=sA.filter(r=>r.mg<35&&r.q>=15).length,highMg=sA.filter(r=>r.mg>=65&&r.q>=15).length;
  const mgGlobal=fat?(fat-ct)/fat*100:0;
  const skuA=topA.length,skuTot_=sA.length||1;
  const premSKU=sA.filter(r=>r.fx==='PREMIUM').length;
  const premShare=premSKU/skuTot_*100;
  const stSum=document.getElementById('strat-summary');
  if(stSum){stSum.innerHTML=`<div class="strat-grid"><div class="strat-hero"><div class="sh-big">${num(X.reduce((s,r)=>s+r.q,0))}</div><div class="sh-sub">peças V27 do recorte · <b>${skuTot_} SKUs</b> ativos</div><div class="sh-split"><div class="sh-bar"><div class="sh-lbl">PREMIUM</div><div class="sh-bbox"><div class="sh-fill sh-pre" style="width:${fxPct.PREMIUM}%"></div></div><div class="sh-pct">${fxPct.PREMIUM.toFixed(0)}%</div></div><div class="sh-bar"><div class="sh-lbl">MÉDIO</div><div class="sh-bbox"><div class="sh-fill sh-med" style="width:${fxPct['MÉDIO']}%"></div></div><div class="sh-pct">${fxPct['MÉDIO'].toFixed(0)}%</div></div><div class="sh-bar"><div class="sh-lbl">ENTRADA</div><div class="sh-bbox"><div class="sh-fill sh-ent" style="width:${fxPct.ENTRADA}%"></div></div><div class="sh-pct">${fxPct.ENTRADA.toFixed(0)}%</div></div></div></div><div class="strat-actions"><div class="sa-hd">DIREÇÃO ESTRATÉGICA</div><div class="sa-item ok"><div><b>CONCENTRAÇÃO ABC</b><br><span>${skuA} SKUs Classe A (${(skuA/skuTot_*100).toFixed(0)}% do mix) sustentam ${topAPct.toFixed(0)}% das peças. Priorizar reposição desses itens.</span></div></div><div class="sa-item ${premShare<25?'alert':premShare>40?'ok':''}"><div><b>ARQUITETURA DE PREÇO</b><br><span>Premium = ${fxPct.PREMIUM.toFixed(0)}% do fat · ${premSKU} SKUs (${premShare.toFixed(0)}% do mix). ${premShare<25?'Ampliar linha premium.':fxPct.PREMIUM>50?'Reforçar entrada.':'Balanceado.'}</span></div></div><div class="sa-item ok"><div><b>MARCA LÍDER: ${mkTop[0]}</b><br><span>${totFat2?(mkTop[1]/totFat2*100).toFixed(0):0}% das peças do recorte.</span></div></div><div class="sa-item"><div><b>COBERTURA</b><br><span>${sA.filter(r=>r.cli>=6&&r.q/r.cli<=4).length} SKUs com alta cobertura e baixa profundidade — candidatos a aprofundar grade.</span></div></div></div></div>`;}

  
  // RANK POR ESTADO YoY (V26 vs V27 dos clientes recorrentes)
  const ufYoYData=UFYOY||[];
  let ufY='<table class="m"><thead><tr><th>#</th><th>UF</th><th class="r">Clientes rec.</th><th class="r">Pç V26 est</th><th class="r">Pç V27</th><th class="r">Δ pç</th><th class="r">SSS YoY</th><th class="r">Representatividade V27</th></tr></thead><tbody>';
  const totV27=ufYoYData.reduce((s,r)=>s+r.V27,0)||1;
  ufYoYData.forEach((r,i)=>{
    const vCl=r.SSS>=20?'vu':r.SSS>=0?'ve':r.SSS>=-20?'vw':'vd';
    const delta=r.V27-r.V26;
    const rep=r.V27/totV27*100;
    ufY+=`<tr><td class="rk">#${i+1}</td><td><b>${r.UF}</b></td><td class="num">${r.cli}</td><td class="money">${num(Math.round(r.V26/80))}</td><td class="money"><b>${num(Math.round(r.V27/80))}</b></td><td class="money ${delta>=0?'vu':'vd'}"><b>${delta>=0?'+':''}${num(Math.round(delta/80))}</b></td><td class="num ${vCl}"><b>${r.SSS>=0?'+':''}${r.SSS.toFixed(1)}%</b></td><td class="num">${rep.toFixed(1)}%</td></tr>`;
  });
  const elUfY=document.getElementById('uf-yoy');
  var ufPc={};X.forEach(function(r){if(!ufPc[r.uf])ufPc[r.uf]={q:0,cli:new Set()};ufPc[r.uf].q+=r.q;ufPc[r.uf].cli.add(r.c)});
  var ufPcTot=Object.values(ufPc).reduce(function(s,v){return s+v.q},0)||1;
  var ufPcH='<table class="m"><thead><tr><th>#</th><th>UF</th><th class="r">Clientes</th><th class="r">Peças</th><th class="r">% Total</th></tr></thead><tbody>';
  Object.entries(ufPc).sort(function(a,b){return b[1].q-a[1].q}).forEach(function(e,i){ufPcH+='<tr><td class="rk">#'+(i+1)+'</td><td><b>'+e[0]+'</b></td><td class="num">'+e[1].cli.size+'</td><td class="num"><b>'+num(e[1].q)+'</b></td><td class="num">'+(e[1].q/ufPcTot*100).toFixed(1)+'%</td></tr>'});
  if(elUfY)elUfY.innerHTML=ufPcH+'</tbody></table>';
  if(false)elUfY.innerHTML=ufY+'</tbody></table>';

  // UF rank
  const uR={};const aUF=[...new Set(D.map(r=>r.uf))];
  aUF.forEach(uf=>{const uf2={};X.filter(r=>r.uf===uf).forEach(r=>uf2[r.p]=(uf2[r.p]||0)+r.f);const o=Object.entries(uf2).sort((a,b)=>b[1]-a[1]);uR[uf]={};o.forEach((e,i)=>uR[uf][e[0]]=i+1)});
  const chips=(p,n)=>{const a=[];Object.entries(uR).forEach(([u,m])=>{if(m[p])a.push([u,m[p]])});a.sort((x,y)=>x[1]-y[1]);return a.slice(0,5).map(([u,r])=>{const d=n-r;const c=d>=10?'#4a8b5a':Math.abs(d)<10?'#a08366':'#c94a2a';return `<span style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:.6rem;font-weight:700;color:#fff;background:${c};margin-right:2px">${u}#${r}</span>`}).join('')};
  
  // FAIXAS GRANULARES DE PREÇO (ticket médio por SKU do recorte)
  const BINS=[[0,50,'00-50'],[50,60,'50-60'],[60,70,'60-70'],[70,80,'70-80'],[80,90,'80-90'],[90,100,'90-100'],[100,110,'100-110'],[110,120,'110-120'],[120,130,'120-130'],[130,140,'130-140'],[140,150,'140-150'],[150,160,'150-160'],[160,170,'160-170'],[170,99999,'170+']];
  const pmSku={};
  X.forEach(r=>{if(!pmSku[r.p])pmSku[r.p]={f:0,q:0};pmSku[r.p].f+=r.f;pmSku[r.p].q+=r.q});
  const faixaAgg={};
  BINS.forEach(b=>{faixaAgg[b[2]]={skus:0,fat:0,qtd:0}});
  Object.values(pmSku).forEach(s=>{
    const pm=s.q?s.f/s.q:0;
    for(const b of BINS){if(pm>=b[0]&&pm<b[1]){faixaAgg[b[2]].skus++;faixaAgg[b[2]].fat+=s.f;faixaAgg[b[2]].qtd+=s.q;break}}
  });
  const fgFat=Object.values(faixaAgg).reduce((s,x)=>s+x.fat,0)||1;
  const fgSkus=Object.values(faixaAgg).reduce((s,x)=>s+x.skus,0)||1;
  const fgQtd=Object.values(faixaAgg).reduce((s,x)=>s+x.qtd,0)||1;
  let fgH='<table class="m"><thead><tr><th>Faixa PM</th><th class="r">SKUs</th><th class="r">% SKUs</th><th class="r">Peças</th><th class="r">% Qtd</th><th class="r">Pç/SKU</th><th class="r">Pç/SKU</th><th class="r">Peças</th><th class="r">% Peças</th></tr></thead><tbody>';
  BINS.forEach(b=>{
    const x=faixaAgg[b[2]];if(x.skus===0)return;
    const fps=x.skus?x.fat/x.skus:0;
    const pps=x.skus?x.qtd/x.skus:0;
    const fpct=x.fat/fgFat*100;
    const spct=x.skus/fgSkus*100;
    const qpct=x.qtd/fgQtd*100;
    fgH+=`<tr><td><b>R$ ${b[2]}</b></td><td class="num">${x.skus}</td><td class="num">${spct.toFixed(1)}%</td><td class="num">${num(x.qtd)}</td><td class="num">${qpct.toFixed(1)}%</td><td class="num">${(x.qtd/x.skus).toFixed(1)}</td><td class="num">${pps.toFixed(1)}</td><td class="num"><b>${num(x.qtd)} pç</b></td><td class="num">${fpct.toFixed(1)}%</td></tr>`;
  });
  const elFg=document.getElementById('faixas-granular');
  var fgPcH='<table class="m"><thead><tr><th>Faixa PM</th><th class="r">SKUs</th><th class="r">% SKUs</th><th class="r">Peças</th><th class="r">% Peças</th><th class="r">Pç/SKU</th></tr></thead><tbody>';
  BINS.forEach(function(b){var x=faixaAgg[b[2]];if(x.skus===0)return;var pps=x.skus?x.qtd/x.skus:0;var spct=x.skus/fgSkus*100;var qpct=x.qtd/fgQtd*100;
  fgPcH+='<tr><td><b>R$ '+b[2]+'</b></td><td class="num">'+x.skus+'</td><td class="num">'+spct.toFixed(1)+'%</td><td class="num"><b>'+num(x.qtd)+'</b></td><td class="num">'+qpct.toFixed(1)+'%</td><td class="num">'+pps.toFixed(1)+'</td></tr>'});
  if(elFg)elFg.innerHTML=fgPcH+'</tbody></table>';
  if(false)elFg.innerHTML=fgH+'</tbody></table>';

  // SSS POR PERFIL DE CIDADE (IBGE)
  const cidPerf={};
  X.forEach(r=>{const p=CIDADE_PERFIL[r.cid]||{perfil:'Micro'};cidPerf[r.c]=p.perfil});
  const cpAgg={};
  ['Metrópole','Grande','Média','Pequena','Micro'].forEach(p=>cpAgg[p]={cli:new Set(),V26:0,V27:0,cid:new Set()});
  X.forEach(r=>{
    const p=cidPerf[r.c]||'Micro';
    if(!cpAgg[p])return;
    cpAgg[p].cli.add(r.c);
    cpAgg[p].cid.add(r.cid);
    cpAgg[p].V27+=r.f;
    if(V26M[r.c]){
      if(!cpAgg[p]._seen)cpAgg[p]._seen=new Set();
      if(!cpAgg[p]._seen.has(r.c)){
        cpAgg[p]._seen.add(r.c);
        cpAgg[p].V26+=(F.m!=='ALL'?(V26M[r.c][F.m]||0):Object.values(V26M[r.c]).reduce((s,v)=>s+v,0));
      }
    }
  });
  let cpH='<table class="m"><thead><tr><th>Perfil IBGE</th><th class="r">Cidades</th><th class="r">Clientes</th><th class="r">V26 recorr.</th><th class="r">V27 total</th><th class="r">V27 recorr.</th><th class="r">SSS YoY</th><th class="r">Rep V27</th></tr></thead><tbody>';
  const cpTot=Object.values(cpAgg).reduce((s,x)=>s+x.V27,0)||1;
  ['Metrópole','Grande','Média','Pequena','Micro'].forEach(p=>{
    const x=cpAgg[p];if(x.cli.size===0)return;
    const v27rec=x._seen?[...x._seen].reduce((s,c)=>{let v=0;X.filter(r=>r.c===c).forEach(r=>v+=r.f);return s+v},0):0;
    const sss=x.V26?(v27rec-x.V26)/x.V26*100:0;
    const rep=x.V27/cpTot*100;
    const sCl=sss>=20?'vu':sss>=0?'ve':sss>=-20?'vw':'vd';
    cpH+=`<tr><td><b>${p}</b></td><td class="num">${x.cid.size}</td><td class="num">${x.cli.size}</td><td class="money">${num(Math.round(x.V26/80))}</td><td class="money"><b>${num(Math.round(x.V27/80))}</b></td><td class="money">${num(Math.round(v27rec/80))}</td><td class="num ${sCl}"><b>${sss>=0?'+':''}${sss.toFixed(1)}%</b></td><td class="num">${rep.toFixed(1)}%</td></tr>`;
  });
  const elCp=document.getElementById('cid-perfil-ibge');
  var cpPc={};
  ['Metrópole','Grande','Média','Pequena','Micro'].forEach(function(p2){cpPc[p2]={cli:new Set(),q:0,cid:new Set()}});
  X.forEach(function(r){var p2=(CIDADE_PERFIL[r.cid]||{perfil:'Micro'}).perfil;if(cpPc[p2]){cpPc[p2].cli.add(r.c);cpPc[p2].q+=r.q;cpPc[p2].cid.add(r.cid)}});
  var cpPcTot=Object.values(cpPc).reduce(function(s,v){return s+v.q},0)||1;
  var cpPcH='<table class="m"><thead><tr><th>Perfil IBGE</th><th class="r">Cidades</th><th class="r">Clientes</th><th class="r">Peças</th><th class="r">% Peças</th></tr></thead><tbody>';
  ['Metrópole','Grande','Média','Pequena','Micro'].forEach(function(p2){var v=cpPc[p2];if(!v.cli.size)return;cpPcH+='<tr><td><b>'+p2+'</b></td><td class="num">'+v.cid.size+'</td><td class="num">'+v.cli.size+'</td><td class="num"><b>'+num(v.q)+'</b></td><td class="num">'+(v.q/cpPcTot*100).toFixed(1)+'%</td></tr>'});
  if(elCp)elCp.innerHTML=cpPcH+'</tbody></table>';
  if(false)elCp.innerHTML=cpH+'</tbody></table>';

  // MOODBOARD - visual grid para time de produto - ORDENADO POR PEÇAS VENDIDAS
  // (sA mantém ordem por peças para curva ABC; clone só para o moodboard)
  // Total clientes únicos no recorte filtrado para % cobertura
  const totCliRecorte=new Set(X.map(r=>r.c)).size||1;
  const moodSorted=[...sA].sort((a,b)=>b.q-a.q);
  let mbh='<div class="moodboard">';
  moodSorted.slice(0,30).forEach((r,i)=>{
    const cp=r.co&&r.co!=='SEM COORDENADO'?r.co:'';
    const imgHtml=IMG[r.p]?`<img src="data:image/jpeg;base64,${IMG[r.p]}" class="mb-img">`:`<div class="mb-img mb-ph"></div>`;
    const ufs=[];Object.entries(uR).forEach(([u,m])=>{if(m[r.p])ufs.push([u,m[r.p]])});ufs.sort((a,b)=>a[1]-b[1]);
    const chipsHtml=ufs.slice(0,3).map(([u,rk])=>{const d=r.rk-rk;const cls=d>=10?'rk-up':Math.abs(d)<10?'rk-eq':'rk-dn';return `<span class="mb-chip ${cls}">${u} #${rk}</span>`}).join('');
    const cob=r.cli/totCliRecorte*100;
    const cobCls=cob>=50?'cob-h':cob>=25?'cob-m':'cob-l';
    mbh+=`<div class="mb-card">
<div class="mb-thumb">${imgHtml}<div class="mb-rank">${i+1}</div><div class="mb-abc abc-${r.ABC}">${r.ABC}</div></div>
<div class="mb-info">
<div class="mb-sku">${r.p}</div>
${r.est?`<div style="font-size:.6rem;color:#8b6a8a;font-weight:600">${r.est}</div>`:''}
<div class="mb-name">${r.dp}</div>
${cp?`<div class="mb-coord">${cp}</div>`:''}
<div class="mb-meta"><span class="pill pl-${mcls(r.m)}">${r.m}</span><span class="fxp fxp-${fxcls(r.fx)}">${r.fx}</span></div>
<div class="mb-cob ${cobCls}"><div class="mb-cob-top"><span class="mb-cob-lbl">Cobertura</span><span class="mb-cob-val">${cob.toFixed(0)}%</span></div><div class="mb-cob-bar"><div style="width:${Math.min(cob,100)}%"></div></div><div class="mb-cob-sub">${r.cli} de ${totCliRecorte} clientes</div></div>
<div class="mb-stats">
<div class="mb-stat"><span class="mb-lbl">Pç</span><b>${num(r.q)}</b></div>
<div class="mb-stat"><span class="mb-lbl">Pç/Cli</span><b>${(r.q/r.cli).toFixed(1)}</b></div>
<div class="mb-stat"><span class="mb-lbl">PM</span><b>${brl(r.pm)}</b></div>
</div>
<div class="mb-fat">${num(r.q)} pç</div>
${chipsHtml?`<div class="mb-chips">${chipsHtml}</div>`:''}
</div>
</div>`;
  });
  document.getElementById('prod').innerHTML=mbh+'</div>';

  // RANKS ADICIONAIS: Geral completo, Classe B, Classe C
  function renderRank(skus, targetId, showAbc=true){
    if(!skus.length){const el=document.getElementById(targetId);if(el)el.innerHTML='<div class="empty">Sem SKUs neste recorte</div>';return;}
    let h='<table class="t"><thead><tr><th>#</th><th>Img</th><th>SKU/Produto</th><th>Marca</th><th>Faixa</th>'+(showAbc?'<th>ABC</th>':'')+'<th class="r">Pç</th><th class="r">Cli</th><th class="r">PM</th><th class="r">Peças</th><th class="r">% Acum</th></tr></thead><tbody>';
    skus.forEach((r,i)=>{
      const cp=r.co&&r.co!=='SEM COORDENADO'?`<span class="cpill">${r.co}</span>`:'';
      h+=`<tr><td class="rk">#${i+1}</td><td>${img(r.p,38)}</td><td><div class="sku">${r.p}</div>${r.est?`<div style="font-size:.58rem;color:#8b6a8a;font-weight:600">${r.est}</div>`:''}<div class="pnm">${r.dp} ${cp}</div></td><td><span class="pill pl-${mcls(r.m)}">${r.m}</span></td><td><span class="fxp fxp-${fxcls(r.fx)}">${r.fx}</span></td>${showAbc?`<td><span class="abc abc-${r.ABC}">${r.ABC}</span></td>`:''}<td class="num">${num(r.q)}</td><td class="num">${r.cli}</td><td class="money">${brl(r.pm)}</td><td class="num"><b>${num(r.q)} pç</b></td><td class="num">${(r.acum||0).toFixed(1)}%</td></tr>`;
    });
    const el=document.getElementById(targetId);
    if(el) el.innerHTML=h+'</tbody></table>';
  }
  // Recompute acum percentage for all SKUs
  const totF=sA.reduce((s,r)=>s+r.f,0);
  let acT=0;sA.forEach(r=>{acT+=r.f;r.acum=totF?acT/totF*100:0});
  // Geral (todos)
  renderRank(sA, 'rank-all', true);
  // Classe B
  renderRank(sA.filter(r=>r.ABC==='B'), 'rank-b', false);
  // Classe C - revisar
  renderRank(sA.filter(r=>r.ABC==='C'), 'rank-c', false);
  // Update counters on headers
  const cB=sA.filter(r=>r.ABC==='B').length,cC=sA.filter(r=>r.ABC==='C').length;
  const hdB=document.getElementById('hd-b');if(hdB)hdB.textContent=`Rank Curva B · ${cB} SKUs · a serem desenvolvidos ou consolidados`;
  const hdC=document.getElementById('hd-c');if(hdC)hdC.textContent=`Rank Curva C · ${cC} SKUs · candidatos a revisão ou exclusão em V28`;
  const hdA=document.getElementById('hd-all');if(hdA)hdA.textContent=`Rank Geral Completo · ${sA.length} SKUs`;

  // Coordenados
  const coM={};X.forEach(r=>{if(!r.co||r.co==='SEM COORDENADO')return;if(!coM[r.co])coM[r.co]={co:r.co,f:0,q:0,cli:new Set(),sku:new Set()};coM[r.co].f+=r.f;coM[r.co].q+=r.q;coM[r.co].cli.add(r.c);coM[r.co].sku.add(r.p)});
  const coA=Object.values(coM).map(c=>({...c,cli:c.cli.size,sku:c.sku.size})).sort((a,b)=>b.f-a.f).slice(0,12);
  document.getElementById('coord').innerHTML=coA.map(c=>`<div class="ccc"><div class="ccn">◆ ${c.co}</div><div class="ccm"><b>${num(c.q)} pç</b> · ${c.sku}SKU · ${c.cli}cli</div></div>`).join('');

  // MIX OPTIMIZATION - novo!
  const mixG={};X.forEach(r=>{if(!mixG[r.g])mixG[r.g]={g:r.g,f:0,q:0,cli:new Set(),sku:new Set(),ct:0};mixG[r.g].f+=r.f;mixG[r.g].q+=r.q;mixG[r.g].ct+=r.ct;mixG[r.g].cli.add(r.c);mixG[r.g].sku.add(r.p)});
  const gT=Object.values(mixG).reduce((s,v)=>s+v.f,0);const skuT=Object.values(mixG).reduce((s,v)=>s+v.sku.size,0);
  const mixA=Object.values(mixG).map(g=>({...g,cli:g.cli.size,sku:g.sku.size,pm:g.q?g.f/g.q:0,mg:g.f?(g.f-g.ct)/g.f*100:0,fp:gT?g.f/gT*100:0,sp:skuT?g.sku.size/skuT*100:0})).map(g=>({...g,ef:g.sp?g.fp/g.sp:0})).sort((a,b)=>b.ef-a.ef);
  let mxh='<table class="m"><thead><tr><th>Tipo de Produto</th><th class="r">SKUs</th><th class="r">% Mix</th><th class="r">Peças</th><th class="r">Cli</th><th class="r">PM</th><th class="r">Peças</th><th class="r">% Peças</th><th class="r">Eficiência</th><th>Recomendação</th></tr></thead><tbody>';
  mixA.forEach(g=>{const ec=g.ef>1.3?'vu':g.ef<0.7?'vd':'ve';const rec=g.ef>1.3?'APROFUNDAR':g.ef<0.7?'RACIONALIZAR':'MANTER';const rcls=g.ef>1.3?'ok':g.ef<0.7?'alert':'';const efBar=Math.min(g.ef*50,100);const efCol=g.ef>1.3?'#4a8b5a':g.ef<0.7?'#c94a2a':'#b88a3a';mxh+=`<tr><td><b>${g.g}</b></td><td class="num">${g.sku}</td><td class="num">${g.sp.toFixed(0)}%</td><td class="num">${num(g.q)}</td><td class="num">${g.cli}</td><td class="money">${brl(g.pm)}</td><td class="num"><b>${num(g.q)} pç</b></td><td class="num">${g.fp.toFixed(1)}%</td><td class="num ${ec}"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:60px;height:6px;background:#f0ebe3;border-radius:3px;overflow:hidden"><div style="width:${efBar}%;height:100%;background:${efCol}"></div></div><b>${g.ef.toFixed(2)}×</b></div></td><td><span class="rec ${rcls}">${rec}</span></td></tr>`});
  document.getElementById('mix-opt').innerHTML=mxh+'</tbody></table>';

  // Insights
  // insights tables without margem
  const tblI=rs=>{if(!rs.length)return '<div class="empty">—</div>';let h='<table class="m"><thead><tr><th>Img</th><th>SKU</th><th>Produto</th><th>Marca</th><th>Faixa</th><th class="r">Pç</th><th class="r">Cli</th><th class="r">Fat</th></tr></thead><tbody>';rs.forEach(r=>{h+=`<tr><td>${img(r.p,32)}</td><td class="sku">${r.p}${r.est?`<br><span style="font-size:.55rem;color:#8b6a8a">${r.est}</span>`:''}</td><td>${r.dp}</td><td><span class="pill pl-${mcls(r.m)}">${r.m.substring(0,4)}</span></td><td><span class="fxp fxp-${fxcls(r.fx)}">${r.fx}</span></td><td class="num">${num(r.q)}</td><td class="num">${r.cli}</td><td class="num"><b>${num(r.q)} pç</b></td></tr>`});return h+'</tbody></table>'};
  document.getElementById('ins-h').innerHTML=tblI(sA.filter(r=>r.cli>=6&&r.q/r.cli<=4).slice(0,6));
  document.getElementById('ins-a').innerHTML=tblI(sA.filter(r=>r.mg>=55&&r.q>=15).sort((a,b)=>b.mg-a.mg).slice(0,6));
  document.getElementById('ins-b').innerHTML=tblI(sA.filter(r=>r.mg<35&&r.q>=15).sort((a,b)=>a.mg-b.mg).slice(0,6));
  
  // MAPA
  var mEl=document.getElementById('mapa-ataque');
  if(mEl){
    var sM={};X.forEach(function(r){if(!sM[r.p])sM[r.p]={p:r.p,dp:r.dp,m:r.m,l:r.l||'SEM LINHA',g:r.g,fx:r.fx,f:0,q:0,cs:{},est:r.est||''};sM[r.p].f+=r.f;sM[r.p].q+=r.q;sM[r.p].cs[r.c]=1});
    var mA=[];Object.keys(sM).forEach(function(k){var s=sM[k];s.cli=Object.keys(s.cs).length;s.pm=s.q?s.f/s.q:0;mA.push(s)});mA.sort(function(a,b){return b.q-a.q});
    function fPM(p){if(p<50)return'00-50';if(p<60)return'50-60';if(p<70)return'60-70';if(p<80)return'70-80';if(p<90)return'80-90';if(p<100)return'90-100';if(p<110)return'100-110';if(p<120)return'110-120';if(p<130)return'120-130';if(p<140)return'130-140';if(p<150)return'140-150';if(p<160)return'150-160';if(p<170)return'160-170';return'170+'}
    var tF=mA.reduce(function(a,b){return a+b.f},0)||1;
    var H='<div style="display:flex;gap:20px;justify-content:center;padding:14px 0 18px;border-bottom:1px solid #e0d5ca;margin-bottom:18px"><div style="text-align:center"><div style="font-family:Fraunces,serif;font-size:1.4rem;font-weight:700">'+mA.length+'</div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.8px;color:#8a7e72">SKUs</div></div><div style="text-align:center"><div style="font-family:Fraunces,serif;font-size:1.4rem;font-weight:700">'+num(mA.reduce(function(a,b){return a+b.q},0))+'</div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.8px;color:#8a7e72">peças</div></div></div>';
    var MO=['KIKI','MENINA ANJO','VALENT'],LO=['BEBE','PRIMEIROS PASSOS','INFANTIL','TEEN'];
    var tr={};mA.forEach(function(s){if(!tr[s.m])tr[s.m]={};if(!tr[s.m][s.l])tr[s.m][s.l]=[];tr[s.m][s.l].push(s)});
    MO.forEach(function(mk){if(!tr[mk])return;var ms=[];LO.forEach(function(l){if(tr[mk]&&tr[mk][l])ms=ms.concat(tr[mk][l])});var mf=ms.reduce(function(a,b){return a+b.f},0);var mq=ms.reduce(function(a,b){return a+b.q},0);var co=mk==='KIKI'?'#a08366':mk==='MENINA ANJO'?'#8b6a8a':'#4a8b5a';
    H+='<div style="margin-bottom:22px;border:1.5px solid '+co+'40;border-radius:12px;overflow:hidden;background:#fff"><div style="padding:12px 16px;background:'+co+'10;border-bottom:1.5px solid '+co+'30;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span style="background:'+co+';color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;font-size:.85rem">'+mk+'</span><span style="font-size:.72rem;color:#5a5047;font-family:monospace">'+ms.length+' SKUs \u00b7 '+num(mq)+' p\u00e7 \u00b7 '+(mf/tF*100).toFixed(0)+'%</span></div>';
    LO.forEach(function(ln){if(!tr[mk]||!tr[mk][ln])return;var ls=tr[mk][ln];var lf=ls.reduce(function(a,b){return a+b.f},0);
    H+='<div style="margin:10px 12px;border:1px solid #e8e3dd;border-radius:8px;overflow:hidden"><div style="padding:8px 12px;background:#f8f5f1;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e8e3dd;flex-wrap:wrap"><b style="font-family:Fraunces,serif;font-size:.9rem">'+ln+'</b><span style="font-size:.65rem;color:#8a7e72;font-family:monospace">'+ls.length+' SKUs'+'</span></div>';
    var gm={};ls.forEach(function(s){if(!gm[s.g])gm[s.g]=[];gm[s.g].push(s)});
    Object.keys(gm).sort(function(a,b){return gm[b].reduce(function(x,y){return x+y.q},0)-gm[a].reduce(function(x,y){return x+y.q},0)}).forEach(function(tp){var gs=gm[tp];gs.sort(function(a,b){return b.q-a.q});
    H+='<div style="padding:7px 9px"><div style="font-size:.62rem;text-transform:uppercase;letter-spacing:1px;color:#8a7e72;font-weight:600;margin-bottom:6px;padding-bottom:3px;border-bottom:1px dashed #e0d5ca">'+tp+' ('+gs.length+')</div><div style="display:flex;flex-wrap:wrap;gap:7px">';
    gs.forEach(function(s){var fc=s.fx==='ENTRADA'?'#4a8b5a':s.fx==='M\u00c9DIO'?'#a08366':s.fx==='PREMIUM'?'#8b4a6b':'#888';var im=IMG[s.p]?'<img src="data:image/jpeg;base64,'+IMG[s.p]+'" style="width:100%;height:100%;object-fit:cover;display:block">':'<div style="width:100%;height:100%;background:repeating-linear-gradient(135deg,#ede8e3,#ede8e3 8px,#e8e3dd 8px,#e8e3dd 16px);display:flex;align-items:center;justify-content:center;font-size:.5rem;color:#a09080">sem foto</div>';
    H+='<div style="width:110px;border:1px solid #e0d5ca;border-radius:6px;overflow:hidden;background:#fafaf8"><div style="position:relative;width:110px;height:145px;overflow:hidden;background:#f5f0eb">'+im+'<div style="position:absolute;top:3px;right:3px;font-size:.48rem;font-weight:700;text-transform:uppercase;padding:2px 5px;border-radius:3px;color:#fff;background:'+fc+'">'+s.fx+'</div></div><div style="padding:4px 6px"><div style="font-family:monospace;font-size:.52rem;color:#8a7e72">'+s.p+'</div>'+(s.est?'<div style="font-size:.44rem;color:#8b6a8a;font-weight:600">'+s.est+'</div>':'')+'<div style="font-family:Fraunces,serif;font-size:.88rem;font-weight:700;color:#2a2520;margin:1px 0">R$ '+s.pm.toFixed(0)+'</div><div style="font-size:.48rem;color:#8a7e72;font-family:monospace">'+fPM(s.pm)+'</div><div style="font-size:.55rem;color:#5a5047;margin-top:1px">'+num(s.q)+' p\u00e7 \u00b7 '+s.cli+' cli</div></div></div>'});
    H+='</div></div>'});H+='</div>'});H+='</div>'});
    mEl.innerHTML=H;
  }

}
function setF(k,b,v){document.querySelectorAll('[data-'+k+']').forEach(x=>x.classList.remove('act'));b.classList.add('act');F[k]=v;render()}
function sw(v,b){document.querySelectorAll('.view').forEach(x=>x.classList.remove('act'));document.getElementById('v-'+v).classList.add('act');document.querySelectorAll('.tab').forEach(x=>x.classList.remove('act'));b.classList.add('act');window.scrollTo({top:0,behavior:'smooth'})}


render();
