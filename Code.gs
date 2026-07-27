/**
 * 請求書帳 - Google Apps Script バックエンド
 * このスプレッドシート自体がデータベースになります。
 * シートのタブ（Clients / Catalog / Invoices / InvoiceItems / Company）を直接見たり、
 * 手で修正したりできます。ここを直接編集した場合は、アプリを開き直すと反映されます。
 */

var SHEET_CLIENTS = 'Clients';
var SHEET_CATALOG = 'Catalog';
var SHEET_INVOICES = 'Invoices';
var SHEET_ITEMS = 'InvoiceItems';
var SHEET_COMPANY = 'Company';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('請求書帳')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureSheets_() {
  getSheet_(SHEET_CLIENTS, ['id', '名前', '敬称', '住所', '担当者']);
  getSheet_(SHEET_CATALOG, ['id', '項目名', '単価', '単位']);
  getSheet_(SHEET_INVOICES, ['id', 'clientId', '請求番号', '発行日', '件名', '税区分', '備考', '作成日時']);
  getSheet_(SHEET_ITEMS, ['id', 'invoiceId', '品番品名', '数量', '単位', '単価']);
  getSheet_(SHEET_COMPANY, ['項目', '値']);
}

function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var hasData = false;
    for (var j = 0; j < row.length; j++) { if (row[j] !== '' && row[j] !== null) { hasData = true; break; } }
    if (!hasData) continue;
    var obj = {};
    for (var k = 0; k < headers.length; k++) obj[headers[k]] = row[k];
    out.push(obj);
  }
  return out;
}

function formatDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var y = v.getFullYear();
    var m = ('0' + (v.getMonth() + 1)).slice(-2);
    var d = ('0' + v.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  return String(v);
}

/** フロント側が起動時に一度だけ呼ぶ。全データをまとめて返す。 */
function getAllData() {
  ensureSheets_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var clientsRaw = sheetToObjects_(ss.getSheetByName(SHEET_CLIENTS));
  var clients = clientsRaw.map(function (r) {
    return {
      id: String(r['id']),
      name: r['名前'],
      honorific: r['敬称'] || '様',
      address: r['住所'] || '',
      contact: r['担当者'] || '',
    };
  });

  var catalogRaw = sheetToObjects_(ss.getSheetByName(SHEET_CATALOG));
  var catalog = catalogRaw.map(function (r) {
    return {
      id: String(r['id']),
      name: r['項目名'],
      price: Number(r['単価']) || 0,
      unit: r['単位'] || '本',
    };
  });

  var invoicesRaw = sheetToObjects_(ss.getSheetByName(SHEET_INVOICES));
  var itemsRaw = sheetToObjects_(ss.getSheetByName(SHEET_ITEMS));

  var invoices = invoicesRaw.map(function (r) {
    var invId = String(r['id']);
    var items = itemsRaw
      .filter(function (it) { return String(it['invoiceId']) === invId; })
      .map(function (it) {
        return {
          id: String(it['id']),
          name: it['品番品名'],
          qty: Number(it['数量']) || 0,
          unit: it['単位'] || '本',
          price: Number(it['単価']) || 0,
        };
      });
    return {
      id: invId,
      clientId: String(r['clientId']),
      invoiceNumber: r['請求番号'],
      issueDate: formatDate_(r['発行日']),
      subject: r['件名'] || '',
      taxMode: r['税区分'] || 'ex10',
      notes: r['備考'] || '',
      createdAt: r['作成日時'] ? new Date(r['作成日時']).getTime() : Date.now(),
      items: items,
    };
  });

  var companyRaw = sheetToObjects_(ss.getSheetByName(SHEET_COMPANY));
  var company = {};
  companyRaw.forEach(function (r) { company[r['項目']] = r['値']; });

  return { clients: clients, catalog: catalog, invoices: invoices, company: company };
}

function clearBody_(sheet, cols) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, cols).clearContent();
}

/** クライアント一覧をシートの内容と丸ごと入れ替える */
function replaceAllClients(clients) {
  ensureSheets_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CLIENTS);
  clearBody_(sheet, 5);
  var rows = (clients || []).map(function (c) {
    return [c.id, c.name, c.honorific || '様', c.address || '', c.contact || ''];
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  return true;
}

/** 単価表をシートの内容と丸ごと入れ替える */
function replaceAllCatalog(catalog) {
  ensureSheets_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CATALOG);
  clearBody_(sheet, 4);
  var rows = (catalog || []).map(function (c) {
    return [c.id, c.name, c.price, c.unit || '本'];
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  return true;
}

/** 請求書（ヘッダー＋明細）をシートの内容と丸ごと入れ替える */
function replaceAllInvoices(invoices) {
  ensureSheets_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName(SHEET_INVOICES);
  var itemSheet = ss.getSheetByName(SHEET_ITEMS);

  clearBody_(invSheet, 8);
  clearBody_(itemSheet, 6);

  var invRows = (invoices || []).map(function (inv) {
    return [
      inv.id, inv.clientId, inv.invoiceNumber, inv.issueDate, inv.subject || '',
      inv.taxMode || 'ex10', inv.notes || '', new Date(inv.createdAt || Date.now()),
    ];
  });
  if (invRows.length) invSheet.getRange(2, 1, invRows.length, 8).setValues(invRows);

  var itemRows = [];
  (invoices || []).forEach(function (inv) {
    (inv.items || []).forEach(function (it) {
      itemRows.push([it.id, inv.id, it.name, it.qty, it.unit || '本', it.price]);
    });
  });
  if (itemRows.length) itemSheet.getRange(2, 1, itemRows.length, 6).setValues(itemRows);
  return true;
}

/** 自社情報を保存する（キーと値の2列シート） */
function saveCompany(company) {
  ensureSheets_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COMPANY);
  clearBody_(sheet, 2);
  var rows = Object.keys(company || {}).map(function (k) { return [k, company[k]]; });
  if (rows.length) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  return true;
}
