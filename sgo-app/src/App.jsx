import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  LayoutDashboard, ListPlus, CalendarRange, Upload, FolderCog, Wallet,
  Plus, Pencil, Copy, Ban, X, Check, AlertTriangle, ChevronRight,
  Trash2, RotateCcw, FileSpreadsheet, Filter, Search, Info, History, Paperclip,
} from "lucide-react";

/* ============================================================
   TOKENS
============================================================ */
const C = {
  navy: "#122A43",
  navyDeep: "#0C1E31",
  navySoft: "#1C3A5B",
  bg: "#F4F6F8",
  card: "#FFFFFF",
  line: "#E3E8EE",
  ink: "#1B2733",
  inkSoft: "#5A6B7C",
  inkFaint: "#8C9AA9",
  blue: "#2563A8",
  green: "#2F7D5B",
  greenBg: "#E4F1EA",
  yellow: "#C79A12",
  yellowBg: "#FBF3D9",
  orange: "#D0662A",
  orangeBg: "#FBE9DD",
  red: "#BE3A40",
  redBg: "#F9E4E5",
  gray: "#6B7787",
  grayBg: "#EEF1F4",
};
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const fmt2 = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v || 0);
const fmtK = (v) => {
  if (Math.abs(v) >= 1000000) return (v / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
  if (Math.abs(v) >= 1000) return Math.round(v / 1000).toLocaleString("pt-BR") + " mil";
  return String(Math.round(v));
};
const pct = (v) => (isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "%" : "0%");
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const hoje = () => new Date().toISOString().slice(0, 10);
const agora = () => new Date().toLocaleString("pt-BR");

/* ============================================================
   DADOS DE EXEMPLO
============================================================ */
function seedDb() {
  const cc = [
    { id: "cc1", codigo: "MKT-01", nome: "Marketing", area: "Marketing", gestor: "Camila Rocha", email: "camila@empresa.com.br", departamento: "Marketing", ativo: true },
    { id: "cc2", codigo: "COM-01", nome: "Comercial", area: "Comercial", gestor: "Rafael Duarte", email: "rafael@empresa.com.br", departamento: "Vendas", ativo: true },
    { id: "cc3", codigo: "TEC-01", nome: "Tecnologia", area: "Tecnologia", gestor: "Juliana Melo", email: "juliana@empresa.com.br", departamento: "TI", ativo: true },
    { id: "cc4", codigo: "PRD-01", nome: "Produto", area: "Produto", gestor: "Thatiane M.", email: "produto@empresa.com.br", departamento: "Produto", ativo: true },
    { id: "cc5", codigo: "ADM-01", nome: "Administrativo", area: "Administrativo", gestor: "Sérgio Lima", email: "adm@empresa.com.br", departamento: "Administração", ativo: true },
  ];
  const cat = [
    { id: "cat1", nome: "Marketing", subs: ["Mídia", "Produção de conteúdo", "Fotografia", "Eventos", "Influenciadores", "Agências"] },
    { id: "cat2", nome: "Prestação de serviços", subs: ["Consultoria", "Freelancers", "Assessoria"] },
    { id: "cat3", nome: "Tecnologia", subs: ["Software", "Infraestrutura", "Desenvolvimento"] },
    { id: "cat4", nome: "Viagens", subs: ["Passagens", "Hospedagem"] },
    { id: "cat5", nome: "Treinamentos", subs: [] },
    { id: "cat6", nome: "Despesas administrativas", subs: [] },
  ];
  const forn = [
    { id: "f1", nome: "Agência Braviz", cnpj: "12.345.678/0001-90", tipo: "Agência de publicidade", email: "contato@braviz.com.br", ativo: true },
    { id: "f2", nome: "Studio Foto Sul", cnpj: "23.456.789/0001-01", tipo: "Fotografia", email: "studio@fotosul.com.br", ativo: true },
    { id: "f3", nome: "Consultoria Prisma", cnpj: "34.567.890/0001-12", tipo: "Consultoria", email: "prisma@prisma.com.br", ativo: true },
    { id: "f4", nome: "TechCloud Brasil", cnpj: "45.678.901/0001-23", tipo: "Software", email: "vendas@techcloud.com.br", ativo: true },
    { id: "f5", nome: "Eventos Maré", cnpj: "56.789.012/0001-34", tipo: "Eventos", email: "contato@mare.com.br", ativo: true },
    { id: "f6", nome: "Freela Hub", cnpj: "67.890.123/0001-45", tipo: "Freelancers", email: "hub@freelahub.com.br", ativo: true },
  ];
  const acoes = [
    { id: "a1", codigo: "ACA-001", nome: "Campanha de lançamento Verão", ccId: "cc1", catId: "cat1", responsavel: "Camila Rocha", status: "Em andamento", prioridade: "Alta", objetivo: "Lançar a coleção Verão com fases de planejamento, criação, produção, lançamento, mídia e avaliação." },
    { id: "a2", codigo: "ACA-002", nome: "Ensaios de coleção", ccId: "cc1", catId: "cat1", responsavel: "Camila Rocha", status: "Em andamento", prioridade: "Média", objetivo: "Ensaios fotográficos trimestrais das coleções." },
    { id: "a3", codigo: "ACA-003", nome: "Convenção de vendas", ccId: "cc2", catId: "cat1", responsavel: "Rafael Duarte", status: "Concluída", prioridade: "Alta", objetivo: "Convenção anual com representantes." },
    { id: "a4", codigo: "ACA-004", nome: "Implantação ERP compras", ccId: "cc3", catId: "cat3", responsavel: "Juliana Melo", status: "Em andamento", prioridade: "Alta", objetivo: "Implantar o módulo de compras do ERP." },
    { id: "a5", codigo: "ACA-005", nome: "Pesquisa de consumidor", ccId: "cc4", catId: "cat2", responsavel: "Thatiane M.", status: "Planejamento", prioridade: "Média", objetivo: "Pesquisa qualitativa com consumidores finais." },
  ];
  const m = (obj) => { const o = {}; for (let i = 1; i <= 12; i++) o[i] = obj[i] || 0; return o; };
  const rec = (v, ini = 1, fim = 12) => { const o = {}; for (let i = 1; i <= 12; i++) o[i] = i >= ini && i <= fim ? v : 0; return o; };
  const orc = [
    { id: "l1", exercicio: 2026, ccId: "cc1", catId: "cat1", sub: "Mídia", acaoId: "a1", fornId: "f1", descricao: "Mídia da campanha Verão", meses: m({ 1: 20000, 2: 30000, 3: 45000, 4: 80000, 5: 60000, 6: 25000 }), status: "aprovado" },
    { id: "l2", exercicio: 2026, ccId: "cc1", catId: "cat1", sub: "Fotografia", acaoId: "a2", fornId: "f2", descricao: "Ensaios trimestrais", meses: m({ 2: 18000, 5: 18000, 8: 18000, 11: 18000 }), status: "aprovado" },
    { id: "l3", exercicio: 2026, ccId: "cc1", catId: "cat1", sub: "Agências", acaoId: null, fornId: "f1", descricao: "Fee mensal de agência", meses: rec(22000), status: "aprovado" },
    { id: "l4", exercicio: 2026, ccId: "cc1", catId: "cat1", sub: "Influenciadores", acaoId: "a1", fornId: null, descricao: "Influenciadores do lançamento", meses: m({ 4: 35000, 5: 35000 }), status: "aprovado" },
    { id: "l5", exercicio: 2026, ccId: "cc2", catId: "cat1", sub: "Eventos", acaoId: "a3", fornId: "f5", descricao: "Convenção de vendas", meses: m({ 3: 120000 }), status: "aprovado" },
    { id: "l6", exercicio: 2026, ccId: "cc2", catId: "cat2", sub: "Freelancers", acaoId: null, fornId: "f6", descricao: "Apoio comercial terceirizado", meses: rec(8000), status: "aprovado" },
    { id: "l7", exercicio: 2026, ccId: "cc3", catId: "cat3", sub: "Software", acaoId: null, fornId: "f4", descricao: "Licenças e assinaturas", meses: rec(14000), status: "aprovado" },
    { id: "l8", exercicio: 2026, ccId: "cc3", catId: "cat3", sub: "Desenvolvimento", acaoId: "a4", fornId: "f3", descricao: "Implantação do ERP", meses: m({ 4: 40000, 5: 40000, 6: 40000, 7: 30000 }), status: "aprovado" },
    { id: "l9", exercicio: 2026, ccId: "cc4", catId: "cat2", sub: "Consultoria", acaoId: "a5", fornId: "f3", descricao: "Pesquisa de consumidor", meses: m({ 3: 25000, 9: 25000 }), status: "aprovado" },
    { id: "l10", exercicio: 2026, ccId: "cc5", catId: "cat6", sub: "", acaoId: null, fornId: null, descricao: "Despesas administrativas gerais", meses: rec(9000), status: "aprovado" },
  ];
  const L = (mes, ccId, catId, sub, acaoId, fornId, desc, nf, comp, real) => ({
    id: uid(), exercicio: 2026, mes, data: `2026-${String(mes).padStart(2, "0")}-15`,
    ccId, catId, sub, acaoId, fornId, descricao: desc, nf, contrato: "",
    valorComprometido: comp, valorRealizado: real, vencimento: "", responsavel: "",
    status: "ativo", origem: "manual", loteId: null, obs: "",
    historico: [{ ts: agora(), texto: "Lançamento criado (dados de exemplo)" }],
  });
  const lanc = [
    L(1, "cc1", "cat1", "Mídia", "a1", "f1", "Mídia janeiro - campanha Verão", "NF 1201", 0, 19500),
    L(2, "cc1", "cat1", "Mídia", "a1", "f1", "Mídia fevereiro - campanha Verão", "NF 1287", 0, 31200),
    L(3, "cc1", "cat1", "Mídia", "a1", "f1", "Mídia março - campanha Verão", "NF 1355", 0, 47800),
    L(4, "cc1", "cat1", "Mídia", "a1", "f1", "Mídia abril - campanha Verão", "NF 1440", 0, 95000),
    L(5, "cc1", "cat1", "Mídia", "a1", "f1", "Mídia maio - campanha Verão", "NF 1523", 0, 61000),
    L(6, "cc1", "cat1", "Mídia", "a1", "f1", "Mídia junho - campanha Verão", "NF 1601", 0, 24500),
    L(2, "cc1", "cat1", "Fotografia", "a2", "f2", "Ensaio coleção 1º trimestre", "NF 88", 0, 18000),
    L(5, "cc1", "cat1", "Fotografia", "a2", "f2", "Ensaio coleção 2º trimestre", "NF 112", 0, 19200),
    ...[1, 2, 3, 4, 5, 6, 7].map((mm) => L(mm, "cc1", "cat1", "Agências", null, "f1", `Fee agência ${MESES_FULL[mm - 1].toLowerCase()}`, `NF F${1000 + mm}`, 0, 22000)),
    L(4, "cc1", "cat1", "Influenciadores", "a1", null, "Contratos de influenciadores abril", "", 0, 36500),
    L(5, "cc1", "cat1", "Influenciadores", "a1", null, "Contratos de influenciadores maio", "", 38000, 0),
    L(8, "cc1", "cat1", "Fotografia", "a2", "f2", "Ensaio 3º trimestre - contrato assinado", "", 18000, 0),
    L(3, "cc2", "cat1", "Eventos", "a3", "f5", "Convenção de vendas - evento", "NF 501", 0, 116000),
    ...[1, 2, 3, 4, 5, 6, 7].map((mm) => L(mm, "cc2", "cat2", "Freelancers", null, "f6", `Freelancers comercial ${MESES_FULL[mm - 1].toLowerCase()}`, `NF H${200 + mm}`, 0, 7800)),
    ...[1, 2, 3, 4, 5, 6, 7].map((mm) => L(mm, "cc3", "cat3", "Software", null, "f4", `Licenças ${MESES_FULL[mm - 1].toLowerCase()}`, `NF T${300 + mm}`, 0, 14000)),
    L(4, "cc3", "cat3", "Desenvolvimento", "a4", "f3", "ERP compras - etapa 1", "NF 771", 0, 40000),
    L(5, "cc3", "cat3", "Desenvolvimento", "a4", "f3", "ERP compras - etapa 2", "NF 792", 0, 42000),
    L(6, "cc3", "cat3", "Desenvolvimento", "a4", "f3", "ERP compras - etapa 3", "", 40000, 0),
    L(3, "cc4", "cat2", "Consultoria", "a5", "f3", "Pesquisa de consumidor - fase 1", "NF 810", 0, 25500),
    ...[1, 2, 3, 4, 5, 6, 7].map((mm) => L(mm, "cc5", "cat6", "", null, null, `Despesas administrativas ${MESES_FULL[mm - 1].toLowerCase()}`, "", 0, 8700 + mm * 60)),
  ];
  return {
    versao: 1,
    exercicio: 2026,
    config: { atencao: 80, risco: 90 },
    centrosCusto: cc, categorias: cat, fornecedores: forn, acoes,
    orcamento: orc, lancamentos: lanc, lotes: [],
  };
}
function dbVazio() {
  return { versao: 1, exercicio: new Date().getFullYear(), config: { atencao: 80, risco: 90 }, centrosCusto: [], categorias: [], fornecedores: [], acoes: [], orcamento: [], lancamentos: [], lotes: [] };
}

/* ============================================================
   ANEXOS (PDF e imagens, gravados no armazenamento persistente)
============================================================ */
const ANEXO_PREFIX = "sgo-anexo-";

/* Camada de armazenamento: dentro do Claude usa window.storage;
   fora (versão aplicativo), usa o IndexedDB do navegador. */
const idbStore = {
  _db: null,
  _open() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open("sgo-armazenamento", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  },
  async _ensure() { if (!this._db) this._db = await this._open(); return this._db; },
  async get(key) {
    const db = await this._ensure();
    return new Promise((res, rej) => {
      const rq = db.transaction("kv").objectStore("kv").get(key);
      rq.onsuccess = () => res(rq.result == null ? null : { key, value: rq.result });
      rq.onerror = () => rej(rq.error);
    });
  },
  async set(key, value) {
    const db = await this._ensure();
    return new Promise((res, rej) => {
      const rq = db.transaction("kv", "readwrite").objectStore("kv").put(value, key);
      rq.onsuccess = () => res({ key, value });
      rq.onerror = () => rej(rq.error);
    });
  },
  async delete(key) {
    const db = await this._ensure();
    return new Promise((res, rej) => {
      const rq = db.transaction("kv", "readwrite").objectStore("kv").delete(key);
      rq.onsuccess = () => res({ key, deleted: true });
      rq.onerror = () => rej(rq.error);
    });
  },
};
function getStore() {
  if (typeof window !== "undefined" && window.storage) return window.storage;
  if (typeof indexedDB !== "undefined") return idbStore;
  return null;
}
async function salvarAnexoStorage(id, dataUrl) {
  try { const st = getStore(); if (st) { await st.set(ANEXO_PREFIX + id, dataUrl); return true; } } catch (e) { console.error("Falha ao salvar anexo", e); }
  return false;
}
async function lerAnexoStorage(id) {
  try { const st = getStore(); if (st) { const r = await st.get(ANEXO_PREFIX + id); return r?.value || null; } } catch (e) { console.error("Falha ao ler anexo", e); }
  return null;
}
async function apagarAnexoStorage(id) {
  try { const st = getStore(); if (st) await st.delete(ANEXO_PREFIX + id); } catch (e) { /* anexo inexistente */ }
}

function VisorAnexo({ anexo, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    (async () => { const v = await lerAnexoStorage(anexo.id); if (!ativo) return; if (v) setDataUrl(v); else setErro(true); })();
    return () => { ativo = false; };
  }, [anexo.id]);
  const ehPdf = (anexo.tipo || "").includes("pdf") || anexo.nome.toLowerCase().endsWith(".pdf");
  return (
    <Modal title={anexo.nome} onClose={onClose} wide>
      {erro ? <p className="text-sm" style={{ color: C.red }}>Não foi possível carregar o arquivo do armazenamento.</p>
        : !dataUrl ? <p className="text-sm" style={{ color: C.inkSoft }}>Carregando arquivo...</p>
          : (
            <div className="flex flex-col gap-3">
              {ehPdf
                ? <embed src={dataUrl} type="application/pdf" style={{ width: "100%", height: "65vh", borderRadius: 12, border: `1px solid ${C.line}` }} />
                : <img src={dataUrl} alt={anexo.nome} style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 12, border: `1px solid ${C.line}`, objectFit: "contain", margin: "0 auto" }} />}
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: C.inkFaint }}>{anexo.kb} KB</span>
                <a href={dataUrl} download={anexo.nome} className="text-sm font-semibold hover:underline" style={{ color: C.blue }}>Baixar arquivo</a>
              </div>
              {ehPdf && <p className="text-[11px]" style={{ color: C.inkFaint }}>Se a pré-visualização não aparecer no seu navegador, use o link Baixar arquivo.</p>}
            </div>
          )}
    </Modal>
  );
}

