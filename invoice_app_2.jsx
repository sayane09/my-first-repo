import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Trash2, Printer, Save, Building2, Tag, Copy, X, Check } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 9);
const yen = (n) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");
const numFmt = (n) => Math.round(n || 0).toLocaleString("ja-JP");
const yenBig = (n) => "¥ " + numFmt(n) + " -";
const todayStr = () => new Date().toISOString().slice(0, 10);
const formatDateJP = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}年${m}月${d}日`;
};
const MIN_ROWS = 9;

const emptyCompany = {
  name: "",
  zip: "",
  address: "",
  tel: "",
  regNo: "",
  bankName: "",
  bankBranch: "",
  bankType: "普通",
  bankAccount: "",
  bankHolder: "",
};

function makeDraft(clientId, invoiceNumber) {
  return {
    id: uid(),
    clientId: clientId || null,
    invoiceNumber: invoiceNumber || "",
    issueDate: todayStr(),
    subject: "",
    items: [],
    taxMode: "ex10", // ex10 | in10 | exempt
    notes: "",
  };
}

function calcTotals(items, taxMode) {
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  let tax = 0, total = subtotal;
  if (taxMode === "ex10") {
    tax = Math.floor(subtotal * 0.1);
    total = subtotal + tax;
  } else if (taxMode === "in10") {
    tax = Math.floor(subtotal - subtotal / 1.1);
    total = subtotal;
  }
  return { subtotal, tax, total };
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildInvoiceHTML({ company, client, draft, totals }) {
  const { subtotal, tax, total } = totals;
  const rows = draft.items.map((it) => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:center;">${escapeHtml(it.qty)} ${escapeHtml(it.unit || "本")}</td>
      <td style="text-align:right;">${numFmt(it.price)}</td>
      <td style="text-align:right;">${numFmt((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
    </tr>`).join("");
  const fillerCount = Math.max(0, MIN_ROWS - draft.items.length);
  const filler = Array.from({ length: fillerCount })
    .map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<title>請求書_${escapeHtml(draft.invoiceNumber || "")}</title>
<style>
  body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', sans-serif; background:#f2f1e7; margin:0; padding:30px; color:#111; }
  .sheet { background:#fff; max-width:780px; margin:0 auto; border:1px solid #cfcbb6; border-top:6px solid #33513a; border-radius:4px; padding:34px 42px; }
  .header-row { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #e7ece3; padding-bottom:16px; margin-bottom:24px; }
  .title-wrap { display:flex; align-items:center; gap:12px; }
  .title-accent { width:6px; height:32px; background:#9c2b22; border-radius:2px; }
  .title { font-size:27px; font-weight:700; letter-spacing:0.1em; color:#33513a; margin:0; }
  .meta { text-align:right; font-size:12.5px; color:#333; }
  .meta div { margin-top:3px; }
  .two-col { display:flex; justify-content:space-between; gap:30px; margin-bottom:20px; }
  .client-name { font-size:19px; font-weight:700; border-left:4px solid #33513a; padding:2px 0 2px 10px; display:inline-block; margin-bottom:10px; }
  .lead { font-size:12.5px; color:#6e6c5c; margin-bottom:14px; }
  .amount-badge { display:flex; align-items:center; gap:14px; }
  .amount-value { font-size:21px; font-weight:700; background:#e7ece3; color:#33513a; padding:6px 16px; border-radius:6px; }
  .issuer { font-size:12.5px; line-height:1.7; }
  .issuer .name { font-weight:700; font-size:13.5px; }
  .subject { font-size:13px; margin:4px 0 16px; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th { background:#33513a; color:#fff; font-size:12px; text-align:left; padding:8px; border:1px solid #33513a; }
  td { padding:6px 8px; border:1px solid #ada98f; font-size:13px; height:28px; }
  .totals { margin-left:auto; width:280px; border:1.5px solid #33513a; margin-top:10px; }
  .totals div { display:flex; justify-content:space-between; padding:7px 10px; font-size:13px; border-bottom:1px solid #cfcbb6; color:#6e6c5c; }
  .totals div:last-child { border-bottom:none; font-weight:700; color:#33513a; background:#e7ece3; font-size:15px; }
  .notes { margin-top:20px; font-size:12.5px; white-space:pre-line; }
  .bank { margin-top:24px; padding-top:12px; border-top:1px solid #cfcbb6; font-size:12px; color:#333; }
  .print-btn { display:block; margin:0 auto 20px; padding:10px 22px; background:#33513a; color:#fff; border:none; border-radius:4px; font-size:14px; cursor:pointer; }
  @media print { .no-print { display:none !important; } body{ background:#fff; padding:0; } .sheet{ border:none; } }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 印刷する / PDFとして保存する</button>
  <div class="sheet">
    <div class="header-row">
      <div class="title-wrap"><span class="title-accent"></span><p class="title">請求書</p></div>
      <div class="meta">
        <div>発行日：${formatDateJP(draft.issueDate)}</div>
        <div>請求番号：${escapeHtml(draft.invoiceNumber || "")}</div>
      </div>
    </div>
    <div class="two-col">
      <div>
        <p class="client-name">${escapeHtml(client.name)}　${escapeHtml(client.honorific || "様")}</p>
        <div class="lead">下記のとおりご請求申し上げます。</div>
        <div class="amount-badge"><span>ご請求金額</span><span class="amount-value">${yenBig(total)}</span></div>
      </div>
      <div class="issuer">
        ${company.name ? `<div class="name">${escapeHtml(company.name)}</div>` : ""}
        ${company.zip ? `<div>〒${escapeHtml(company.zip)}</div>` : ""}
        ${company.address ? `<div>${escapeHtml(company.address)}</div>` : ""}
        ${company.tel ? `<div>TEL: ${escapeHtml(company.tel)}</div>` : ""}
        ${company.regNo ? `<div>登録番号: ${escapeHtml(company.regNo)}</div>` : ""}
      </div>
    </div>
    ${draft.subject ? `<div class="subject">件名：${escapeHtml(draft.subject)}</div>` : ""}
    <table>
      <thead><tr><th style="width:46%">品番・品名</th><th style="width:16%">数量</th><th style="width:18%">単価</th><th style="width:16%">金額</th></tr></thead>
      <tbody>${rows}${filler}</tbody>
    </table>
    <div class="totals">
      <div><span>小計</span><span>${numFmt(subtotal)}</span></div>
      <div><span>消費税</span><span>${numFmt(tax)}</span></div>
      <div><span>合計</span><span>${numFmt(total)}</span></div>
    </div>
    ${draft.notes ? `<div class="notes">備考：${escapeHtml(draft.notes)}</div>` : ""}
    ${company.bankName ? `<div class="bank"><b>お振込先：</b><br/>銀行名：${escapeHtml(company.bankName)}　支店名：${escapeHtml(company.bankBranch)}支店　口座番号：（${escapeHtml(company.bankType)}）${escapeHtml(company.bankAccount)}　口座名義：${escapeHtml(company.bankHolder)}</div>` : ""}
  </div>
</body>
</html>`;
}

const SEED_COMPANY = {
  name: "奥林さや香",
  zip: "515-0073",
  address: "三重県松阪市殿町1562-7",
  tel: "090-9908-2485",
  regNo: "",
  bankName: "楽天銀行",
  bankBranch: "アロハ",
  bankType: "普通",
  bankAccount: "2104062",
  bankHolder: "オクバヤシ サヤカ",
};
const SEED_CLIENT = { id: "seed-client-1", name: "上原太一", honorific: "様", address: "", contact: "" };
const SEED_INVOICE = {
  id: "seed-invoice-1",
  clientId: "seed-client-1",
  invoiceNumber: "20250401-002",
  issueDate: "2025-04-30",
  subject: "",
  items: [{ id: "seed-item-1", name: "[2025/04/24 納品分] P075_橋渡し攻略動画", qty: 1, unit: "本", price: 10000 }],
  taxMode: "ex10",
  notes: "",
  createdAt: Date.parse("2025-04-30"),
};

async function loadKey(key) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch (e) {
    return null;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    /* best effort */
  }
}

export default function InvoiceApp() {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(emptyCompany);
  const [clients, setClients] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [draft, setDraft] = useState(makeDraft(null, ""));
  const [showClientForm, setShowClientForm] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [flash, setFlash] = useState("");
  const sheetRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [c, cl, cat, inv] = await Promise.all([
        loadKey("company"),
        loadKey("clients"),
        loadKey("catalog"),
        loadKey("invoices"),
      ]);
      const nothingSaved = !c && (!cl || cl.length === 0) && (!inv || inv.length === 0);
      if (nothingSaved) {
        setCompany(SEED_COMPANY);
        setClients([SEED_CLIENT]);
        setInvoices([SEED_INVOICE]);
        if (cat) setCatalog(cat);
      } else {
        if (c) setCompany(c);
        if (cl) setClients(cl);
        if (cat) setCatalog(cat);
        if (inv) setInvoices(inv);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) saveKey("company", company); }, [company, loading]);
  useEffect(() => { if (!loading) saveKey("clients", clients); }, [clients, loading]);
  useEffect(() => { if (!loading) saveKey("catalog", catalog); }, [catalog, loading]);
  useEffect(() => { if (!loading) saveKey("invoices", invoices); }, [invoices, loading]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const clientInvoices = useMemo(
    () => invoices.filter((i) => i.clientId === selectedClientId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [invoices, selectedClientId]
  );

  const genInvoiceNumber = useCallback(
    (clientId) => {
      const count = invoices.filter((i) => i.clientId === clientId).length + 1;
      return `INV-${todayStr().replace(/-/g, "")}-${String(count).padStart(2, "0")}`;
    },
    [invoices]
  );

  function selectClient(id) {
    setSelectedClientId(id);
    setDraft(makeDraft(id, genInvoiceNumber(id)));
    setFlash("");
  }

  function addClient(data) {
    const c = { id: uid(), honorific: "様", ...data };
    setClients((prev) => [...prev, c]);
    setShowClientForm(false);
    selectClient(c.id);
  }
  function updateClient(id, patch) {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeClient(id) {
    if (!window.confirm("このクライアントを削除しますか？関連する保存済み請求書は残ります。")) return;
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (selectedClientId === id) {
      setSelectedClientId(null);
      setDraft(makeDraft(null, ""));
    }
  }

  function addCatalogItem(data) {
    setCatalog((prev) => [...prev, { id: uid(), ...data }]);
  }
  function updateCatalogItem(id, patch) {
    setCatalog((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCatalogItem(id) {
    setCatalog((prev) => prev.filter((c) => c.id !== id));
  }

  function addItemRow(fromCatalog) {
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          id: uid(),
          name: fromCatalog ? fromCatalog.name : "",
          qty: 1,
          unit: fromCatalog && fromCatalog.unit ? fromCatalog.unit : "本",
          price: fromCatalog ? fromCatalog.price : 0,
        },
      ],
    }));
  }
  function updateItemRow(id, patch) {
    setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function removeItemRow(id) {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  }

  function saveInvoice() {
    if (!selectedClientId) return;
    const record = { ...draft, clientId: selectedClientId, createdAt: Date.now() };
    setInvoices((prev) => {
      const exists = prev.some((i) => i.id === record.id);
      return exists ? prev.map((i) => (i.id === record.id ? record : i)) : [...prev, record];
    });
    setFlash("保存しました");
    setTimeout(() => setFlash(""), 2200);
  }

  function loadInvoice(inv) {
    setDraft({ ...inv });
    setFlash("請求書を読み込みました（上の内容が更新されました）");
    if (sheetRef.current) sheetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setFlash(""), 2600);
  }

  function downloadInvoiceHTML() {
    if (!selectedClient) return;
    const html = buildInvoiceHTML({ company, client: selectedClient, draft, totals: { subtotal, tax, total } });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `請求書_${draft.invoiceNumber || "draft"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFlash("印刷用ファイルをダウンロードしました。開いて印刷ボタンを押してください。");
    setTimeout(() => setFlash(""), 3400);
  }

  function duplicateLatest() {
    if (!clientInvoices.length) return;
    const latest = clientInvoices[0];
    setDraft({
      ...makeDraft(selectedClientId, genInvoiceNumber(selectedClientId)),
      subject: latest.subject,
      items: latest.items.map((it) => ({ ...it, id: uid() })),
      taxMode: latest.taxMode,
    });
  }

  function removeSavedInvoice(id) {
    if (!window.confirm("この保存済み請求書を削除しますか？")) return;
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }

  const { subtotal, tax, total } = calcTotals(draft.items, draft.taxMode);

  return (
    <div className="ia-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=JetBrains+Mono:wght@500;600&display=swap');

        .ia-root {
          --paper: #F2F1E7;
          --sheet: #FBFAF4;
          --ink: #262A20;
          --ink-soft: #6E6C5C;
          --line: #CFCBB6;
          --line-strong: #ADA98F;
          --moss: #33513A;
          --moss-soft: #E7ECE3;
          --vermillion: #9C2B22;
          --vermillion-soft: #F3DEDA;
          font-family: 'Zen Kaku Gothic New', sans-serif;
          color: var(--ink);
          background: var(--paper);
          min-height: 100%;
          box-sizing: border-box;
        }
        .ia-root *, .ia-root *::before, .ia-root *::after { box-sizing: border-box; }
        .ia-root button { font-family: inherit; cursor: pointer; }
        .ia-root input, .ia-root select, .ia-root textarea { font-family: inherit; color: var(--ink); }

        .ia-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 22px; border-bottom: 1px solid var(--line);
          background: var(--paper);
        }
        .ia-brand { display: flex; align-items: center; gap: 12px; }
        .ia-seal-mini {
          width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--vermillion);
          color: var(--vermillion); display: flex; align-items: center; justify-content: center;
          font-family: 'Shippori Mincho', serif; font-weight: 700; font-size: 15px; flex-shrink: 0;
        }
        .ia-brand h1 {
          font-family: 'Shippori Mincho', serif; font-size: 20px; font-weight: 700; margin: 0;
          letter-spacing: 0.02em;
        }
        .ia-brand p { margin: 1px 0 0; font-size: 11px; color: var(--ink-soft); letter-spacing: 0.08em; }
        .ia-topbar-actions { display: flex; gap: 8px; }
        .ia-btn-ghost {
          display: flex; align-items: center; gap: 6px; padding: 8px 13px; border-radius: 3px;
          border: 1px solid var(--line-strong); background: var(--sheet); font-size: 13px; color: var(--ink);
        }
        .ia-btn-ghost:hover { border-color: var(--moss); }

        .ia-layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100% - 74px); }
        @media (max-width: 760px) { .ia-layout { grid-template-columns: 1fr; } }

        .ia-sidebar { padding: 20px 16px; border-right: 1px solid var(--line); }
        .ia-sidebar h2 {
          font-size: 11px; letter-spacing: 0.12em; color: var(--ink-soft); font-weight: 700;
          margin: 0 0 10px; text-transform: uppercase;
        }
        .ia-client-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
        .ia-client-btn {
          text-align: left; padding: 10px 12px; border-radius: 3px; border: 1px solid transparent;
          background: transparent; font-size: 14px; color: var(--ink); position: relative;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .ia-client-btn:hover { background: var(--moss-soft); }
        .ia-client-btn.active { background: var(--moss); color: #fff; font-weight: 500; }
        .ia-client-del {
          opacity: 0; color: inherit; background: none; border: none; padding: 2px; display: flex;
        }
        .ia-client-btn:hover .ia-client-del { opacity: 0.6; }
        .ia-client-del:hover { opacity: 1 !important; }

        .ia-add-client {
          display: flex; align-items: center; gap: 6px; padding: 9px 12px; border-radius: 3px;
          border: 1px dashed var(--line-strong); background: none; font-size: 13px; color: var(--ink-soft); width: 100%;
        }
        .ia-add-client:hover { border-color: var(--moss); color: var(--moss); }

        .ia-client-form { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; padding: 12px; background: var(--sheet); border: 1px solid var(--line); border-radius: 4px; }
        .ia-client-form input, .ia-client-form select {
          padding: 7px 9px; border: 1px solid var(--line-strong); border-radius: 3px; font-size: 13px; background: #fff;
        }
        .ia-form-row { display: flex; gap: 6px; }
        .ia-form-actions { display: flex; gap: 6px; margin-top: 2px; }
        .ia-btn-mini {
          flex: 1; padding: 7px; border-radius: 3px; border: 1px solid var(--line-strong); background: #fff; font-size: 12px;
        }
        .ia-btn-mini.primary { background: var(--moss); color: #fff; border-color: var(--moss); }

        .ia-main { padding: 26px 30px; }
        .ia-empty { color: var(--ink-soft); font-size: 14px; padding-top: 60px; text-align: center; }
        .ia-empty b { display: block; font-family: 'Shippori Mincho', serif; font-size: 17px; color: var(--ink); margin-bottom: 6px; }

        .ia-sheet {
          background: #fff; border: 1px solid var(--line); border-top: 6px solid var(--moss); border-radius: 4px; padding: 34px 42px;
          max-width: 780px; position: relative; color: #111;
        }
        .print-only { display: none; }
        @media print { .print-only { display: block !important; } }
        .ia-header-row {
          display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;
          border-bottom: 2px solid var(--moss-soft); padding-bottom: 16px;
        }
        .ia-title-wrap { display: flex; align-items: center; gap: 12px; }
        .ia-title-accent { width: 6px; height: 32px; background: var(--vermillion); border-radius: 2px; display: inline-block; }
        .ia-topmeta-inner { text-align: right; font-size: 12.5px; }
        .ia-meta-line { display: flex; gap: 8px; align-items: baseline; justify-content: flex-end; margin-top: 3px; }
        .ia-meta-line label { color: var(--ink-soft); }
        .ia-meta-line input {
          border: none; border-bottom: 1px solid var(--line-strong); background: none;
          font-size: 12.5px; padding: 2px 2px; width: 140px; text-align: right;
        }
        @media print { .ia-meta-line input { border-bottom: none; } }
        .ia-sheet-title {
          font-family: 'Shippori Mincho', serif; font-size: 27px; font-weight: 700; letter-spacing: 0.1em;
          margin: 0; color: var(--moss); text-align: left;
        }
        .ia-two-col { display: flex; justify-content: space-between; gap: 30px; margin-bottom: 20px; }
        .ia-client-block { flex: 1.2; }
        .ia-client-name {
          font-size: 19px; font-weight: 700; margin: 0 0 10px; border-left: 4px solid var(--moss);
          display: inline-block; padding: 2px 0 2px 10px;
        }
        .ia-lead-text { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 14px; }
        .ia-request-amount { display: flex; align-items: center; gap: 14px; }
        .ia-request-amount .label { font-size: 13px; }
        .ia-request-amount .value {
          font-size: 21px; font-weight: 700; background: var(--moss-soft); color: var(--moss);
          padding: 6px 16px; border-radius: 6px;
        }
        .ia-issuer-block { flex: 1; font-size: 12.5px; line-height: 1.7; }
        .ia-issuer-block .issuer-name { font-weight: 700; font-size: 13.5px; margin-bottom: 2px; }
        .ia-subject-row { display: flex; align-items: center; gap: 8px; margin: 4px 0 16px; }
        .ia-subject-row label { font-size: 12px; color: var(--ink-soft); }
        .ia-subject-row input { flex: 1; border: none; border-bottom: 1px solid var(--line-strong); background: none; font-size: 13px; padding: 4px 2px; }

        .ia-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 14px; }
        .ia-chip {
          font-size: 12px; padding: 5px 10px; border-radius: 20px; border: 1px solid var(--line-strong);
          background: #fff; color: var(--ink-soft);
        }
        .ia-chip:hover { border-color: var(--moss); color: var(--moss); }

        table.ia-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .ia-table thead th {
          font-size: 12px; font-weight: 700; text-align: left; padding: 8px 8px;
          border: 1px solid var(--moss); letter-spacing: 0.03em; background: var(--moss); color: #fff;
        }
        .ia-table td { padding: 6px 8px; border: 1px solid var(--line-strong); vertical-align: middle; height: 30px; }
        @media print { .ia-table td, .ia-table th { border: 1px solid #000 !important; } }
        .ia-filler-row { display: none; }
        @media print { .ia-filler-row { display: table-row !important; } }
        .ia-table input {
          border: none; background: none; font-size: 13px; width: 100%; padding: 4px 2px; font-family: inherit;
        }
        .ia-table input.num { text-align: right; }
        .ia-qty-cell { display: flex; align-items: center; gap: 4px; }
        .ia-qty-cell input.qty-num { width: 46px; flex: none; }
        .ia-qty-cell input.qty-unit { width: 32px; flex: none; }
        .ia-amount-cell { text-align: right; font-size: 13px; white-space: nowrap; }
        .ia-row-del { background: none; border: none; color: var(--ink-soft); padding: 4px; display: flex; }
        .ia-row-del:hover { color: var(--vermillion); }
        .ia-add-row {
          margin-top: 8px; display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--moss);
          background: none; border: none; padding: 6px 2px;
        }

        .ia-totals { margin-top: 0; margin-left: auto; width: 280px; border: 1.5px solid var(--moss); }
        @media print { .ia-totals { border: 1.5px solid var(--moss); } }
        .ia-totals-row { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 10px; color: var(--ink-soft); border-bottom: 1px solid var(--line); }
        .ia-totals-row:last-child { border-bottom: none; }
        .ia-totals-row.total { color: var(--moss); font-weight: 700; font-size: 15px; background: var(--moss-soft); }
        .ia-tax-select { border: 1px solid var(--line-strong); border-radius: 3px; background: #fff; font-size: 12px; padding: 3px 5px; }

        .ia-notes { margin-top: 20px; }
        .ia-notes label { font-size: 11px; color: var(--ink-soft); display: block; margin-bottom: 4px; }
        .ia-notes textarea {
          width: 100%; border: 1px solid var(--line); border-radius: 3px; padding: 8px; font-size: 12.5px;
          resize: vertical; min-height: 46px; background: #fff;
        }
        @media print { .ia-notes { display: none; } }

        .ia-bank { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-soft); }
        .ia-bank .bank-label { color: #111; margin-bottom: 3px; }
        @media print {
          .ia-sheet input, .ia-sheet select, .ia-sheet textarea { border: none !important; background: none !important; }
        }

        .ia-actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; max-width: 780px; }
        .ia-btn {
          display: flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 3px; font-size: 13.5px;
          border: 1px solid var(--moss); background: var(--moss); color: #fff;
        }
        .ia-btn.secondary { background: #fff; color: var(--moss); }
        .ia-flash { font-size: 12.5px; color: var(--moss); }

        .ia-history { margin-top: 26px; max-width: 780px; }
        .ia-history h3 { font-size: 12px; color: var(--ink-soft); letter-spacing: 0.08em; margin: 0 0 8px; text-transform: uppercase; }
        .ia-history-row {
          display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; font-size: 12.5px;
          border-bottom: 1px solid var(--line);
        }
        .ia-history-row button { background: none; border: none; color: var(--moss); font-size: 12px; }
        .ia-history-row .del { color: var(--ink-soft); }
        .ia-history-row .del:hover { color: var(--vermillion); }

        .ia-modal-backdrop {
          position: fixed; inset: 0; background: rgba(38,42,32,0.4); display: flex; align-items: center;
          justify-content: center; z-index: 50; padding: 20px;
        }
        .ia-modal {
          background: var(--sheet); border-radius: 5px; padding: 24px 26px; width: 100%; max-width: 480px;
          max-height: 84vh; overflow-y: auto; border: 1px solid var(--line);
        }
        .ia-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .ia-modal-head h3 { font-family: 'Shippori Mincho', serif; font-size: 17px; margin: 0; }
        .ia-modal-close { background: none; border: none; color: var(--ink-soft); }
        .ia-field { margin-bottom: 10px; }
        .ia-field label { font-size: 11.5px; color: var(--ink-soft); display: block; margin-bottom: 3px; }
        .ia-field input, .ia-field select {
          width: 100%; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 3px; font-size: 13px; background: #fff;
        }
        .ia-field-row { display: flex; gap: 8px; }
        .ia-field-row .ia-field { flex: 1; }
        .ia-catalog-list { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }
        .ia-catalog-row { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
        .ia-catalog-row input { padding: 6px 8px; border: 1px solid var(--line); border-radius: 3px; font-size: 12.5px; background: #fff; }
        .ia-catalog-row input.name { flex: 1; }
        .ia-catalog-row input.price { width: 90px; font-family: 'JetBrains Mono', monospace; text-align: right; }

        @media print {
          .no-print { display: none !important; }
          .ia-root, .ia-layout { display: block; background: #fff; }
          .ia-main { padding: 0; }
          .ia-sheet { border: none; max-width: 100%; background-image: none; padding: 10px; }
        }
      `}</style>

      <div className="ia-topbar no-print">
        <div className="ia-brand">
          <div className="ia-seal-mini">帳</div>
          <div>
            <h1>請求書帳</h1>
            <p>SEIKYŪSHO-CHŌ</p>
          </div>
        </div>
        <div className="ia-topbar-actions">
          <button className="ia-btn-ghost" onClick={() => setShowCompanyModal(true)}>
            <Building2 size={15} /> 自社情報
          </button>
          <button className="ia-btn-ghost" onClick={() => setShowCatalogModal(true)}>
            <Tag size={15} /> 単価表
          </button>
        </div>
      </div>

      <div className="ia-layout">
        <aside className="ia-sidebar no-print">
          <h2>クライアント</h2>
          <div className="ia-client-list">
            {clients.map((c) => (
              <button
                key={c.id}
                className={"ia-client-btn" + (c.id === selectedClientId ? " active" : "")}
                onClick={() => selectClient(c.id)}
              >
                <span>{c.name}</span>
                <span
                  className="ia-client-del"
                  onClick={(e) => { e.stopPropagation(); removeClient(c.id); }}
                >
                  <Trash2 size={13} />
                </span>
              </button>
            ))}
          </div>

          {showClientForm ? (
            <ClientForm onCancel={() => setShowClientForm(false)} onSave={addClient} />
          ) : (
            <button className="ia-add-client" onClick={() => setShowClientForm(true)}>
              <Plus size={14} /> クライアント追加
            </button>
          )}
        </aside>

        <main className="ia-main">
          {!selectedClientId ? (
            <div className="ia-empty">
              <b>クライアントを選択してください</b>
              左のリストからクライアントを選ぶか、新しく追加すると請求書の作成を始められます。
            </div>
          ) : (
            <>
              <div className="ia-sheet" ref={sheetRef}>
                <div className="ia-header-row">
                  <div className="ia-title-wrap">
                    <span className="ia-title-accent"></span>
                    <p className="ia-sheet-title">請求書</p>
                  </div>
                  <div className="ia-topmeta-inner">
                    <div className="ia-meta-line">
                      <label>発行日</label>
                      <span className="print-only">{formatDateJP(draft.issueDate)}</span>
                      <input className="no-print" type="date" value={draft.issueDate}
                        onChange={(e) => setDraft((d) => ({ ...d, issueDate: e.target.value }))} />
                    </div>
                    <div className="ia-meta-line">
                      <label>請求番号</label>
                      <input value={draft.invoiceNumber} onChange={(e) => setDraft((d) => ({ ...d, invoiceNumber: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="ia-two-col">
                  <div className="ia-client-block">
                    <p className="ia-client-name">{selectedClient.name}　{selectedClient.honorific || "様"}</p>
                    <div className="ia-lead-text">下記のとおりご請求申し上げます。</div>
                    <div className="ia-request-amount">
                      <span className="label">ご請求金額</span>
                      <span className="value">{yenBig(total)}</span>
                    </div>
                  </div>
                  <div className="ia-issuer-block">
                    {company.name && <div className="issuer-name">{company.name}</div>}
                    {company.zip && <div>〒{company.zip}</div>}
                    {company.address && <div>{company.address}</div>}
                    {company.tel && <div>TEL: {company.tel}</div>}
                    {company.regNo && <div>登録番号: {company.regNo}</div>}
                  </div>
                </div>

                <div className="ia-subject-row">
                  <label>件名</label>
                  <input placeholder="例）2025年4月分 動画編集費用" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
                </div>

                {catalog.length > 0 && (
                  <div className="ia-chips no-print">
                    {catalog.map((c) => (
                      <button key={c.id} className="ia-chip" onClick={() => addItemRow(c)}>
                        + {c.name}（{yen(c.price)}）
                      </button>
                    ))}
                  </div>
                )}

                <table className="ia-table">
                  <thead>
                    <tr>
                      <th style={{ width: "46%" }}>品番・品名</th>
                      <th style={{ width: "16%" }}>数量</th>
                      <th style={{ width: "18%" }}>単価</th>
                      <th style={{ width: "16%" }}>金額</th>
                      <th style={{ width: "4%" }} className="no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((it) => (
                      <tr key={it.id}>
                        <td>
                          <input list="ia-catalog-names" value={it.name} placeholder="例）[2025/04/24 納品分] P075_橋渡し攻略動画"
                            onChange={(e) => updateItemRow(it.id, { name: e.target.value })} />
                        </td>
                        <td>
                          <div className="ia-qty-cell">
                            <input className="num qty-num" type="number" min="0" value={it.qty}
                              onChange={(e) => updateItemRow(it.id, { qty: e.target.value })} />
                            <input className="qty-unit" value={it.unit || "本"}
                              onChange={(e) => updateItemRow(it.id, { unit: e.target.value })} />
                          </div>
                        </td>
                        <td>
                          <input className="num" type="number" min="0" value={it.price}
                            onChange={(e) => updateItemRow(it.id, { price: e.target.value })} />
                        </td>
                        <td className="ia-amount-cell">{numFmt((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                        <td className="no-print">
                          <button className="ia-row-del" onClick={() => removeItemRow(it.id)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, MIN_ROWS - draft.items.length) }).map((_, i) => (
                      <tr className="ia-filler-row" key={"filler-" + i}>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td className="no-print">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="ia-catalog-names">
                  {catalog.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>

                <button className="ia-add-row no-print" onClick={() => addItemRow(null)}>
                  <Plus size={14} /> 項目を追加
                </button>

                <div className="ia-totals">
                  <div className="ia-totals-row">
                    <span>小計</span><span>{numFmt(subtotal)}</span>
                  </div>
                  <div className="ia-totals-row">
                    <span>
                      消費税
                      <select className="ia-tax-select no-print" style={{ marginLeft: 6 }} value={draft.taxMode}
                        onChange={(e) => setDraft((d) => ({ ...d, taxMode: e.target.value }))}>
                        <option value="ex10">外税10%</option>
                        <option value="in10">内税10%</option>
                        <option value="exempt">非課税</option>
                      </select>
                    </span>
                    <span>{numFmt(tax)}</span>
                  </div>
                  <div className="ia-totals-row total">
                    <span>合計</span><span>{numFmt(total)}</span>
                  </div>
                </div>

                <div className="ia-notes">
                  <label>備考</label>
                  <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="支払期限、特記事項など" />
                </div>

                {company.bankName && (
                  <div className="ia-bank">
                    <div className="bank-label">お振込先：</div>
                    <div>
                      銀行名：{company.bankName}　支店名：{company.bankBranch}支店　口座番号：（{company.bankType}）{company.bankAccount}　口座名義：{company.bankHolder}
                    </div>
                  </div>
                )}
              </div>

              <div className="ia-actions no-print">
                <button className="ia-btn" onClick={saveInvoice}><Save size={15} /> 保存</button>
                <button className="ia-btn secondary" onClick={downloadInvoiceHTML}><Printer size={15} /> 印刷用ファイルを保存</button>
                {clientInvoices.length > 0 && (
                  <button className="ia-btn secondary" onClick={duplicateLatest}><Copy size={15} /> 前回を複製</button>
                )}
                {flash && <span className="ia-flash"><Check size={13} style={{ verticalAlign: "-2px" }} /> {flash}</span>}
              </div>

              {clientInvoices.length > 0 && (
                <div className="ia-history no-print">
                  <h3>このクライアントの保存済み請求書</h3>
                  {flash && flash.includes("読み込み") && <p className="ia-flash" style={{ marginBottom: 8 }}>{flash}</p>}
                  {clientInvoices.map((inv) => {
                    const t = calcTotals(inv.items, inv.taxMode);
                    return (
                      <div className="ia-history-row" key={inv.id}>
                        <span>{inv.invoiceNumber || "（番号なし）"}　{inv.issueDate}　{yen(t.total)}</span>
                        <span style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => loadInvoice(inv)}>開く</button>
                          <button className="del" onClick={() => removeSavedInvoice(inv.id)}>削除</button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showCatalogModal && (
        <CatalogModal
          catalog={catalog}
          onClose={() => setShowCatalogModal(false)}
          onAdd={addCatalogItem}
          onUpdate={updateCatalogItem}
          onRemove={removeCatalogItem}
        />
      )}
      {showCompanyModal && (
        <CompanyModal company={company} onClose={() => setShowCompanyModal(false)} onSave={setCompany} />
      )}
    </div>
  );
}

function ClientForm({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [honorific, setHonorific] = useState("様");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  return (
    <div className="ia-client-form">
      <input placeholder="クライアント名" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="ia-form-row">
        <select value={honorific} onChange={(e) => setHonorific(e.target.value)} style={{ width: 80 }}>
          <option value="様">様</option>
          <option value="御中">御中</option>
        </select>
        <input placeholder="担当者名（任意）" value={contact} onChange={(e) => setContact(e.target.value)} />
      </div>
      <input placeholder="住所（任意）" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="ia-form-actions">
        <button className="ia-btn-mini" onClick={onCancel}>キャンセル</button>
        <button
          className="ia-btn-mini primary"
          onClick={() => name.trim() && onSave({ name: name.trim(), honorific, address: address.trim(), contact: contact.trim() })}
        >
          追加する
        </button>
      </div>
    </div>
  );
}

function CatalogModal({ catalog, onClose, onAdd, onUpdate, onRemove }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("本");
  return (
    <div className="ia-modal-backdrop" onClick={onClose}>
      <div className="ia-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ia-modal-head">
          <h3>単価表</h3>
          <button className="ia-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ia-field-row">
          <div className="ia-field">
            <label>項目名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例）動画編集（1本あたり）" />
          </div>
          <div className="ia-field" style={{ maxWidth: 110 }}>
            <label>単価</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="10000" />
          </div>
          <div className="ia-field" style={{ maxWidth: 70 }}>
            <label>単位</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="本" />
          </div>
        </div>
        <button
          className="ia-btn-mini primary"
          style={{ width: "100%" }}
          onClick={() => {
            if (!name.trim()) return;
            onAdd({ name: name.trim(), price: Number(price) || 0, unit: unit.trim() || "本" });
            setName(""); setPrice(""); setUnit("本");
          }}
        >
          <Plus size={13} style={{ verticalAlign: "-2px" }} /> 登録する
        </button>

        <div className="ia-catalog-list">
          {catalog.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>まだ登録されていません。</p>}
          {catalog.map((c) => (
            <div className="ia-catalog-row" key={c.id}>
              <input className="name" value={c.name} onChange={(e) => onUpdate(c.id, { name: e.target.value })} />
              <input className="price" type="number" value={c.price} onChange={(e) => onUpdate(c.id, { price: Number(e.target.value) || 0 })} />
              <input className="price" style={{ width: 50 }} value={c.unit || "本"} onChange={(e) => onUpdate(c.id, { unit: e.target.value })} />
              <button className="ia-row-del" onClick={() => onRemove(c.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompanyModal({ company, onClose, onSave }) {
  const [form, setForm] = useState(company);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="ia-modal-backdrop" onClick={onClose}>
      <div className="ia-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ia-modal-head">
          <h3>自社情報</h3>
          <button className="ia-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ia-field"><label>会社名・屋号</label><input value={form.name} onChange={set("name")} /></div>
        <div className="ia-field-row">
          <div className="ia-field" style={{ maxWidth: 120 }}><label>郵便番号</label><input value={form.zip} onChange={set("zip")} /></div>
          <div className="ia-field"><label>電話番号</label><input value={form.tel} onChange={set("tel")} /></div>
        </div>
        <div className="ia-field"><label>住所</label><input value={form.address} onChange={set("address")} /></div>
        <div className="ia-field"><label>適格請求書発行事業者登録番号（任意）</label><input value={form.regNo} onChange={set("regNo")} placeholder="T1234567890123" /></div>
        <div className="ia-field-row">
          <div className="ia-field"><label>銀行名</label><input value={form.bankName} onChange={set("bankName")} /></div>
          <div className="ia-field"><label>支店名</label><input value={form.bankBranch} onChange={set("bankBranch")} /></div>
        </div>
        <div className="ia-field-row">
          <div className="ia-field" style={{ maxWidth: 100 }}>
            <label>種別</label>
            <select value={form.bankType} onChange={set("bankType")}>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
          </div>
          <div className="ia-field"><label>口座番号</label><input value={form.bankAccount} onChange={set("bankAccount")} /></div>
        </div>
        <div className="ia-field"><label>口座名義</label><input value={form.bankHolder} onChange={set("bankHolder")} /></div>
        <button className="ia-btn-mini primary" style={{ width: "100%", marginTop: 4 }} onClick={() => { onSave(form); onClose(); }}>
          保存する
        </button>
      </div>
    </div>
  );
}