/* ============================================================
   CÁLCULOS
============================================================ */
function calcular(db, ex, ccFiltro = null) {
  const meses = Array.from({ length: 12 }, () => ({ orcado: 0, comprometido: 0, realizado: 0 }));
  const porCC = {}; const porCat = {}; const porForn = {}; const porAcao = {};
  const ini = () => ({ orcado: 0, comprometido: 0, realizado: 0, meses: Array.from({ length: 12 }, () => ({ orcado: 0, comprometido: 0, realizado: 0 })) });
  db.orcamento.forEach((l) => {
    if (l.exercicio !== ex || l.status === "cancelado") return;
    if (ccFiltro && l.ccId !== ccFiltro) return;
    for (let mm = 1; mm <= 12; mm++) {
      const v = Number(l.meses[mm]) || 0; if (!v) continue;
      meses[mm - 1].orcado += v;
      (porCC[l.ccId] = porCC[l.ccId] || ini()).orcado += v; porCC[l.ccId].meses[mm - 1].orcado += v;
      (porCat[l.catId] = porCat[l.catId] || ini()).orcado += v;
      if (l.acaoId) { (porAcao[l.acaoId] = porAcao[l.acaoId] || ini()).orcado += v; porAcao[l.acaoId].meses[mm - 1].orcado += v; }
    }
  });
  db.lancamentos.forEach((x) => {
    if (x.exercicio !== ex || x.status !== "ativo") return;
    if (ccFiltro && x.ccId !== ccFiltro) return;
    const c = Number(x.valorComprometido) || 0, r = Number(x.valorRealizado) || 0;
    const mm = Math.min(Math.max(x.mes || 1, 1), 12);
    meses[mm - 1].comprometido += c; meses[mm - 1].realizado += r;
    const cc = (porCC[x.ccId] = porCC[x.ccId] || ini()); cc.comprometido += c; cc.realizado += r;
    cc.meses[mm - 1].comprometido += c; cc.meses[mm - 1].realizado += r;
    const ct = (porCat[x.catId] = porCat[x.catId] || ini()); ct.comprometido += c; ct.realizado += r;
    if (x.fornId) { const f = (porForn[x.fornId] = porForn[x.fornId] || ini()); f.comprometido += c; f.realizado += r; }
    if (x.acaoId) { const a = (porAcao[x.acaoId] = porAcao[x.acaoId] || ini()); a.comprometido += c; a.realizado += r; a.meses[mm - 1].comprometido += c; a.meses[mm - 1].realizado += r; }
  });
  const tot = meses.reduce((acc, mm) => ({ orcado: acc.orcado + mm.orcado, comprometido: acc.comprometido + mm.comprometido, realizado: acc.realizado + mm.realizado }), { orcado: 0, comprometido: 0, realizado: 0 });
  tot.saldo = tot.orcado - tot.comprometido - tot.realizado;
  tot.execPct = tot.orcado > 0 ? ((tot.comprometido + tot.realizado) / tot.orcado) * 100 : 0;
  return { meses, tot, porCC, porCat, porForn, porAcao };
}
function consumoPct(d) { return d.orcado > 0 ? ((d.comprometido + d.realizado) / d.orcado) * 100 : (d.comprometido + d.realizado > 0 ? Infinity : 0); }
function corStatus(p, cfg) {
  if (!isFinite(p) || p > 100) return { bg: C.redBg, fg: C.red, label: "Excedido" };
  if (p >= cfg.risco) return { bg: C.orangeBg, fg: C.orange, label: "Risco" };
  if (p >= cfg.atencao) return { bg: C.yellowBg, fg: C.yellow, label: "Atenção" };
  return { bg: C.greenBg, fg: C.green, label: "Dentro do orçamento" };
}

/* ============================================================
   COMPONENTES BÁSICOS
============================================================ */
const Btn = ({ children, onClick, kind = "primary", small, disabled, title }) => {
  const styles = {
    primary: { background: C.navy, color: "#fff", border: `1px solid ${C.navy}` },
    ghost: { background: "#fff", color: C.ink, border: `1px solid ${C.line}` },
    danger: { background: "#fff", color: C.red, border: `1px solid ${C.red}` },
    green: { background: C.green, color: "#fff", border: `1px solid ${C.green}` },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-opacity ${small ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-85 cursor-pointer"}`}
      style={styles}>{children}</button>
  );
};
const Chip = ({ text, bg, fg }) => (
  <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: bg, color: fg }}>{text}</span>
);
const Field = ({ label, children, req, span }) => (
  <label className={`flex flex-col gap-1 ${span ? "col-span-2" : ""}`}>
    <span className="text-xs font-semibold" style={{ color: C.inkSoft }}>{label}{req && <span style={{ color: C.red }}> *</span>}</span>
    {children}
  </label>
);
const inputCls = "rounded-lg px-3 py-2 text-sm outline-none w-full";
const inputStyle = { border: `1px solid ${C.line}`, background: "#fff", color: C.ink };
const Input = (props) => <input {...props} className={inputCls} style={inputStyle} />;
const Select = ({ children, ...props }) => <select {...props} className={inputCls} style={inputStyle}>{children}</select>;

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12,30,49,0.55)" }} onClick={onClose}>
    <div className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] overflow-auto rounded-2xl shadow-2xl`} style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: C.card, borderBottom: `1px solid ${C.line}` }}>
        <h3 className="text-base font-bold" style={{ color: C.ink }}>{title}</h3>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X size={18} color={C.inkSoft} /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const ConfirmBox = ({ msg, onOk, onClose, okLabel = "Confirmar", danger = true }) => (
  <Modal title="Confirmação" onClose={onClose}>
    <p className="text-sm" style={{ color: C.ink }}>{msg}</p>
    <div className="mt-4 flex justify-end gap-2">
      <Btn kind="ghost" onClick={onClose}>Voltar</Btn>
      <Btn kind={danger ? "danger" : "primary"} onClick={() => { onOk(); onClose(); }}>{okLabel}</Btn>
    </div>
  </Modal>
);

const Empty = ({ texto, acao }) => (
  <div className="flex flex-col items-center gap-3 py-14 text-center">
    <Info size={28} color={C.inkFaint} />
    <p className="text-sm max-w-sm" style={{ color: C.inkSoft }}>{texto}</p>
    {acao}
  </div>
);

const Card = ({ children, className = "", pad = true }) => (
  <div className={`rounded-2xl ${pad ? "p-5" : ""} ${className}`} style={{ background: C.card, border: `1px solid ${C.line}` }}>{children}</div>
);

/* ============================================================
   DASHBOARD
============================================================ */
function Dashboard({ db }) {
  const [ccFiltro, setCcFiltro] = useState("");
  const ex = db.exercicio;
  const R = useMemo(() => calcular(db, ex, ccFiltro || null), [db, ex, ccFiltro]);
  const cfg = db.config;
  const ccNome = (id) => db.centrosCusto.find((c) => c.id === id)?.nome || "Sem centro de custo";
  const catNome = (id) => db.categorias.find((c) => c.id === id)?.nome || "Sem categoria";
  const fornNome = (id) => db.fornecedores.find((f) => f.id === id)?.nome || "Sem fornecedor";

  const dadosMes = R.meses.map((mm, i) => ({ mes: MESES[i], Orçado: mm.orcado, Comprometido: mm.comprometido, Realizado: mm.realizado }));
  const dadosCC = Object.entries(R.porCC).map(([id, d]) => ({ id, nome: ccNome(id), ...d, pct: consumoPct(d) })).sort((a, b) => b.orcado - a.orcado);
  const dadosCat = Object.entries(R.porCat).map(([id, d]) => ({ nome: catNome(id), valor: d.realizado + d.comprometido })).filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor);
  const dadosForn = Object.entries(R.porForn).map(([id, d]) => ({ nome: fornNome(id), valor: d.realizado + d.comprometido })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const totForn = dadosForn.reduce((s, f) => s + f.valor, 0);
  const catCores = [C.navy, C.blue, C.green, C.yellow, C.orange, C.gray, "#7A5EA8", "#3E8FA3"];

  // Alertas
  const alertas = [];
  dadosCC.forEach((c) => {
    const p = c.pct;
    if (!isFinite(p) || p > 100) alertas.push({ nivel: "red", texto: `${c.nome}: orçamento anual excedido (${isFinite(p) ? pct(p) : "sem orçamento"} consumido).` });
    else if (p >= cfg.risco) alertas.push({ nivel: "orange", texto: `${c.nome}: ${pct(p)} do orçamento anual consumido (limite de risco: ${cfg.risco}%).` });
    else if (p >= cfg.atencao) alertas.push({ nivel: "yellow", texto: `${c.nome}: ${pct(p)} do orçamento anual consumido (limite de atenção: ${cfg.atencao}%).` });
  });
  Object.entries(R.porAcao).forEach(([id, d]) => {
    const p = consumoPct(d);
    if (d.orcado > 0 && p > 100) {
      const a = db.acoes.find((x) => x.id === id);
      alertas.push({ nivel: "red", texto: `Ação ${a?.nome || id}: consumo de ${pct(p)} sobre o orçado (${fmt(d.comprometido + d.realizado)} de ${fmt(d.orcado)}).` });
    }
  });
  if (totForn > 0 && R.tot.comprometido + R.tot.realizado > 0) {
    const maior = dadosForn[0];
    const share = (maior.valor / (R.tot.comprometido + R.tot.realizado)) * 100;
    if (share >= 30) alertas.push({ nivel: "yellow", texto: `Concentração: ${maior.nome} representa ${pct(share)} do total comprometido e realizado.` });
  }

  // Leituras automáticas
  const leituras = [];
  if (R.tot.orcado > 0) {
    const top = dadosCC[0];
    if (top) leituras.push({ tipo: "Dado", texto: `O centro de custo ${top.nome} concentra ${pct((top.orcado / R.tot.orcado) * 100)} do orçamento do exercício.` });
    const mesAtual = Math.min(new Date().getMonth() + 1, 12);
    const orcYtd = R.meses.slice(0, mesAtual).reduce((s, mm) => s + mm.orcado, 0);
    const realYtd = R.meses.slice(0, mesAtual).reduce((s, mm) => s + mm.realizado + mm.comprometido, 0);
    if (orcYtd > 0) {
      const desv = ((realYtd - orcYtd) / orcYtd) * 100;
      leituras.push({ tipo: "Dado", texto: `Até ${MESES_FULL[mesAtual - 1].toLowerCase()}, o consumo acumulado está ${pct(Math.abs(desv))} ${desv >= 0 ? "acima" : "abaixo"} do planejado para o período (${fmt(realYtd)} contra ${fmt(orcYtd)}).` });
      const ritmo = realYtd / mesAtual;
      const projAno = realYtd + ritmo * (12 - mesAtual);
      const desvProj = R.tot.orcado > 0 ? ((projAno - R.tot.orcado) / R.tot.orcado) * 100 : 0;
      leituras.push({ tipo: "Projeção", texto: `Mantido o ritmo atual, o exercício encerraria em ${fmt(projAno)}, ${pct(Math.abs(desvProj))} ${desvProj >= 0 ? "acima" : "abaixo"} do orçamento anual.` });
    }
    dadosCC.filter((c) => c.pct < 40 && c.orcado > 50000).slice(0, 1).forEach((c) => {
      leituras.push({ tipo: "Recomendação", texto: `${c.nome} consumiu apenas ${pct(c.pct)} do orçamento anual. Vale revisar o cronograma das ações previstas ou reavaliar a alocação.` });
    });
  }

  const nivelCor = { red: [C.redBg, C.red], orange: [C.orangeBg, C.orange], yellow: [C.yellowBg, C.yellow] };
  const cards = [
    { label: "Orçamento anual", valor: fmt(R.tot.orcado), cor: C.navy },
    { label: "Comprometido", valor: fmt(R.tot.comprometido), cor: C.blue },
    { label: "Realizado", valor: fmt(R.tot.realizado), cor: C.green },
    { label: "Saldo disponível", valor: fmt(R.tot.saldo), cor: R.tot.saldo < 0 ? C.red : C.ink },
    { label: "Percentual executado", valor: pct(R.tot.execPct), cor: corStatus(R.tot.execPct, cfg).fg },
  ];

  const semDados = R.tot.orcado === 0 && R.tot.realizado === 0 && R.tot.comprometido === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm" style={{ color: C.inkSoft }}>
          <Filter size={15} /> <span className="font-semibold">Filtro:</span>
        </div>
        <Select value={ccFiltro} onChange={(e) => setCcFiltro(e.target.value)} style={{ ...inputStyle, width: 260 }}>
          <option value="">Todos os centros de custo</option>
          {db.centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
        </Select>
      </div>

      {semDados ? (
        <Card><Empty texto="Nenhum dado no exercício selecionado. Cadastre linhas de orçamento em Planejamento e registre lançamentos, ou restaure os dados de exemplo no rodapé do menu." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map((c) => (
              <Card key={c.label} className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>{c.label}</span>
                <span className="text-xl font-bold tabular-nums" style={{ color: c.cor, fontVariantNumeric: "tabular-nums" }}>{c.valor}</span>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Card className="lg:col-span-3">
              <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Orçado, comprometido e realizado por mês</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dadosMes} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.inkSoft }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: C.inkSoft }} axisLine={false} tickLine={false} width={54} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Orçado" fill={C.navy} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Comprometido" fill={C.blue} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Realizado" fill={C.green} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="lg:col-span-2">
              <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Despesa por categoria (comprometido + realizado)</h4>
              {dadosCat.length === 0 ? <Empty texto="Sem lançamentos no período." /> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie data={dadosCat} dataKey="valor" nameKey="nome" innerRadius={52} outerRadius={86} paddingAngle={2}>
                        {dadosCat.map((_, i) => <Cell key={i} fill={catCores[i % catCores.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5 text-xs" style={{ color: C.inkSoft }}>
                    {dadosCat.slice(0, 6).map((d, i) => (
                      <div key={d.nome} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: catCores[i % catCores.length] }} />
                        <span className="font-medium" style={{ color: C.ink }}>{d.nome}</span>
                        <span className="tabular-nums">{fmt(d.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Consumo por centro de custo</h4>
              <div className="flex flex-col gap-3">
                {dadosCC.map((c) => {
                  const st = corStatus(c.pct, cfg);
                  const w = Math.min(isFinite(c.pct) ? c.pct : 100, 100);
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold" style={{ color: C.ink }}>{c.nome}</span>
                        <span className="tabular-nums" style={{ color: C.inkSoft }}>{fmt(c.comprometido + c.realizado)} de {fmt(c.orcado)} <b style={{ color: st.fg }}>{isFinite(c.pct) ? pct(c.pct) : "s/ orç."}</b></span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.grayBg }}>
                        <div className="h-full rounded-full" style={{ width: `${w}%`, background: st.fg }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Maiores fornecedores</h4>
              {dadosForn.length === 0 ? <Empty texto="Sem lançamentos com fornecedor." /> : (
                <table className="w-full text-sm">
                  <tbody>
                    {dadosForn.map((f, i) => (
                      <tr key={f.nome} style={{ borderBottom: i < dadosForn.length - 1 ? `1px solid ${C.line}` : "none" }}>
                        <td className="py-2 font-medium" style={{ color: C.ink }}>{f.nome}</td>
                        <td className="py-2 text-right tabular-nums" style={{ color: C.inkSoft }}>{fmt(f.valor)}</td>
                        <td className="py-2 text-right tabular-nums w-16 font-semibold" style={{ color: C.navy }}>{pct((f.valor / (R.tot.comprometido + R.tot.realizado)) * 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <Card>
            <h4 className="text-sm font-bold mb-1" style={{ color: C.ink }}>Mapa de calor: consumo do orçamento por centro de custo e mês</h4>
            <p className="text-xs mb-3" style={{ color: C.inkFaint }}>Percentual = (comprometido + realizado) sobre o orçado do mês. Cinza indica mês sem orçamento.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 3 }}>
                <thead>
                  <tr>
                    <th className="text-left pr-2 font-semibold" style={{ color: C.inkSoft }}>Centro de custo</th>
                    {MESES.map((mm) => <th key={mm} className="font-semibold" style={{ color: C.inkSoft }}>{mm}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dadosCC.map((c) => (
                    <tr key={c.id}>
                      <td className="pr-2 font-semibold whitespace-nowrap" style={{ color: C.ink }}>{c.nome}</td>
                      {c.meses.map((mm, i) => {
                        const gasto = mm.comprometido + mm.realizado;
                        const p = mm.orcado > 0 ? (gasto / mm.orcado) * 100 : (gasto > 0 ? Infinity : null);
                        let bg = C.grayBg, fg = C.inkFaint, txt = "-";
                        if (p !== null) { const st = corStatus(p, cfg); bg = st.bg; fg = st.fg; txt = isFinite(p) ? pct(p) : "s/orç"; }
                        return (
                          <td key={i} className="text-center rounded-md py-2 px-1 font-semibold tabular-nums" style={{ background: bg, color: fg, minWidth: 46 }}
                            title={`${c.nome} - ${MESES_FULL[i]}: orçado ${fmt(mm.orcado)}, gasto ${fmt(gasto)}`}>
                            {txt}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: C.ink }}><AlertTriangle size={15} color={C.orange} /> Alertas ({alertas.length})</h4>
              {alertas.length === 0 ? <Empty texto="Nenhum alerta ativo. Todos os centros de custo estão abaixo dos limites configurados." /> : (
                <div className="flex flex-col gap-2">
                  {alertas.map((a, i) => (
                    <div key={i} className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: nivelCor[a.nivel][0], color: nivelCor[a.nivel][1] }}>{a.texto}</div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Leituras automáticas</h4>
              {leituras.length === 0 ? <Empty texto="Sem dados suficientes para gerar leituras." /> : (
                <div className="flex flex-col gap-2.5">
                  {leituras.map((l, i) => (
                    <div key={i} className="flex gap-2 items-start text-xs" style={{ color: C.inkSoft }}>
                      <Chip text={l.tipo} bg={l.tipo === "Projeção" ? C.yellowBg : l.tipo === "Recomendação" ? C.greenBg : C.grayBg} fg={l.tipo === "Projeção" ? C.yellow : l.tipo === "Recomendação" ? C.green : C.gray} />
                      <span className="pt-0.5">{l.texto}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   PLANEJAMENTO (LINHAS ORÇAMENTÁRIAS)
============================================================ */
function Planejamento({ db, setDb }) {
  const [form, setForm] = useState(null);
  const [conf, setConf] = useState(null);
  const ex = db.exercicio;
  const linhas = db.orcamento.filter((l) => l.exercicio === ex && l.status !== "cancelado");
  const ccNome = (id) => db.centrosCusto.find((c) => c.id === id)?.nome || "-";
  const catNome = (id) => db.categorias.find((c) => c.id === id)?.nome || "-";
  const acaoNome = (id) => db.acoes.find((a) => a.id === id)?.nome || "-";

  const salvar = (linha) => {
    setDb((d) => {
      const existe = d.orcamento.some((l) => l.id === linha.id);
      return { ...d, orcamento: existe ? d.orcamento.map((l) => (l.id === linha.id ? linha : l)) : [...d.orcamento, linha] };
    });
    setForm(null);
  };
  const remover = (id) => setConf({
    msg: "Cancelar esta linha orçamentária? Ela deixará de compor os totais, mas permanecerá no histórico.",
    ok: () => setDb((d) => ({ ...d, orcamento: d.orcamento.map((l) => (l.id === id ? { ...l, status: "cancelado" } : l)) })),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: C.inkSoft }}>Linhas do orçamento de {ex}, com distribuição mês a mês. Total planejado: <b style={{ color: C.ink }}>{fmt(linhas.reduce((s, l) => s + Object.values(l.meses).reduce((a, b) => a + (Number(b) || 0), 0), 0))}</b></p>
        <Btn onClick={() => setForm({ novo: true })}><Plus size={15} /> Nova linha orçamentária</Btn>
      </div>
      <Card pad={false} className="overflow-x-auto">
        {linhas.length === 0 ? <Empty texto="Nenhuma linha orçamentária no exercício. Crie a primeira para começar o planejamento." acao={<Btn onClick={() => setForm({ novo: true })}><Plus size={15} /> Nova linha</Btn>} /> : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: C.bg }}>
                {["Centro de custo", "Categoria", "Ação", "Descrição", ...MESES, "Total", ""].map((h, i) => (
                  <th key={i} className={`px-2 py-2.5 font-semibold whitespace-nowrap ${i < 4 ? "text-left" : "text-right"}`} style={{ color: C.inkSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const tot = Object.values(l.meses).reduce((a, b) => a + (Number(b) || 0), 0);
                return (
                  <tr key={l.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-2 py-2 font-semibold whitespace-nowrap" style={{ color: C.ink }}>{ccNome(l.ccId)}</td>
                    <td className="px-2 py-2 whitespace-nowrap" style={{ color: C.inkSoft }}>{catNome(l.catId)}{l.sub ? ` / ${l.sub}` : ""}</td>
                    <td className="px-2 py-2 whitespace-nowrap" style={{ color: C.inkSoft }}>{l.acaoId ? acaoNome(l.acaoId) : "-"}</td>
                    <td className="px-2 py-2 max-w-[180px] truncate" style={{ color: C.inkSoft }} title={l.descricao}>{l.descricao}</td>
                    {Array.from({ length: 12 }, (_, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums" style={{ color: l.meses[i + 1] ? C.ink : C.inkFaint }}>{l.meses[i + 1] ? fmtK(l.meses[i + 1]) : "-"}</td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums font-bold" style={{ color: C.navy }}>{fmt(tot)}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right">
                      <button className="p-1 hover:bg-gray-100 rounded" title="Editar" onClick={() => setForm(l)}><Pencil size={14} color={C.inkSoft} /></button>
                      <button className="p-1 hover:bg-gray-100 rounded" title="Cancelar linha" onClick={() => remover(l.id)}><Ban size={14} color={C.red} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {conf && <ConfirmBox msg={conf.msg} onOk={conf.ok} onClose={() => setConf(null)} />}
      {form && <LinhaForm db={db} linha={form.novo ? null : form} onSave={salvar} onClose={() => setForm(null)} />}
    </div>
  );
}

function LinhaForm({ db, linha, onSave, onClose }) {
  const [f, setF] = useState(linha || { id: uid(), exercicio: db.exercicio, ccId: "", catId: "", sub: "", acaoId: "", fornId: "", descricao: "", meses: {}, status: "aprovado" });
  const [modo, setModo] = useState(linha && !linha._nova ? "manual" : "unico");
  const [mesUnico, setMesUnico] = useState(1);
  const [valor, setValor] = useState("");
  const [ini, setIni] = useState(1); const [fim, setFim] = useState(12);
  const [erro, setErro] = useState("");
  const cat = db.categorias.find((c) => c.id === f.catId);

  const aplicar = () => {
    const v = Number(valor) || 0;
    const meses = {};
    if (modo === "unico") { for (let i = 1; i <= 12; i++) meses[i] = i === Number(mesUnico) ? v : (f.meses[i] || 0); }
    if (modo === "recorrente") { for (let i = 1; i <= 12; i++) meses[i] = i >= ini && i <= fim ? v : 0; }
    if (modo === "anual") { const parc = Math.round(v / 12); for (let i = 1; i <= 12; i++) meses[i] = parc; }
    if (modo !== "manual") setF({ ...f, meses });
  };
  const salvar = () => {
    if (!f.ccId || !f.catId || !f.descricao.trim()) { setErro("Preencha centro de custo, categoria e descrição."); return; }
    const cc = db.centrosCusto.find((c) => c.id === f.ccId);
    if (!cc || !cc.ativo) { setErro("O centro de custo selecionado está inativo. Selecione um centro de custo ativo."); return; }
    const tot = Object.values(f.meses).reduce((a, b) => a + (Number(b) || 0), 0);
    if (tot <= 0) { setErro("Informe pelo menos um valor mensal maior que zero."); return; }
    onSave({ ...f, _nova: undefined, acaoId: f.acaoId || null, fornId: f.fornId || null });
  };

  return (
    <Modal title={linha && !linha._nova ? "Editar linha orçamentária" : "Nova linha orçamentária"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Centro de custo" req>
          <Select value={f.ccId} onChange={(e) => setF({ ...f, ccId: e.target.value })}>
            <option value="">Selecione</option>
            {db.centrosCusto.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Categoria" req>
          <Select value={f.catId} onChange={(e) => setF({ ...f, catId: e.target.value, sub: "" })}>
            <option value="">Selecione</option>
            {db.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Subcategoria">
          <Select value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} disabled={!cat || cat.subs.length === 0}>
            <option value="">{cat && cat.subs.length ? "Selecione" : "Sem subcategorias"}</option>
            {(cat?.subs || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Ação vinculada">
          <Select value={f.acaoId || ""} onChange={(e) => setF({ ...f, acaoId: e.target.value })}>
            <option value="">Nenhuma</option>
            {db.acoes.map((a) => <option key={a.id} value={a.id}>{a.codigo} - {a.nome}</option>)}
          </Select>
        </Field>
        <Field label="Fornecedor previsto">
          <Select value={f.fornId || ""} onChange={(e) => setF({ ...f, fornId: e.target.value })}>
            <option value="">Nenhum</option>
            {db.fornecedores.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Select>
        </Field>
        <Field label="Descrição do gasto" req><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: Fee mensal de agência" /></Field>
      </div>

      <div className="mt-5 rounded-xl p-4" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
        <p className="text-xs font-bold mb-3" style={{ color: C.ink }}>Distribuição mensal</p>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <Field label="Modo">
            <Select value={modo} onChange={(e) => setModo(e.target.value)} style={{ ...inputStyle, width: 220 }}>
              <option value="unico">Valor único em um mês</option>
              <option value="recorrente">Valor recorrente mensal</option>
              <option value="anual">Valor anual dividido igualmente</option>
              <option value="manual">Valores manuais por mês</option>
            </Select>
          </Field>
          {modo === "unico" && (
            <Field label="Mês">
              <Select value={mesUnico} onChange={(e) => setMesUnico(e.target.value)} style={{ ...inputStyle, width: 130 }}>
                {MESES_FULL.map((mm, i) => <option key={i} value={i + 1}>{mm}</option>)}
              </Select>
            </Field>
          )}
          {modo === "recorrente" && (
            <>
              <Field label="De"><Select value={ini} onChange={(e) => setIni(Number(e.target.value))} style={{ ...inputStyle, width: 110 }}>{MESES_FULL.map((mm, i) => <option key={i} value={i + 1}>{mm}</option>)}</Select></Field>
              <Field label="Até"><Select value={fim} onChange={(e) => setFim(Number(e.target.value))} style={{ ...inputStyle, width: 110 }}>{MESES_FULL.map((mm, i) => <option key={i} value={i + 1}>{mm}</option>)}</Select></Field>
            </>
          )}
          {modo !== "manual" && (
            <>
              <Field label={modo === "anual" ? "Valor anual (R$)" : "Valor (R$)"}><Input type="number" min="0" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...inputStyle, width: 140 }} /></Field>
              <Btn kind="ghost" onClick={aplicar}><Check size={14} /> Aplicar</Btn>
            </>
          )}
        </div>
        <div className="grid grid-cols-6 gap-2">
          {MESES.map((mm, i) => (
            <label key={mm} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold" style={{ color: C.inkFaint }}>{mm}</span>
              <input type="number" min="0" value={f.meses[i + 1] || ""} placeholder="0"
                onChange={(e) => setF({ ...f, meses: { ...f.meses, [i + 1]: Number(e.target.value) || 0 } })}
                className="rounded-md px-2 py-1.5 text-xs text-right tabular-nums outline-none" style={inputStyle} />
            </label>
          ))}
        </div>
        <p className="text-xs mt-3 font-semibold text-right" style={{ color: C.navy }}>Total da linha: {fmt(Object.values(f.meses).reduce((a, b) => a + (Number(b) || 0), 0))}</p>
      </div>

      {erro && <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: C.redBg, color: C.red }}>{erro}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={salvar}><Check size={15} /> Salvar linha</Btn>
      </div>
    </Modal>
  );
}

/* ============================================================
   LANÇAMENTOS
============================================================ */
function Lancamentos({ db, setDb }) {
  const [form, setForm] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [motivoCanc, setMotivoCanc] = useState("");
  const [histVendo, setHistVendo] = useState(null);
  const [anexosVendo, setAnexosVendo] = useState(null);
  const [visorLista, setVisorLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [fCC, setFCC] = useState(""); const [fMes, setFMes] = useState(""); const [fStatus, setFStatus] = useState("ativo");
  const ex = db.exercicio;
  const ccNome = (id) => db.centrosCusto.find((c) => c.id === id)?.nome || "-";
  const catNome = (id) => db.categorias.find((c) => c.id === id)?.nome || "-";
  const fornNome = (id) => db.fornecedores.find((f) => f.id === id)?.nome || "-";

  const lista = db.lancamentos
    .filter((x) => x.exercicio === ex)
    .filter((x) => (fCC ? x.ccId === fCC : true))
    .filter((x) => (fMes ? x.mes === Number(fMes) : true))
    .filter((x) => (fStatus ? x.status === fStatus : true))
    .filter((x) => {
      if (!busca.trim()) return true;
      const t = busca.toLowerCase();
      return [x.descricao, x.nf, fornNome(x.fornId), ccNome(x.ccId)].join(" ").toLowerCase().includes(t);
    })
    .sort((a, b) => (b.mes - a.mes) || (a.descricao > b.descricao ? 1 : -1));

  const salvar = (lanc, avisos) => {
    setDb((d) => {
      const existe = d.lancamentos.some((l) => l.id === lanc.id);
      const hist = { ts: agora(), texto: existe ? "Lançamento editado" : "Lançamento criado" + (avisos.length ? ` (avisos aceitos: ${avisos.join("; ")})` : "") };
      const novo = { ...lanc, historico: [...(lanc.historico || []), hist] };
      return { ...d, lancamentos: existe ? d.lancamentos.map((l) => (l.id === lanc.id ? novo : l)) : [...d.lancamentos, novo] };
    });
    setForm(null);
  };
  const cancelar = (l) => { setMotivoCanc(""); setCancelando(l); };
  const confirmarCancelamento = () => {
    const l = cancelando;
    setDb((d) => ({
      ...d,
      lancamentos: d.lancamentos.map((x) => x.id === l.id ? { ...x, status: "cancelado", historico: [...(x.historico || []), { ts: agora(), texto: `Cancelado. Motivo: ${motivoCanc || "não informado"}` }] } : x),
    }));
    setCancelando(null);
  };
  const duplicar = (l) => setForm({ ...l, id: uid(), nf: "", status: "ativo", historico: [], anexos: [], _dup: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" color={C.inkFaint} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, NF, fornecedor" className={inputCls + " pl-8"} style={{ ...inputStyle, width: 260 }} />
        </div>
        <Select value={fCC} onChange={(e) => setFCC(e.target.value)} style={{ ...inputStyle, width: 190 }}>
          <option value="">Todos os centros de custo</option>
          {db.centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </Select>
        <Select value={fMes} onChange={(e) => setFMes(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="">Todos os meses</option>
          {MESES_FULL.map((mm, i) => <option key={i} value={i + 1}>{mm}</option>)}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="ativo">Ativos</option>
          <option value="cancelado">Cancelados</option>
          <option value="">Todos</option>
        </Select>
        <div className="ml-auto"><Btn onClick={() => setForm({ novo: true })}><Plus size={15} /> Novo lançamento</Btn></div>
      </div>

      <Card pad={false} className="overflow-x-auto">
        {lista.length === 0 ? <Empty texto="Nenhum lançamento encontrado com os filtros atuais." acao={<Btn onClick={() => setForm({ novo: true })}><Plus size={15} /> Novo lançamento</Btn>} /> : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: C.bg }}>
                {["Mês", "Centro de custo", "Categoria", "Descrição", "Fornecedor", "Documento", "Comprometido", "Realizado", "Origem", ""].map((h, i) => (
                  <th key={i} className={`px-3 py-2.5 font-semibold whitespace-nowrap ${i >= 6 && i <= 7 ? "text-right" : "text-left"}`} style={{ color: C.inkSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${C.line}`, opacity: l.status === "cancelado" ? 0.5 : 1 }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: C.ink }}>{MESES[l.mes - 1]}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.ink }}>{ccNome(l.ccId)}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.inkSoft }}>{catNome(l.catId)}{l.sub ? ` / ${l.sub}` : ""}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" style={{ color: C.inkSoft }} title={l.descricao}>{l.descricao}{l.status === "cancelado" && <Chip text="Cancelado" bg={C.grayBg} fg={C.gray} />}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.inkSoft }}>{l.fornId ? fornNome(l.fornId) : "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.inkFaint }}>{l.nf || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: C.blue }}>{l.valorComprometido ? fmt2(l.valorComprometido) : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: C.green }}>{l.valorRealizado ? fmt2(l.valorRealizado) : "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><Chip text={l.origem === "importacao" ? "Importação" : "Manual"} bg={l.origem === "importacao" ? C.greenBg : C.grayBg} fg={l.origem === "importacao" ? C.green : C.gray} />{l.formaPagamento === "reembolso" && <> <Chip text="Reembolso" bg={C.yellowBg} fg={C.yellow} /></>}{l.formaPagamento === "pagamento_direto" && <> <Chip text="Pag. direto" bg={C.grayBg} fg={C.gray} /></>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {(l.anexos || []).length > 0 && <button className="p-1 hover:bg-gray-100 rounded" title={`${l.anexos.length} anexo(s)`} onClick={() => setAnexosVendo(l)}><Paperclip size={14} color={C.blue} /></button>}
                    <button className="p-1 hover:bg-gray-100 rounded" title="Ver histórico" onClick={() => setHistVendo(l)}><History size={14} color={C.inkFaint} /></button>
                    <button className="p-1 hover:bg-gray-100 rounded" title="Duplicar" onClick={() => duplicar(l)}><Copy size={14} color={C.inkSoft} /></button>
                    <button className="p-1 hover:bg-gray-100 rounded" title="Editar" onClick={() => setForm(l)}><Pencil size={14} color={C.inkSoft} /></button>
                    {l.status === "ativo" && <button className="p-1 hover:bg-gray-100 rounded" title="Cancelar" onClick={() => cancelar(l)}><Ban size={14} color={C.red} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {anexosVendo && (
        <Modal title="Anexos do lançamento" onClose={() => setAnexosVendo(null)}>
          <p className="text-sm font-semibold mb-3" style={{ color: C.ink }}>{anexosVendo.descricao}</p>
          <div className="flex flex-col gap-1.5">
            {(anexosVendo.anexos || []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                <Paperclip size={12} color={C.inkFaint} />
                <button className="font-semibold hover:underline text-left flex-1 truncate" style={{ color: C.blue }} onClick={() => setVisorLista(a)} title={a.nome}>{a.nome}</button>
                <span style={{ color: C.inkFaint }}>{a.kb} KB</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {visorLista && <VisorAnexo anexo={visorLista} onClose={() => setVisorLista(null)} />}
      {histVendo && (
        <Modal title="Histórico do lançamento" onClose={() => setHistVendo(null)}>
          <p className="text-sm font-semibold mb-3" style={{ color: C.ink }}>{histVendo.descricao}</p>
          {(histVendo.historico || []).length === 0 ? <p className="text-xs" style={{ color: C.inkFaint }}>Sem histórico registrado.</p> : (
            <div className="flex flex-col gap-2">
              {histVendo.historico.map((h, i) => (
                <div key={i} className="rounded-lg px-3 py-2 text-xs" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <div className="font-semibold mb-0.5" style={{ color: C.inkFaint }}>{h.ts}</div>
                  <div style={{ color: C.ink }}>{h.texto}</div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {cancelando && (
        <Modal title="Cancelar lançamento" onClose={() => setCancelando(null)}>
          <p className="text-sm mb-3" style={{ color: C.ink }}>O lançamento "{cancelando.descricao}" será cancelado e deixará de compor os totais, mas permanecerá no histórico.</p>
          <Field label="Motivo do cancelamento"><Input value={motivoCanc} onChange={(e) => setMotivoCanc(e.target.value)} placeholder="Ex.: lançamento duplicado" /></Field>
          <div className="mt-4 flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setCancelando(null)}>Voltar</Btn>
            <Btn kind="danger" onClick={confirmarCancelamento}><Ban size={14} /> Confirmar cancelamento</Btn>
          </div>
        </Modal>
      )}
      {form && <LancForm db={db} lanc={form.novo ? null : form} onSave={salvar} onClose={() => setForm(null)} />}
    </div>
  );
}

function LancForm({ db, lanc, onSave, onClose }) {
  const [f, setF] = useState(lanc || {
    id: uid(), exercicio: db.exercicio, mes: new Date().getMonth() + 1, data: hoje(),
    ccId: "", catId: "", sub: "", acaoId: "", fornId: "", descricao: "", nf: "", contrato: "",
    valorComprometido: 0, valorRealizado: 0, vencimento: "", responsavel: "", status: "ativo",
    origem: "manual", formaPagamento: "", loteId: null, obs: "", historico: [], anexos: [],
  });
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState([]);
  const [confirmar, setConfirmar] = useState(false);
  const [anexoMsg, setAnexoMsg] = useState("");
  const [visor, setVisor] = useState(null);
  const anexoRef = useRef(null);
  const cat = db.categorias.find((c) => c.id === f.catId);

  const adicionarAnexo = (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setAnexoMsg(`O arquivo "${file.name}" passa de 4 MB. Comprima o PDF antes de anexar.`); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const id = uid();
      const ok = await salvarAnexoStorage(id, e.target.result);
      if (!ok) { setAnexoMsg("Não foi possível gravar o anexo no armazenamento."); return; }
      setAnexoMsg("");
      setF((prev) => ({ ...prev, anexos: [...(prev.anexos || []), { id, nome: file.name, tipo: file.type || "application/pdf", kb: Math.max(1, Math.round(file.size / 1024)) }] }));
    };
    reader.readAsDataURL(file);
  };
  const removerAnexo = (a) => {
    apagarAnexoStorage(a.id);
    setF((prev) => ({ ...prev, anexos: (prev.anexos || []).filter((x) => x.id !== a.id) }));
  };

  const validar = () => {
    setErro(""); const av = [];
    if (!f.ccId || !f.catId || !f.mes || !f.descricao.trim()) { setErro("Preencha os campos obrigatórios: mês, centro de custo, categoria e descrição."); return; }
    const cc = db.centrosCusto.find((c) => c.id === f.ccId);
    if (!cc || !cc.ativo) { setErro("Lançamento bloqueado: o centro de custo selecionado está inativo ou não existe."); return; }
    const c = Number(f.valorComprometido) || 0, r = Number(f.valorRealizado) || 0;
    if (c <= 0 && r <= 0) { setErro("Informe um valor comprometido ou realizado maior que zero."); return; }
    // duplicidade de NF
    if (f.nf && db.lancamentos.some((x) => x.id !== f.id && x.status === "ativo" && x.nf && x.nf.trim().toLowerCase() === f.nf.trim().toLowerCase() && x.fornId === (f.fornId || null))) {
      av.push(`Já existe um lançamento ativo com o documento ${f.nf} para este fornecedor (possível duplicidade)`);
    }
    // orçamento insuficiente no mês
    const R = calcular(db, db.exercicio, f.ccId);
    const mm = R.meses[f.mes - 1];
    const jaLancado = lanc ? (Number(lanc.valorComprometido) || 0) + (Number(lanc.valorRealizado) || 0) : 0;
    const novoTotal = mm.comprometido + mm.realizado - jaLancado + c + r;
    if (novoTotal > mm.orcado) {
      av.push(`Orçamento insuficiente em ${MESES_FULL[f.mes - 1]} para ${cc.nome}: orçado ${fmt(mm.orcado)}, total após o lançamento ${fmt(novoTotal)}`);
    }
    if (av.length) { setAvisos(av); setConfirmar(true); return; }
    onSave({ ...f, acaoId: f.acaoId || null, fornId: f.fornId || null }, []);
  };

  return (
    <Modal title={lanc ? (lanc._dup ? "Duplicar lançamento" : "Editar lançamento") : "Novo lançamento"} onClose={onClose} wide>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Mês de competência" req>
          <Select value={f.mes} onChange={(e) => setF({ ...f, mes: Number(e.target.value) })}>
            {MESES_FULL.map((mm, i) => <option key={i} value={i + 1}>{mm}</option>)}
          </Select>
        </Field>
        <Field label="Data do lançamento"><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        <Field label="Vencimento"><Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></Field>
        <Field label="Centro de custo" req>
          <Select value={f.ccId} onChange={(e) => setF({ ...f, ccId: e.target.value })}>
            <option value="">Selecione</option>
            {db.centrosCusto.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Categoria" req>
          <Select value={f.catId} onChange={(e) => setF({ ...f, catId: e.target.value, sub: "" })}>
            <option value="">Selecione</option>
            {db.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Subcategoria">
          <Select value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} disabled={!cat || cat.subs.length === 0}>
            <option value="">{cat && cat.subs.length ? "Selecione" : "Sem subcategorias"}</option>
            {(cat?.subs || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Ação">
          <Select value={f.acaoId || ""} onChange={(e) => setF({ ...f, acaoId: e.target.value })}>
            <option value="">Nenhuma</option>
            {db.acoes.map((a) => <option key={a.id} value={a.id}>{a.codigo} - {a.nome}</option>)}
          </Select>
        </Field>
        <Field label="Fornecedor">
          <Select value={f.fornId || ""} onChange={(e) => setF({ ...f, fornId: e.target.value })}>
            <option value="">Nenhum</option>
            {db.fornecedores.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Select>
        </Field>
        <Field label="Documento / NF"><Input value={f.nf} onChange={(e) => setF({ ...f, nf: e.target.value })} placeholder="Ex.: NF 1234" /></Field>
        <Field label="Descrição" req span><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Descrição do serviço ou despesa" /></Field>
        <Field label="Responsável"><Input value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field>
        <Field label="Valor comprometido (R$)"><Input type="number" min="0" step="0.01" value={f.valorComprometido || ""} onChange={(e) => setF({ ...f, valorComprometido: Number(e.target.value) || 0 })} placeholder="0,00" /></Field>
        <Field label="Valor realizado (R$)"><Input type="number" min="0" step="0.01" value={f.valorRealizado || ""} onChange={(e) => setF({ ...f, valorRealizado: Number(e.target.value) || 0 })} placeholder="0,00" /></Field>
        <Field label="Forma de pagamento">
          <Select value={f.formaPagamento || ""} onChange={(e) => setF({ ...f, formaPagamento: e.target.value })}>
            <option value="">Faturado (fornecedor)</option>
            <option value="reembolso">Reembolso de colaborador</option>
            <option value="pagamento_direto">Pagamento direto do financeiro</option>
          </Select>
        </Field>
        <Field label="Observações" span><Input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
      </div>

      <div className="mt-4 rounded-xl p-4" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-xs font-bold" style={{ color: C.ink }}>Anexos (nota fiscal, comprovante, contrato)</p>
          <Btn small kind="ghost" onClick={() => anexoRef.current?.click()}><Paperclip size={13} /> Anexar PDF ou imagem</Btn>
          <input ref={anexoRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { adicionarAnexo(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {(f.anexos || []).length === 0 ? <p className="text-xs" style={{ color: C.inkFaint }}>Nenhum arquivo anexado. Limite de 4 MB por arquivo.</p> : (
          <div className="flex flex-col gap-1.5">
            {f.anexos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                <Paperclip size={12} color={C.inkFaint} />
                <button className="font-semibold hover:underline text-left flex-1 truncate" style={{ color: C.blue }} onClick={() => setVisor(a)} title={a.nome}>{a.nome}</button>
                <span style={{ color: C.inkFaint }}>{a.kb} KB</span>
                <button className="p-0.5 hover:bg-gray-100 rounded" title="Remover anexo" onClick={() => removerAnexo(a)}><X size={13} color={C.red} /></button>
              </div>
            ))}
          </div>
        )}
        {anexoMsg && <p className="text-xs mt-2 font-medium" style={{ color: C.red }}>{anexoMsg}</p>}
      </div>
      {visor && <VisorAnexo anexo={visor} onClose={() => setVisor(null)} />}

      <p className="text-[11px] mt-3" style={{ color: C.inkFaint }}>Comprometido: valor reservado por contrato ou pedido, ainda não faturado. Realizado: valor faturado ou pago. Quando um compromisso for faturado, edite o lançamento movendo o valor de comprometido para realizado.</p>

      {erro && <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: C.redBg, color: C.red }}>{erro}</div>}
      {confirmar && (
        <div className="mt-3 rounded-lg px-3 py-3 text-xs" style={{ background: C.yellowBg, border: `1px solid ${C.yellow}` }}>
          <p className="font-bold mb-1" style={{ color: C.yellow }}>Avisos antes de salvar:</p>
          <ul className="list-disc pl-4 flex flex-col gap-1" style={{ color: C.ink }}>{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <div className="flex gap-2 mt-3">
            <Btn small kind="ghost" onClick={() => setConfirmar(false)}>Revisar</Btn>
            <Btn small onClick={() => onSave({ ...f, acaoId: f.acaoId || null, fornId: f.fornId || null }, avisos)}>Salvar mesmo assim</Btn>
          </div>
        </div>
      )}
      {!confirmar && (
        <div className="mt-4 flex justify-end gap-2">
          <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={validar}><Check size={15} /> Salvar lançamento</Btn>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   CRONOGRAMA DE AÇÕES
============================================================ */
function Acoes({ db, setDb }) {
  const ex = db.exercicio;
  const R = useMemo(() => calcular(db, ex), [db, ex]);
  const cfg = db.config;
  const ccNome = (id) => db.centrosCusto.find((c) => c.id === id)?.nome || "-";
  const [detalhe, setDetalhe] = useState(null);
  const [formPrev, setFormPrev] = useState(null);

  const linhas = db.acoes.map((a) => ({ acao: a, d: R.porAcao[a.id] || null }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: C.inkSoft }}>Cronograma das ações no exercício {ex}. Em cada mês: previsto na primeira linha da célula e gasto (comprometido + realizado) na segunda. Clique em uma ação para ver o detalhe, ou use Definir previsto para criar a linha orçamentária da ação sem sair desta tela.</p>
      <Card pad={false} className="overflow-x-auto">
        {linhas.length === 0 ? <Empty texto="Nenhuma ação cadastrada. Cadastre ações em Cadastros e vincule linhas orçamentárias e lançamentos a elas." /> : (
          <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th className="text-left px-3 py-2.5 font-semibold" style={{ color: C.inkSoft }}>Ação</th>
                {MESES.map((mm) => <th key={mm} className="px-1 py-2.5 font-semibold text-center" style={{ color: C.inkSoft }}>{mm}</th>)}
                <th className="px-3 py-2.5 font-semibold text-right" style={{ color: C.inkSoft }}>Previsto x gasto</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ acao, d }) => {
                const p = d ? consumoPct(d) : 0;
                const st = d && d.orcado > 0 ? corStatus(p, cfg) : { bg: C.grayBg, fg: C.gray, label: "Sem orçamento" };
                return (
                  <tr key={acao.id} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }} onClick={() => setDetalhe(acao)}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-semibold" style={{ color: C.ink }}>{acao.nome}</div>
                      <div style={{ color: C.inkFaint }}>{acao.codigo} · {ccNome(acao.ccId)} · {acao.status}</div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const mm = d ? d.meses[i] : null;
                      const orc = mm ? mm.orcado : 0, gasto = mm ? mm.comprometido + mm.realizado : 0;
                      const ativo = orc > 0 || gasto > 0;
                      let bg = "transparent";
                      if (ativo) {
                        const pm = orc > 0 ? (gasto / orc) * 100 : (gasto > 0 ? 999 : 0);
                        bg = gasto === 0 ? C.grayBg : corStatus(pm, cfg).bg;
                      }
                      return (
                        <td key={i} className="px-1 py-1.5 text-center align-middle">
                          {ativo ? (
                            <div className="rounded-md px-1 py-1 tabular-nums" style={{ background: bg, minWidth: 48 }}>
                              <div className="font-semibold" style={{ color: C.ink }}>{orc ? fmtK(orc) : "-"}</div>
                              <div style={{ color: C.inkSoft }}>{gasto ? fmtK(gasto) : "-"}</div>
                            </div>
                          ) : <span style={{ color: C.inkFaint }}>·</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="tabular-nums" style={{ color: C.navy }}>Previsto: <b>{fmt(d ? d.orcado : 0)}</b></div>
                      <div className="tabular-nums mb-1" style={{ color: C.green }}>Gasto: <b>{fmt(d ? d.comprometido + d.realizado : 0)}</b></div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <Chip text={st.label} bg={st.bg} fg={st.fg} />
                        <Btn small kind="ghost" onClick={(e) => { e.stopPropagation(); setFormPrev(acao); }}>Definir previsto</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {detalhe && (() => {
        const d = R.porAcao[detalhe.id] || { orcado: 0, comprometido: 0, realizado: 0, meses: Array.from({ length: 12 }, () => ({ orcado: 0, comprometido: 0, realizado: 0 })) };
        const lancs = db.lancamentos.filter((x) => x.acaoId === detalhe.id && x.exercicio === ex && x.status === "ativo");
        const saldo = d.orcado - d.comprometido - d.realizado;
        return (
          <Modal title={`${detalhe.codigo} - ${detalhe.nome}`} onClose={() => setDetalhe(null)} wide>
            <p className="text-sm mb-1" style={{ color: C.inkSoft }}>{detalhe.objetivo || "Sem objetivo cadastrado."}</p>
            <p className="text-xs mb-4" style={{ color: C.inkFaint }}>Centro de custo: {ccNome(detalhe.ccId)} · Responsável: {detalhe.responsavel || "-"} · Prioridade: {detalhe.prioridade || "-"} · Status: {detalhe.status}</p>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[["Orçado", d.orcado, C.navy], ["Comprometido", d.comprometido, C.blue], ["Realizado", d.realizado, C.green], ["Saldo", saldo, saldo < 0 ? C.red : C.ink]].map(([l, v, cor]) => (
                <div key={l} className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                  <div className="text-[10px] font-semibold uppercase" style={{ color: C.inkFaint }}>{l}</div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: cor }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            <h4 className="text-xs font-bold mb-2" style={{ color: C.ink }}>Lançamentos vinculados ({lancs.length})</h4>
            {lancs.length === 0 ? <p className="text-xs" style={{ color: C.inkFaint }}>Nenhum lançamento vinculado a esta ação.</p> : (
              <table className="w-full text-xs">
                <tbody>
                  {lancs.map((l) => (
                    <tr key={l.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="py-1.5 pr-2 font-semibold" style={{ color: C.ink }}>{MESES[l.mes - 1]}</td>
                      <td className="py-1.5 pr-2" style={{ color: C.inkSoft }}>{l.descricao}</td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: C.blue }}>{l.valorComprometido ? fmt(l.valorComprometido) : ""}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: C.green }}>{l.valorRealizado ? fmt(l.valorRealizado) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Modal>
        );
      })()}

      {formPrev && (
        <LinhaForm
          db={db}
          linha={{ _nova: true, id: uid(), exercicio: db.exercicio, ccId: formPrev.ccId || "", catId: formPrev.catId || "", sub: "", acaoId: formPrev.id, fornId: "", descricao: `Previsto: ${formPrev.nome}`, meses: {}, status: "aprovado" }}
          onSave={(linha) => { setDb((d) => ({ ...d, orcamento: [...d.orcamento, linha] })); setFormPrev(null); }}
          onClose={() => setFormPrev(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   IMPORTAÇÃO
============================================================ */
const CAMPOS_IMPORT = [
  { key: "descricao", label: "Descrição / documento", req: true },
  { key: "data", label: "Data da despesa", req: false },
  { key: "mes", label: "Competência (mês). Se ausente, é lida da data", req: false },
  { key: "cc", label: "Centro de custo (código ou nome)", req: false },
  { key: "motivo", label: "Motivo / tipo de despesa", req: false },
  { key: "acao", label: "Ação (se houver coluna própria)", req: false },
  { key: "fornecedor", label: "Prestador / fornecedor", req: false },
  { key: "categoria", label: "Categoria", req: false },
  { key: "nf", label: "Número da nota fiscal", req: false },
];

function parseValor(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function parseMes(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v >= 1 && v <= 12) return Math.round(v);
    if (v > 59) { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? null : d.getUTCMonth() + 1; }
    return null;
  }
  const s = String(v).trim().toLowerCase();
  if (/^\d{1,2}$/.test(s)) { const n = Number(s); return n >= 1 && n <= 12 ? n : null; }
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const idx = nomes.findIndex((n) => s.startsWith(n));
  if (idx >= 0) return idx + 1;
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{4})$/); if (m1) return Number(m1[1]) >= 1 && Number(m1[1]) <= 12 ? Number(m1[1]) : null;
  const m2 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (m2) return Number(m2[2]) >= 1 && Number(m2[2]) <= 12 ? Number(m2[2]) : null;
  const d = new Date(s); if (!isNaN(d)) return d.getMonth() + 1;
  return null;
}

function parseData(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === "number" && v > 59) { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? null : d; }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { const d = new Date(Number(m[3].length === 2 ? "20" + m[3] : m[3]), Number(m[2]) - 1, Number(m[1])); return isNaN(d) ? null : d; }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); return isNaN(d) ? null : d; }
  const d = new Date(s); return isNaN(d) ? null : d;
}

function normTxt(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function distanciaTxt(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// Considera nomes equivalentes mesmo com pequenas variações de grafia
// (ex.: "INTELIGENCIA DE MERCADO" e "INTEGELIGENCIA DE MERCADO")
function mesmoNome(a, b) {
  const x = normTxt(a).replace(/\bDE\b/g, " ").replace(/\s+/g, " ").trim();
  const y = normTxt(b).replace(/\bDE\b/g, " ").replace(/\s+/g, " ").trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return distanciaTxt(x, y) <= 2 && Math.min(x.length, y.length) >= 6;
}
function titularizar(s) {
  return String(s).toLowerCase().split(" ").filter(Boolean).map((w, i) => (w.length <= 2 && i > 0 ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
}

function Importacao({ db, setDb }) {
  const [etapa, setEtapa] = useState(0);
  const [arquivo, setArquivo] = useState(null);
  const [cabecalho, setCabecalho] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [mapa, setMapa] = useState({});
  const [valorCols, setValorCols] = useState([]);
  const [meta, setMeta] = useState({});
  const [padrao, setPadrao] = useState({ ccId: "", catId: "", forma: "reembolso" });
  const [formaLinhas, setFormaLinhas] = useState({});
  const [criarForn, setCriarForn] = useState(true);
  const [criarAcoes, setCriarAcoes] = useState(true);
  const [acoesExcluidas, setAcoesExcluidas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [aviso, setAviso] = useState("");
  const [conf, setConf] = useState(null);
  const fileRef = useRef(null);
  const ex = db.exercicio;

  const modeloDownload = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Centro de custo", "Prestador", "CPF ou CNPJ", "Descrição do serviço", "Nota fiscal", "Competência", "Data da prestação", "Categoria", "Valor líquido"],
      ["MKT-01", "Agência Braviz", "12.345.678/0001-90", "Fee mensal de agência", "NF 2001", "8", "2026-08-05", "Marketing", 22000],
      ["TEC-01", "TechCloud Brasil", "45.678.901/0001-23", "Licenças agosto", "NF 2002", "Ago", "2026-08-10", "Tecnologia", 14000],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prestação de serviços");
    XLSX.writeFile(wb, "modelo-prestacao-servicos.xlsx");
  };

  const lerArquivo = (file) => {
    setAviso("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        // Localiza a linha de cabeçalho da tabela. Relatórios de despesas costumam ter
        // um bloco de identificação antes (empresa, colaborador, período).
        const kw = ["data", "documento", "descri", "valor", "outros", "hotel", "refei", "combust", "estacion", "motivo", "compet", "prestador", "fornecedor"];
        let headIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 60); i++) {
          const cells = rows[i].map((c) => String(c).trim().toLowerCase()).filter(Boolean);
          if (cells.length < 2) continue;
          const hits = cells.filter((c) => kw.some((k) => c.includes(k))).length;
          if (hits >= 3 || (hits >= 2 && cells.some((c) => c === "data" || c.startsWith("data")))) { headIdx = i; break; }
        }
        if (headIdx === -1) headIdx = rows.findIndex((r) => r.some((c) => c !== "" && c != null));
        if (headIdx === -1 || headIdx >= rows.length - 1) { setAviso("Não foi possível localizar a tabela de dados na planilha."); return; }
        // Metadados do bloco de identificação
        const m = {};
        for (let i = 0; i < headIdx; i++) {
          const r = rows[i];
          r.forEach((c, j) => {
            const t = String(c).trim().toLowerCase();
            if (!t) return;
            const prox = r.slice(j + 1, j + 4).find((x) => String(x).trim() !== "");
            if (prox == null) return;
            if (t.startsWith("colaborador")) m.colaborador = String(prox).trim();
            if (t.startsWith("centro de custo")) m.cc = String(prox).trim();
            if (t.startsWith("finalidade")) m.finalidade = String(prox).trim();
            if (t.includes("período") || t.includes("periodo")) m.periodo = String(prox).trim();
          });
        }
        const head = rows[headIdx].map((h, i) => String(h).trim() || `Coluna ${i + 1}`);
        // Remove linhas de subtotal e total do rodapé
        const isTotal = (r) => r.some((c) => /subtota|total geral|total das despesas/i.test(String(c)));
        const dados = rows.slice(headIdx + 1).filter((r) => r.some((c) => c !== "" && c != null) && !isTotal(r));
        if (dados.length === 0) { setAviso("Nenhuma linha de dados encontrada abaixo do cabeçalho."); return; }
        setArquivo(file.name); setCabecalho(head); setLinhas(dados); setMeta(m); setFormaLinhas({});
        // Auto-mapeamento por semelhança de nome
        const auto = {};
        const dict = {
          descricao: ["documento", "descrição", "descricao", "serviço", "servico", "histórico", "historico"],
          data: ["data"],
          mes: ["competência", "competencia", "mês", "mes"],
          cc: ["centro de custo", "centro custo"],
          motivo: ["motivo", "tipo de despesa"],
          acao: ["ação", "acao"],
          fornecedor: ["prestador", "fornecedor", "razão social", "razao social"],
          categoria: ["categoria"],
          nf: ["nota fiscal", "número da nota"],
        };
        Object.entries(dict).forEach(([k, terms]) => {
          const i = head.findIndex((h) => terms.some((t) => h.toLowerCase().includes(t)));
          if (i >= 0) auto[k] = i;
        });
        // Colunas de valor: coluna única de valor ou colunas por tipo de despesa
        const usados = new Set(Object.values(auto));
        const valKw = ["valor", "outros", "hotel", "refei", "combust", "estacion", "pedág", "pedag", "total"];
        const vcols = head
          .map((h, i) => ({ h: h.toLowerCase(), i }))
          .filter(({ h, i }) => !usados.has(i) && valKw.some((k) => h.includes(k)))
          .map(({ i }) => i);
        setValorCols(vcols);
        // Se o bloco de identificação traz o centro de custo, pré-seleciona o padrão do lote
        if (m.cc) {
          const cc = db.centrosCusto.find((c) => c.codigo.toLowerCase() === m.cc.toLowerCase() || c.nome.toLowerCase() === m.cc.toLowerCase());
          if (cc) setPadrao((p) => ({ ...p, ccId: cc.id }));
        }
        setMapa(auto);
        setEtapa(1);
      } catch (err) {
        setAviso("Não foi possível ler o arquivo. Verifique se é um XLSX, XLS ou CSV válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validacao = useMemo(() => {
    if (etapa < 2) return null;
    const get = (row, k) => (mapa[k] != null && mapa[k] !== "" ? row[mapa[k]] : undefined);
    const res = linhas.map((row, idx) => {
      const erros = []; const avisos = [];
      // Centro de custo: coluna mapeada ou padrão do lote
      let cc = null; let ccRaw = "";
      if (mapa.cc != null && mapa.cc !== "") {
        ccRaw = String(get(row, "cc") ?? "").trim();
        if (ccRaw) cc = db.centrosCusto.find((c) => c.codigo.toLowerCase() === ccRaw.toLowerCase() || c.nome.toLowerCase() === ccRaw.toLowerCase());
        if (ccRaw && !cc) erros.push(`Centro de custo "${ccRaw}" não encontrado`);
      }
      if (!cc && !erros.length && padrao.ccId) cc = db.centrosCusto.find((c) => c.id === padrao.ccId);
      if (!cc && !erros.length) erros.push("Centro de custo não informado (mapeie a coluna ou defina o padrão do lote)");
      if (cc && !cc.ativo) erros.push(`Centro de custo "${cc.nome}" está inativo`);
      const desc = String(get(row, "descricao") ?? "").trim();
      if (!desc) erros.push("Descrição ausente");
      // Valor: soma das colunas de valor marcadas
      let valor = 0; const tipos = [];
      valorCols.forEach((ci) => { const v = parseValor(row[ci]); if (v != null && v !== 0) { valor += v; tipos.push(cabecalho[ci]); } });
      if (valorCols.length === 0) erros.push("Nenhuma coluna de valor selecionada");
      else if (!valor || valor <= 0) erros.push("Valor inválido ou ausente");
      // Competência: coluna de mês ou derivada da data
      let mes = parseMes(get(row, "mes"));
      let dataIso = "";
      const dt = parseData(get(row, "data"));
      if (dt) { dataIso = dt.toISOString().slice(0, 10); if (!mes) mes = dt.getMonth() + 1; }
      if (!mes) erros.push("Competência inválida: mapeie a coluna de mês ou de data");
      if (dt && dt.getFullYear() !== ex) avisos.push(`Data em ${dt.getFullYear()}, exercício ativo é ${ex} (a linha será lançada em ${ex})`);
      const motivo = String(get(row, "motivo") ?? "").trim();
      // Ação: coluna própria ou prefixo do motivo (texto antes da barra)
      let acaoRaw = "";
      if (mapa.acao != null && mapa.acao !== "") acaoRaw = String(get(row, "acao") ?? "").trim();
      if (!acaoRaw && motivo && motivo.includes("/")) acaoRaw = motivo.split("/")[0].trim();
      let acao = null, acaoNova = false, acaoNome = "";
      if (acaoRaw) {
        acao = db.acoes.find((a) => mesmoNome(a.nome, acaoRaw) || normTxt(a.codigo) === normTxt(acaoRaw));
        if (acao) acaoNome = acao.nome;
        else if (criarAcoes) { acaoNova = true; acaoNome = titularizar(acaoRaw); avisos.push(`Ação "${acaoNome}" será cadastrada automaticamente`); }
        else avisos.push(`Ação "${acaoRaw}" não cadastrada (linha entrará sem ação)`);
      }
      const fornRaw = String(get(row, "fornecedor") ?? "").trim();
      let forn = null, fornNovo = false;
      if (fornRaw) {
        forn = db.fornecedores.find((f) => f.nome.toLowerCase() === fornRaw.toLowerCase());
        if (!forn) { fornNovo = true; avisos.push(criarForn ? `Fornecedor "${fornRaw}" será cadastrado automaticamente` : `Fornecedor "${fornRaw}" não cadastrado (linha entrará sem fornecedor)`); }
      }
      const catRaw = String(get(row, "categoria") ?? "").trim();
      let cat = catRaw ? db.categorias.find((c) => c.nome.toLowerCase() === catRaw.toLowerCase()) : null;
      if (catRaw && !cat) avisos.push(`Categoria "${catRaw}" não encontrada (será usada a categoria padrão do lote)`);
      const nf = String(get(row, "nf") ?? "").trim();
      if (nf && db.lancamentos.some((x) => x.status === "ativo" && x.nf && x.nf.toLowerCase() === nf.toLowerCase())) avisos.push(`Documento ${nf} já existe no sistema (possível duplicidade)`);
      const forma = formaLinhas[idx] || padrao.forma;
      return { idx, ccRaw, cc, desc, valor: valor || null, mes, dataIso, motivo, acao, acaoNova, acaoNome, tipos, fornRaw, forn, fornNovo, cat, catRaw, nf, forma, erros, avisos };
    });
    const validas = res.filter((r) => r.erros.length === 0);
    const gruposAcoes = [];
    validas.forEach((r) => {
      if (!r.acaoNova || !r.acaoNome) return;
      let g = gruposAcoes.find((x) => mesmoNome(x.ref, r.acaoNome));
      if (!g) { g = { ref: r.acaoNome, contagem: {} }; gruposAcoes.push(g); }
      g.contagem[r.acaoNome] = (g.contagem[r.acaoNome] || 0) + 1;
    });
    // Nome canônico do grupo: a grafia mais frequente entre as variações da planilha
    const acoesNovas = gruposAcoes.map((g) => Object.entries(g.contagem).sort((a, b) => b[1] - a[1])[0][0]);
    return {
      linhas: res, validas, acoesNovas,
      totalValor: validas.reduce((s, r) => s + (r.valor || 0), 0),
      totalReemb: validas.filter((r) => r.forma === "reembolso").reduce((s, r) => s + (r.valor || 0), 0),
      totalDireto: validas.filter((r) => r.forma === "pagamento_direto").reduce((s, r) => s + (r.valor || 0), 0),
      ccs: [...new Set(validas.map((r) => r.cc?.nome).filter(Boolean))],
      meses: [...new Set(validas.map((r) => r.mes))].sort((a, b) => a - b),
      duplicidades: res.filter((r) => r.avisos.some((a) => a.includes("duplicidade"))).length,
    };
  }, [etapa, linhas, mapa, valorCols, padrao, formaLinhas, db, criarForn, criarAcoes, cabecalho, ex]);

  const podeValidar = () => {
    const falta = [];
    if (mapa.descricao == null || mapa.descricao === "") falta.push("a coluna de descrição");
    if (valorCols.length === 0) falta.push("pelo menos uma coluna de valor");
    if ((mapa.mes == null || mapa.mes === "") && (mapa.data == null || mapa.data === "")) falta.push("a coluna de competência ou de data");
    if ((mapa.cc == null || mapa.cc === "") && !padrao.ccId) falta.push("a coluna de centro de custo ou o centro de custo padrão do lote");
    if (falta.length) { setAviso("Antes de validar, informe: " + falta.join(", ") + "."); return; }
    setAviso("");
    setEtapa(2);
  };

  const processar = () => {
    if (db.lotes.some((l) => l.arquivo === arquivo && !l.estornado)) {
      setConf({ msg: `Um lote com o arquivo "${arquivo}" já foi importado e não foi estornado. Deseja importar novamente mesmo assim?`, ok: () => executarImportacao() });
      return;
    }
    executarImportacao();
  };
  const executarImportacao = () => {
    const nomeArq = arquivo;
    const loteId = "LOTE-" + Date.now().toString(36).toUpperCase();
    setDb((d) => {
      let forns = [...d.fornecedores];
      let acs = [...d.acoes];
      const proxCodAcao = () => { const nums = acs.map((a) => Number(String(a.codigo).replace(/\D/g, ""))).filter((n) => isFinite(n) && n > 0); return "ACA-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0"); };
      const catFallback = d.categorias.find((c) => c.id === padrao.catId) || d.categorias.find((c) => c.nome.toLowerCase().includes("prestação")) || d.categorias[0] || null;
      const novos = validacao.validas.map((r) => {
        let fornId = r.forn?.id || null;
        if (!fornId && r.fornNovo && criarForn && r.fornRaw) {
          const existente = forns.find((f) => f.nome.toLowerCase() === r.fornRaw.toLowerCase());
          if (existente) fornId = existente.id;
          else { const nf2 = { id: uid(), nome: r.fornRaw, cnpj: "", tipo: "Importado da planilha", email: "", ativo: true }; forns.push(nf2); fornId = nf2.id; }
        }
        let acaoId = r.acao?.id || null;
        if (!acaoId && r.acaoNova && criarAcoes && r.acaoNome && !acoesExcluidas.some((n) => mesmoNome(n, r.acaoNome))) {
          const canonico = validacao.acoesNovas.find((n) => mesmoNome(n, r.acaoNome)) || r.acaoNome;
          const exA = acs.find((a) => mesmoNome(a.nome, canonico));
          if (exA) acaoId = exA.id;
          else {
            const na = { id: uid(), codigo: proxCodAcao(), nome: canonico, ccId: r.cc.id, catId: r.cat?.id || catFallback?.id || "", responsavel: meta.colaborador || "", status: "Em andamento", prioridade: "Média", objetivo: `Cadastrada automaticamente na importação do arquivo ${nomeArq}` };
            acs.push(na); acaoId = na.id;
          }
        }
        const obsPartes = [];
        if (r.motivo) obsPartes.push(`Motivo: ${r.motivo}`);
        if (r.tipos.length) obsPartes.push(`Tipo de despesa: ${r.tipos.join(" + ")}`);
        if (meta.colaborador) obsPartes.push(`Colaborador: ${meta.colaborador}`);
        return {
          id: uid(), exercicio: ex, mes: r.mes, data: r.dataIso || hoje(), ccId: r.cc.id,
          catId: r.cat?.id || catFallback?.id || "", sub: "", acaoId, fornId,
          descricao: r.desc, nf: r.nf, contrato: "", valorComprometido: 0, valorRealizado: r.valor,
          vencimento: "", responsavel: meta.colaborador || "", status: "ativo", origem: "importacao",
          formaPagamento: r.forma, loteId, obs: obsPartes.join(" | "),
          historico: [{ ts: agora(), texto: `Importado do arquivo ${nomeArq} (lote ${loteId}), forma: ${r.forma === "reembolso" ? "reembolso ao colaborador" : "pagamento direto pelo financeiro (registro para controle orçamentário)"}` }],
        };
      });
      const lote = { id: loteId, arquivo: nomeArq, data: agora(), qtd: novos.length, total: validacao.totalValor, colaborador: meta.colaborador || "", reembolso: validacao.totalReemb, direto: validacao.totalDireto, estornado: false };
      return { ...d, fornecedores: forns, acoes: acs, lancamentos: [...d.lancamentos, ...novos], lotes: [...d.lotes, lote] };
    });
    setResultado({ loteId, qtd: validacao.validas.length, total: validacao.totalValor, reemb: validacao.totalReemb, direto: validacao.totalDireto });
    setEtapa(4);
  };

  const estornar = (lote) => setConf({
    msg: `Estornar o lote ${lote.id} (${lote.qtd} lançamentos, ${fmt(lote.total)})? Os lançamentos serão cancelados, não excluídos.`,
    ok: () => setDb((d) => ({
      ...d,
      lancamentos: d.lancamentos.map((x) => x.loteId === lote.id ? { ...x, status: "cancelado", historico: [...(x.historico || []), { ts: agora(), texto: `Estornado com o lote ${lote.id}` }] } : x),
      lotes: d.lotes.map((l) => (l.id === lote.id ? { ...l, estornado: true } : l)),
    })),
  });

  const reiniciar = () => {
    setEtapa(0); setArquivo(null); setCabecalho([]); setLinhas([]); setMapa({});
    setValorCols([]); setMeta({}); setFormaLinhas({}); setResultado(null); setAcoesExcluidas([]); setAviso("");
    setPadrao({ ccId: "", catId: "", forma: "reembolso" });
    if (fileRef.current) fileRef.current.value = "";
  };
  const passos = ["Upload", "Mapeamento", "Validação", "Confirmação", "Concluído"];
  const formaLabel = (v) => (v === "pagamento_direto" ? "Pagamento direto" : "Reembolso");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 text-xs font-semibold flex-wrap">
        {passos.map((p, i) => (
          <React.Fragment key={p}>
            <span className="rounded-md px-2.5 py-1" style={{ background: i === etapa ? C.navy : i < etapa ? C.greenBg : C.grayBg, color: i === etapa ? "#fff" : i < etapa ? C.green : C.inkFaint }}>{i + 1}. {p}</span>
            {i < passos.length - 1 && <ChevronRight size={13} color={C.inkFaint} />}
          </React.Fragment>
        ))}
      </div>

      {aviso && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium flex items-start justify-between gap-3" style={{ background: C.redBg, color: C.red }}>
          <span>{aviso}</span>
          <button onClick={() => setAviso("")} className="shrink-0 mt-0.5"><X size={15} /></button>
        </div>
      )}

      {etapa === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-10">
            <FileSpreadsheet size={36} color={C.navy} />
            <p className="text-sm text-center max-w-lg" style={{ color: C.inkSoft }}>
              Selecione a planilha nos formatos XLSX, XLS ou CSV. O sistema aceita a planilha padrão de prestação de serviços e também relatórios de despesas para reembolso com bloco de identificação no topo (empresa, colaborador, período): a tabela de dados é localizada automaticamente e as linhas de subtotal e total são ignoradas.
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && lerArquivo(e.target.files[0])} />
            <div className="flex gap-2">
              <Btn onClick={() => fileRef.current?.click()}><Upload size={15} /> Selecionar arquivo</Btn>
              <Btn kind="ghost" onClick={modeloDownload}><FileSpreadsheet size={15} /> Baixar modelo padrão</Btn>
            </div>
          </div>
        </Card>
      )}

      {etapa === 1 && (
        <Card>
          <h4 className="text-sm font-bold mb-1" style={{ color: C.ink }}>Mapeamento de campos</h4>
          <p className="text-xs mb-4" style={{ color: C.inkSoft }}>
            Arquivo: <b>{arquivo}</b> · {linhas.length} linhas de dados
            {meta.colaborador ? <> · Colaborador identificado: <b>{meta.colaborador}</b></> : null}
            {meta.periodo ? <> · Período: <b>{meta.periodo}</b></> : null}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CAMPOS_IMPORT.map((c) => (
              <Field key={c.key} label={c.label} req={c.req}>
                <Select value={mapa[c.key] ?? ""} onChange={(e) => setMapa({ ...mapa, [c.key]: e.target.value === "" ? "" : Number(e.target.value) })}>
                  <option value="">Não importar</option>
                  {cabecalho.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold mb-2" style={{ color: C.ink }}>Colunas de valor <span style={{ color: C.red }}>*</span> <span className="font-normal" style={{ color: C.inkFaint }}>(marque todas que contêm valores; quando a linha tiver valor em mais de uma, eles são somados)</span></p>
            <div className="flex flex-wrap gap-2">
              {cabecalho.map((h, i) => (
                <label key={i} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer" style={{ border: `1px solid ${valorCols.includes(i) ? C.navy : C.line}`, background: valorCols.includes(i) ? C.grayBg : "#fff", color: C.ink }}>
                  <input type="checkbox" checked={valorCols.includes(i)} onChange={() => setValorCols((v) => v.includes(i) ? v.filter((x) => x !== i) : [...v, i])} />
                  {h}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-xl p-4" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
            <p className="text-xs font-bold mb-3" style={{ color: C.ink }}>Padrões do lote (usados quando a linha não traz a informação)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Centro de custo padrão" req={mapa.cc == null || mapa.cc === ""}>
                <Select value={padrao.ccId} onChange={(e) => setPadrao({ ...padrao, ccId: e.target.value })}>
                  <option value="">Selecione</option>
                  {db.centrosCusto.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
                </Select>
              </Field>
              <Field label="Categoria padrão">
                <Select value={padrao.catId} onChange={(e) => setPadrao({ ...padrao, catId: e.target.value })}>
                  <option value="">Automática</option>
                  {db.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </Field>
              <Field label="Forma de pagamento padrão">
                <Select value={padrao.forma} onChange={(e) => setPadrao({ ...padrao, forma: e.target.value })}>
                  <option value="reembolso">Reembolso ao colaborador</option>
                  <option value="pagamento_direto">Pagamento direto do financeiro</option>
                </Select>
              </Field>
            </div>
            <p className="text-[11px] mt-2" style={{ color: C.inkFaint }}>
              Reembolso: despesa paga pelo colaborador, a restituir. Pagamento direto: paga pelo financeiro, registrada aqui apenas para controle orçamentário. Nos dois casos o valor consome o orçamento do centro de custo. A forma pode ser ajustada linha a linha na próxima etapa.
            </p>
          </div>

          <label className="flex items-center gap-2 mt-4 text-xs font-medium" style={{ color: C.ink }}>
            <input type="checkbox" checked={criarForn} onChange={(e) => setCriarForn(e.target.checked)} />
            Cadastrar automaticamente fornecedores não encontrados
          </label>
          <label className="flex items-center gap-2 mt-2 text-xs font-medium" style={{ color: C.ink }}>
            <input type="checkbox" checked={criarAcoes} onChange={(e) => setCriarAcoes(e.target.checked)} />
            Cadastrar automaticamente ações a partir do motivo (texto antes da barra) e vincular os lançamentos a elas
          </label>
          <div className="mt-4 flex justify-between">
            <Btn kind="ghost" onClick={reiniciar}>Voltar</Btn>
            <Btn onClick={podeValidar}>Validar dados <ChevronRight size={15} /></Btn>
          </div>
        </Card>
      )}

      {etapa === 2 && validacao && (
        <Card>
          <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Validação</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              ["Linhas válidas", validacao.validas.length, C.green],
              ["Linhas com erro", validacao.linhas.length - validacao.validas.length, validacao.linhas.length - validacao.validas.length > 0 ? C.red : C.inkFaint],
              ["Possíveis duplicidades", validacao.duplicidades, validacao.duplicidades > 0 ? C.yellow : C.inkFaint],
              ["Reembolso", fmt(validacao.totalReemb), C.navy],
              ["Pagamento direto", fmt(validacao.totalDireto), C.gray],
            ].map(([l, v, cor]) => (
              <div key={l} className="rounded-xl p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                <div className="text-[10px] font-semibold uppercase" style={{ color: C.inkFaint }}>{l}</div>
                <div className="text-base font-bold tabular-nums" style={{ color: cor }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="max-h-96 overflow-auto rounded-xl" style={{ border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: C.bg }}>
                  {["Nº", "Data / mês", "Descrição", "Motivo", "Ação", "Valor", "Forma de pagamento", "Situação"].map((h) => <th key={h} className="text-left px-3 py-2 font-semibold sticky top-0" style={{ color: C.inkSoft, background: C.bg }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {validacao.linhas.map((r) => (
                  <tr key={r.idx} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-1.5" style={{ color: C.inkFaint }}>{r.idx + 1}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: C.inkSoft }}>{r.dataIso ? r.dataIso.split("-").reverse().join("/") : ""}{r.mes ? ` (${MESES[r.mes - 1]})` : ""}</td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate" style={{ color: C.ink }} title={r.desc}>{r.desc || "-"}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate" style={{ color: C.inkSoft }} title={r.motivo}>{r.motivo || "-"}</td>
                    <td className="px-3 py-1.5 max-w-[150px] truncate whitespace-nowrap" style={{ color: C.navy }} title={r.acaoNome}>{r.acaoNome || "-"}</td>
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap" style={{ color: C.ink }}>{r.valor != null ? fmt2(r.valor) : "-"}</td>
                    <td className="px-3 py-1.5">
                      <select value={formaLinhas[r.idx] || padrao.forma} onChange={(e) => setFormaLinhas({ ...formaLinhas, [r.idx]: e.target.value })}
                        className="rounded-md px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${C.line}`, background: "#fff", color: (formaLinhas[r.idx] || padrao.forma) === "pagamento_direto" ? C.gray : C.navy }}>
                        <option value="reembolso">Reembolso</option>
                        <option value="pagamento_direto">Pagamento direto</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      {r.erros.length > 0 ? <span className="font-medium" style={{ color: C.red }}>{r.erros.join("; ")}</span>
                        : r.avisos.length > 0 ? <span className="font-medium" style={{ color: C.yellow }}>{r.avisos.join("; ")}</span>
                          : <span className="font-medium" style={{ color: C.green }}>Válida</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: C.inkFaint }}>Marque como Pagamento direto as linhas pagas pelo financeiro: elas entram apenas para controle orçamentário e ficam fora do total a reembolsar. Linhas com erro serão ignoradas na importação.</p>
          <div className="mt-4 flex justify-between">
            <Btn kind="ghost" onClick={() => setEtapa(1)}>Voltar ao mapeamento</Btn>
            <Btn disabled={validacao.validas.length === 0} onClick={() => setEtapa(3)}>Revisar e confirmar <ChevronRight size={15} /></Btn>
          </div>
        </Card>
      )}

      {etapa === 3 && validacao && (
        <Card>
          <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Confirmação da importação</h4>
          <div className="rounded-xl p-4 text-sm flex flex-col gap-1.5" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink }}>
            <span><b>{validacao.validas.length}</b> lançamentos serão criados como valor realizado, no total de <b>{fmt2(validacao.totalValor)}</b>.</span>
            <span>A reembolsar ao colaborador{meta.colaborador ? ` (${meta.colaborador})` : ""}: <b>{fmt2(validacao.totalReemb)}</b> · Pagamento direto do financeiro (somente controle orçamentário): <b>{fmt2(validacao.totalDireto)}</b></span>
            <span>Competências: <b>{validacao.meses.map((mm) => MESES[mm - 1]).join(", ")}</b> · Exercício {ex}</span>
            <span>Centros de custo: <b>{validacao.ccs.join(", ")}</b></span>
            {validacao.acoesNovas.length > 0 && (
              <div className="mt-1">
                <p className="font-semibold mb-1.5">Ações novas detectadas nos motivos. Desmarque as que não devem ser cadastradas (os lançamentos delas entram sem ação):</p>
                <div className="flex flex-wrap gap-2">
                  {validacao.acoesNovas.map((nome) => {
                    const ativa = !acoesExcluidas.some((n) => mesmoNome(n, nome));
                    return (
                      <label key={nome} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer" style={{ border: `1px solid ${ativa ? C.navy : C.line}`, background: ativa ? C.grayBg : "#fff", color: C.ink }}>
                        <input type="checkbox" checked={ativa} onChange={() => setAcoesExcluidas((v) => ativa ? [...v, nome] : v.filter((n) => !mesmoNome(n, nome)))} />
                        {nome}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {validacao.duplicidades > 0 && <span style={{ color: C.yellow }}><b>{validacao.duplicidades}</b> linha(s) com possível duplicidade de documento serão importadas mesmo assim.</span>}
          </div>
          <div className="mt-4 flex justify-between">
            <Btn kind="ghost" onClick={() => setEtapa(2)}>Voltar</Btn>
            <Btn kind="green" onClick={processar}><Check size={15} /> Confirmar importação</Btn>
          </div>
        </Card>
      )}

      {etapa === 4 && resultado && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="rounded-full p-3" style={{ background: C.greenBg }}><Check size={26} color={C.green} /></div>
            <p className="text-sm font-bold" style={{ color: C.ink }}>Importação concluída</p>
            <p className="text-sm text-center" style={{ color: C.inkSoft }}>
              {resultado.qtd} lançamentos criados no lote <b>{resultado.loteId}</b>, total de {fmt2(resultado.total)}.<br />
              Reembolso: {fmt2(resultado.reemb)} · Pagamento direto: {fmt2(resultado.direto)}
            </p>
            <Btn kind="ghost" onClick={reiniciar}><Upload size={15} /> Importar outra planilha</Btn>
          </div>
        </Card>
      )}

      <Card>
        <h4 className="text-sm font-bold mb-3" style={{ color: C.ink }}>Histórico de importações</h4>
        {db.lotes.length === 0 ? <p className="text-xs" style={{ color: C.inkFaint }}>Nenhum lote importado até o momento.</p> : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: C.bg }}>
                {["Lote", "Arquivo", "Colaborador", "Data", "Lançamentos", "Reembolso", "Pag. direto", "Total", "Situação", ""].map((h) => <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: C.inkSoft }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...db.lotes].reverse().map((l) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: C.ink }}>{l.id}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: C.inkSoft }} title={l.arquivo}>{l.arquivo}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.inkSoft }}>{l.colaborador || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.inkFaint }}>{l.data}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: C.ink }}>{l.qtd}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: C.navy }}>{l.reembolso != null ? fmt2(l.reembolso) : "-"}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: C.gray }}>{l.direto != null ? fmt2(l.direto) : "-"}</td>
                  <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: C.ink }}>{fmt2(l.total)}</td>
                  <td className="px-3 py-2">{l.estornado ? <Chip text="Estornado" bg={C.grayBg} fg={C.gray} /> : <Chip text="Ativo" bg={C.greenBg} fg={C.green} />}</td>
                  <td className="px-3 py-2 text-right">{!l.estornado && <Btn small kind="danger" onClick={() => estornar(l)}><RotateCcw size={13} /> Estornar lote</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {conf && <ConfirmBox msg={conf.msg} onOk={conf.ok} onClose={() => setConf(null)} />}
    </div>
  );
}

/* ============================================================
   CADASTROS
============================================================ */
function Cadastros({ db, setDb }) {
  const [aba, setAba] = useState("cc");
  const [form, setForm] = useState(null);
  const abas = [["cc", "Centros de custo"], ["cat", "Categorias"], ["forn", "Fornecedores"], ["acao", "Ações"]];

  const salvar = (chave, item) => {
    setDb((d) => {
      const listaKey = { cc: "centrosCusto", cat: "categorias", forn: "fornecedores", acao: "acoes" }[chave];
      const lista = d[listaKey];
      const existe = lista.some((x) => x.id === item.id);
      return { ...d, [listaKey]: existe ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item] };
    });
    setForm(null);
  };
  const toggleAtivo = (chave, id) => {
    const listaKey = { cc: "centrosCusto", forn: "fornecedores" }[chave];
    setDb((d) => ({ ...d, [listaKey]: d[listaKey].map((x) => (x.id === id ? { ...x, ativo: !x.ativo } : x)) }));
  };

  const th = (t, right) => <th className={`px-3 py-2.5 font-semibold text-xs ${right ? "text-right" : "text-left"}`} style={{ color: C.inkSoft }}>{t}</th>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {abas.map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} className="rounded-lg px-3.5 py-1.5 text-sm font-semibold" style={{ background: aba === k ? C.navy : "#fff", color: aba === k ? "#fff" : C.inkSoft, border: `1px solid ${aba === k ? C.navy : C.line}` }}>{l}</button>
        ))}
        <div className="ml-auto"><Btn onClick={() => setForm({ novo: true })}><Plus size={15} /> Novo cadastro</Btn></div>
      </div>

      <Card pad={false} className="overflow-x-auto">
        {aba === "cc" && (
          db.centrosCusto.length === 0 ? <Empty texto="Nenhum centro de custo cadastrado. Os centros de custo são obrigatórios em todos os lançamentos." /> :
            <table className="w-full">
              <thead><tr style={{ background: C.bg }}>{th("Código")}{th("Nome")}{th("Área")}{th("Gestor")}{th("Departamento")}{th("Status")}{th("", true)}</tr></thead>
              <tbody>
                {db.centrosCusto.map((c) => (
                  <tr key={c.id} className="text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: C.navy }}>{c.codigo}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: C.ink }}>{c.nome}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{c.area}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{c.gestor}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{c.departamento}</td>
                    <td className="px-3 py-2"><Chip text={c.ativo ? "Ativo" : "Inativo"} bg={c.ativo ? C.greenBg : C.grayBg} fg={c.ativo ? C.green : C.gray} /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Btn small kind="ghost" onClick={() => setForm(c)}><Pencil size={13} /> Editar</Btn>{" "}
                      <Btn small kind="ghost" onClick={() => toggleAtivo("cc", c.id)}>{c.ativo ? "Inativar" : "Reativar"}</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
        {aba === "cat" && (
          db.categorias.length === 0 ? <Empty texto="Nenhuma categoria cadastrada." /> :
            <table className="w-full">
              <thead><tr style={{ background: C.bg }}>{th("Categoria")}{th("Subcategorias")}{th("", true)}</tr></thead>
              <tbody>
                {db.categorias.map((c) => (
                  <tr key={c.id} className="text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: C.ink }}>{c.nome}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{c.subs.length ? c.subs.join(", ") : "-"}</td>
                    <td className="px-3 py-2 text-right"><Btn small kind="ghost" onClick={() => setForm(c)}><Pencil size={13} /> Editar</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
        {aba === "forn" && (
          db.fornecedores.length === 0 ? <Empty texto="Nenhum fornecedor cadastrado." /> :
            <table className="w-full">
              <thead><tr style={{ background: C.bg }}>{th("Razão social")}{th("CPF / CNPJ")}{th("Tipo de serviço")}{th("E-mail")}{th("Status")}{th("", true)}</tr></thead>
              <tbody>
                {db.fornecedores.map((f) => (
                  <tr key={f.id} className="text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2 font-semibold" style={{ color: C.ink }}>{f.nome}</td>
                    <td className="px-3 py-2 text-xs font-mono" style={{ color: C.inkSoft }}>{f.cnpj || "-"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{f.tipo || "-"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{f.email || "-"}</td>
                    <td className="px-3 py-2"><Chip text={f.ativo ? "Ativo" : "Inativo"} bg={f.ativo ? C.greenBg : C.grayBg} fg={f.ativo ? C.green : C.gray} /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Btn small kind="ghost" onClick={() => setForm(f)}><Pencil size={13} /> Editar</Btn>{" "}
                      <Btn small kind="ghost" onClick={() => toggleAtivo("forn", f.id)}>{f.ativo ? "Inativar" : "Reativar"}</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
        {aba === "acao" && (
          db.acoes.length === 0 ? <Empty texto="Nenhuma ação cadastrada." /> :
            <table className="w-full">
              <thead><tr style={{ background: C.bg }}>{th("Código")}{th("Nome")}{th("Centro de custo")}{th("Responsável")}{th("Prioridade")}{th("Status")}{th("", true)}</tr></thead>
              <tbody>
                {db.acoes.map((a) => (
                  <tr key={a.id} className="text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: C.navy }}>{a.codigo}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: C.ink }}>{a.nome}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{db.centrosCusto.find((c) => c.id === a.ccId)?.nome || "-"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{a.responsavel || "-"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{a.prioridade || "-"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkSoft }}>{a.status}</td>
                    <td className="px-3 py-2 text-right"><Btn small kind="ghost" onClick={() => setForm(a)}><Pencil size={13} /> Editar</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </Card>

      {form && <CadForm aba={aba} db={db} item={form.novo ? null : form} onSave={(item) => salvar(aba, item)} onClose={() => setForm(null)} />}
    </div>
  );
}

function CadForm({ aba, db, item, onSave, onClose }) {
  const defaults = {
    cc: { id: uid(), codigo: "", nome: "", area: "", gestor: "", email: "", departamento: "", ativo: true },
    cat: { id: uid(), nome: "", subs: [] },
    forn: { id: uid(), nome: "", cnpj: "", tipo: "", email: "", ativo: true },
    acao: { id: uid(), codigo: "", nome: "", ccId: "", catId: "", responsavel: "", status: "Planejamento", prioridade: "Média", objetivo: "" },
  };
  const [f, setF] = useState(item || defaults[aba]);
  const [subsTxt, setSubsTxt] = useState(aba === "cat" ? (item?.subs || []).join(", ") : "");
  const [erro, setErro] = useState("");
  const titulos = { cc: "centro de custo", cat: "categoria", forn: "fornecedor", acao: "ação" };

  const salvar = () => {
    if (aba === "cc" && (!f.codigo.trim() || !f.nome.trim())) return setErro("Código e nome são obrigatórios.");
    if (aba === "cc" && db.centrosCusto.some((c) => c.id !== f.id && c.codigo.toLowerCase() === f.codigo.trim().toLowerCase())) return setErro("Já existe um centro de custo com este código.");
    if (aba === "cat" && !f.nome.trim()) return setErro("Nome da categoria é obrigatório.");
    if (aba === "forn" && !f.nome.trim()) return setErro("Razão social é obrigatória.");
    if (aba === "acao" && (!f.codigo.trim() || !f.nome.trim() || !f.ccId)) return setErro("Código, nome e centro de custo são obrigatórios.");
    const final = aba === "cat" ? { ...f, subs: subsTxt.split(",").map((s) => s.trim()).filter(Boolean) } : f;
    onSave(final);
  };

  return (
    <Modal title={`${item ? "Editar" : "Novo"} ${titulos[aba]}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        {aba === "cc" && (<>
          <Field label="Código" req><Input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="Ex.: MKT-01" /></Field>
          <Field label="Nome" req><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="Área responsável"><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Field>
          <Field label="Departamento"><Input value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })} /></Field>
          <Field label="Gestor responsável"><Input value={f.gestor} onChange={(e) => setF({ ...f, gestor: e.target.value })} /></Field>
          <Field label="E-mail do responsável"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </>)}
        {aba === "cat" && (<>
          <Field label="Nome da categoria" req span><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="Subcategorias (separadas por vírgula)" span><Input value={subsTxt} onChange={(e) => setSubsTxt(e.target.value)} placeholder="Ex.: Mídia, Fotografia, Eventos" /></Field>
        </>)}
        {aba === "forn" && (<>
          <Field label="Razão social" req><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="CPF ou CNPJ"><Input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></Field>
          <Field label="Tipo de serviço"><Input value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </>)}
        {aba === "acao" && (<>
          <Field label="Código" req><Input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="Ex.: ACA-006" /></Field>
          <Field label="Nome" req><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
          <Field label="Centro de custo" req>
            <Select value={f.ccId} onChange={(e) => setF({ ...f, ccId: e.target.value })}>
              <option value="">Selecione</option>
              {db.centrosCusto.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
            </Select>
          </Field>
          <Field label="Responsável"><Input value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {["Planejamento", "Em andamento", "Concluída", "Atrasada", "Cancelada"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}>
              {["Alta", "Média", "Baixa"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Objetivo" span><Input value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} /></Field>
        </>)}
      </div>
      {erro && <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: C.redBg, color: C.red }}>{erro}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Btn kind="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={salvar}><Check size={15} /> Salvar</Btn>
      </div>
    </Modal>
  );
}

/* ============================================================
   APP
============================================================ */
const STORAGE_KEY = "sgo-db-v1";

export default function App() {
  const [db, setDb] = useState(null);
  const [tela, setTela] = useState("dash");
  const [salvo, setSalvo] = useState(true);
  const [conf, setConf] = useState(null);
  const carregouRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const st = getStore();
        if (st) {
          const r = await st.get(STORAGE_KEY);
          if (r && r.value) { setDb(JSON.parse(r.value)); carregouRef.current = true; return; }
        }
      } catch (e) { /* chave inexistente: primeiro acesso */ }
      setDb(seedDb());
      carregouRef.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!db || !carregouRef.current) return;
    setSalvo(false);
    const t = setTimeout(async () => {
      try { const st = getStore(); if (st) await st.set(STORAGE_KEY, JSON.stringify(db)); setSalvo(true); }
      catch (e) { console.error("Falha ao salvar", e); }
    }, 600);
    return () => clearTimeout(t);
  }, [db]);

  if (!db) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <p className="text-sm font-medium" style={{ color: C.inkSoft }}>Carregando o sistema de gestão orçamentária...</p>
    </div>
  );

  const menu = [
    ["dash", "Dashboard executivo", LayoutDashboard],
    ["plan", "Planejamento", Wallet],
    ["lanc", "Lançamentos", ListPlus],
    ["acoes", "Ações", CalendarRange],
    ["imp", "Importação", Upload],
    ["cad", "Cadastros", FolderCog],
  ];
  const titulos = { dash: "Dashboard executivo", plan: "Planejamento orçamentário", lanc: "Lançamentos", acoes: "Cronograma de ações", imp: "Importação de prestação de serviços", cad: "Cadastros mestres" };

  const restaurarExemplo = () => setConf({ msg: "Substituir todos os dados atuais pelos dados de exemplo?", ok: () => setDb(seedDb()) });
  const zerarValores = () => setConf({
    msg: "Zerar todos os valores? Linhas de orçamento, lançamentos e lotes de importação serão apagados. Os cadastros (centros de custo, categorias, fornecedores e ações) serão mantidos.",
    ok: () => setDb((d) => ({ ...d, orcamento: [], lancamentos: [], lotes: [] })),
  });
  const limparTudo = () => setConf({ msg: "Apagar todos os dados e começar do zero? Esta ação não pode ser desfeita.", ok: () => setDb(dbVazio()) });
  const backupRef = useRef(null);
  const exportarBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-orcamento-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importarBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        if (!dados || !Array.isArray(dados.lancamentos) || !Array.isArray(dados.centrosCusto)) throw new Error("estrutura");
        setConf({ msg: `Substituir todos os dados atuais pelo backup "${file.name}"?`, ok: () => setDb(dados) });
      } catch {
        setConf({ msg: "Arquivo de backup inválido. Selecione um JSON exportado por este sistema.", ok: () => {}, okLabel: "Entendi" });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex" style={{ background: C.bg, fontFamily: "'Archivo', system-ui, -apple-system, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap'); input,select,button{font-family:inherit} .tabular-nums{font-variant-numeric:tabular-nums}`}</style>

      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col" style={{ background: C.navyDeep, minHeight: "100vh" }}>
        <div className="px-5 py-6">
          <div className="text-white font-extrabold text-base leading-tight tracking-tight">Gestão Orçamentária</div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: "#8FA6BD" }}>Controle de prestação de serviços</div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {menu.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTela(k)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-left transition-colors"
              style={{ background: tela === k ? C.navySoft : "transparent", color: tela === k ? "#fff" : "#9FB3C8" }}>
              <Icon size={16} /> {l}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-4 py-5 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.navySoft}` }}>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "#8FA6BD" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: salvo ? "#5FBF8F" : "#E0B23E" }} />
            {salvo ? "Dados salvos automaticamente" : "Salvando..."}
          </div>
          <button onClick={restaurarExemplo} className="text-left text-[11px] font-medium hover:underline" style={{ color: "#9FB3C8" }}>Restaurar dados de exemplo</button>
          <button onClick={zerarValores} className="text-left text-[11px] font-medium hover:underline" style={{ color: "#9FB3C8" }}>Zerar valores (manter cadastros)</button>
          <button onClick={exportarBackup} className="text-left text-[11px] font-medium hover:underline" style={{ color: "#9FB3C8" }}>Exportar backup (JSON)</button>
          <button onClick={() => backupRef.current?.click()} className="text-left text-[11px] font-medium hover:underline" style={{ color: "#9FB3C8" }}>Importar backup</button>
          <input ref={backupRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { importarBackup(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={limparTudo} className="text-left text-[11px] font-medium hover:underline flex items-center gap-1" style={{ color: "#C98A8D" }}><Trash2 size={11} /> Limpar todos os dados</button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 min-w-0">
        <header className="flex items-center justify-between px-7 py-5" style={{ borderBottom: `1px solid ${C.line}`, background: C.card }}>
          <h1 className="text-lg font-extrabold tracking-tight" style={{ color: C.ink }}>{titulos[tela]}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: C.inkSoft }}>Exercício</span>
            <Select value={db.exercicio} onChange={(e) => setDb({ ...db, exercicio: Number(e.target.value) })} style={{ ...inputStyle, width: 100 }}>
              {[2024, 2025, 2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </header>
        <div className="p-7">
          {tela === "dash" && <Dashboard db={db} />}
          {tela === "plan" && <Planejamento db={db} setDb={setDb} />}
          {tela === "lanc" && <Lancamentos db={db} setDb={setDb} />}
          {tela === "acoes" && <Acoes db={db} setDb={setDb} />}
          {tela === "imp" && <Importacao db={db} setDb={setDb} />}
          {tela === "cad" && <Cadastros db={db} setDb={setDb} />}
        </div>
      </main>
      {conf && <ConfirmBox msg={conf.msg} onOk={conf.ok} okLabel={conf.okLabel || "Confirmar"} onClose={() => setConf(null)} />}
    </div>
  );
}
