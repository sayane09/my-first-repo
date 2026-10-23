/**
 * 勤怠管理アプリ（Googleスプレッドシート版）
 *
 * このスクリプトはスプレッドシートに紐づけて使います（拡張機能 → Apps Script）。
 * 記録はこのスプレッドシートの「スタッフ」「打刻」「修正履歴」「設定」シートに保存されます。
 * 最初に一度だけ setup を実行してから、ウェブアプリとしてデプロイしてください。
 */

var SHEETS = {
  staff: { name: 'スタッフ', header: ['ID', '名前', '店舗'] },
  records: { name: '打刻', header: ['ID', 'スタッフID', 'スタッフ', '打刻した店舗', '出勤', '退勤', '休憩', '更新日時'] },
  log: { name: '修正履歴', header: ['ID', '修正した日時', 'スタッフID', 'スタッフ', '記録ID', '勤務日', '内容', '修正前', '修正後', '修正した人', '理由'] },
  settings: { name: '設定', header: ['項目', '値'] }
};
// 計算ルール（固定）：15分単位、出勤は切り上げ、退勤は切り捨て、休憩は近い方の15分
var DEFAULT_SETTINGS = { unit: 15, inMode: 'ceil', outMode: 'floor', breakMode: 'round', pin: '' };
var KEEP_DAYS = 400; // 画面に読み込む記録の期間（シートからは消しません）

// ---------- ウェブアプリ ----------
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('勤怠管理アプリ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** 最初に一度だけ実行：シートを作り、タイムゾーンを日本時間にします */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Tokyo');
  Object.keys(SHEETS).forEach(function (k) {
    var def = SHEETS[k];
    var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(def.header);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, def.header.length).setFontWeight('bold');
    }
  });
  var st = ss.getSheetByName(SHEETS.settings.name);
  if (st.getLastRow() === 1) st.appendRow(['pin', '']);
  ['打刻', 'スタッフ', '修正履歴'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    sh.getRange('A:A').setNumberFormat('@');
  });
  var rec = ss.getSheetByName(SHEETS.records.name);
  rec.getRange('E:F').setNumberFormat('yyyy/mm/dd hh:mm');
  rec.getRange('H:H').setNumberFormat('yyyy/mm/dd hh:mm');
  ss.getSheetByName(SHEETS.log.name).getRange('B:B').setNumberFormat('yyyy/mm/dd hh:mm');
}

// ---------- 画面から呼ぶ関数 ----------
function getState() {
  return core_getState(sheetStore_());
}

/** 打刻（時刻はサーバーの時計で記録します） */
function punch(staffId, action, deviceStore) {
  return withLock_(function () {
    var store = sheetStore_();
    var msg = core_punch(store, staffId, action, deviceStore, new Date());
    return { state: core_getState(store), result: msg };
  });
}

/** 修正・追加・削除・スタッフ登録・設定変更 */
function apply(ops, pin) {
  return withLock_(function () {
    var store = sheetStore_();
    core_apply(store, ops, pin);
    return core_getState(store);
  });
}

/** 店長の暗証番号の確認 */
function checkPin(pin) {
  var p = core_readSettings(sheetStore_()).pin;
  return !p || String(pin) === p;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- シートとのやりとり ----------
function sheetStore_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function sh(k) {
    var s = ss.getSheetByName(SHEETS[k].name);
    if (!s) throw new Error('シート「' + SHEETS[k].name + '」がありません。setup を実行してください。');
    return s;
  }
  function rows(k) {
    var s = sh(k), n = s.getLastRow() - 1;
    if (n <= 0) return [];
    return s.getRange(2, 1, n, SHEETS[k].header.length).getValues();
  }
  function findRow(k, id) {
    var s = sh(k), n = s.getLastRow() - 1;
    if (n <= 0) return -1;
    var ids = s.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
    return -1;
  }
  return {
    rows: rows,
    upsert: function (k, row) {
      var s = sh(k), r = findRow(k, row[0]);
      if (r > 0) s.getRange(r, 1, 1, row.length).setValues([row]);
      else s.appendRow(row);
    },
    remove: function (k, id) {
      var r = findRow(k, id);
      if (r > 0) sh(k).deleteRow(r);
    },
    append: function (k, row) { sh(k).appendRow(row); }
  };
}

// ---------- 中身の処理（シートに依存しない部分） ----------
function toIso_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return v.toISOString();
  return new Date(v).toISOString();
}
function toDate_(iso) { return iso ? new Date(iso) : ''; }

function core_readSettings(store) {
  var s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  store.rows('settings').forEach(function (r) {
    var k = String(r[0]);
    if (k === 'pin') s.pin = String(r[1]); // 計算ルールは固定（シートの値は使わない）
  });
  return s;
}

function core_readRecords(store) {
  return store.rows('records').map(function (r) {
    return { id: String(r[0]), staffId: String(r[1]), store: String(r[3] || ''), in: toIso_(r[4]), out: toIso_(r[5]),
      breaks: r[6] ? JSON.parse(r[6]) : [] };
  });
}

function core_getState(store) {
  var settings = core_readSettings(store);
  var hasPin = !!settings.pin;
  delete settings.pin;
  settings.hasPin = hasPin;
  var since = Date.now() - KEEP_DAYS * 86400000;
  return {
    settings: settings,
    staff: store.rows('staff').map(function (r) { return { id: String(r[0]), name: String(r[1]), store: String(r[2] || '') }; }),
    records: core_readRecords(store).filter(function (r) { return !r.out || new Date(r.in).getTime() >= since; }),
    log: store.rows('log').map(function (r) {
      return { id: String(r[0]), at: toIso_(r[1]), staffId: String(r[2]), staffName: String(r[3]), recId: String(r[4]),
        workDate: String(r[5]), action: String(r[6]), before: String(r[7]), after: String(r[8]), by: String(r[9]), reason: String(r[10]) };
    }),
    serverTime: new Date().toISOString()
  };
}

function core_recordRow(store, rec) {
  var staff = store.rows('staff').filter(function (r) { return String(r[0]) === rec.staffId; })[0];
  return [rec.id, rec.staffId, staff ? staff[1] : '', rec.store || '', toDate_(rec.in), toDate_(rec.out),
    JSON.stringify(rec.breaks || []), new Date()];
}

function core_uid() { return Utilities.getUuid().slice(0, 12); }

function core_punch(store, staffId, action, deviceStore, now) {
  var iso = now.toISOString();
  var open = core_readRecords(store).filter(function (r) { return r.staffId === staffId && !r.out; })
    .sort(function (a, b) { return b.in < a.in ? -1 : 1; })[0];
  var brk = open ? open.breaks.filter(function (b) { return !b.end; })[0] : null;
  if (action === 'in') {
    if (open) throw new Error('すでに出勤しています');
    var rec = { id: core_uid(), staffId: staffId, store: deviceStore || '', in: iso, out: null, breaks: [] };
    store.upsert('records', core_recordRow(store, rec));
    return { at: iso, recId: rec.id };
  }
  if (!open) throw new Error('まだ出勤していません');
  if (action === 'bs') {
    if (brk) throw new Error('すでに休憩中です');
    open.breaks.push({ start: iso, end: null });
  } else if (action === 'be') {
    if (!brk) throw new Error('休憩中ではありません');
    brk.end = iso;
  } else if (action === 'out') {
    if (brk) brk.end = iso;
    open.out = iso;
  } else {
    throw new Error('不明な操作です');
  }
  store.upsert('records', core_recordRow(store, open));
  return { at: iso, recId: open.id };
}

function core_apply(store, ops, pin) {
  var settings = core_readSettings(store);
  if (settings.pin && String(pin || '') !== settings.pin) throw new Error('店長の暗証番号が違います');
  (ops || []).forEach(function (op) {
    if (op.t === 'record') store.upsert('records', core_recordRow(store, op.rec));
    else if (op.t === 'deleteRecord') store.remove('records', op.id);
    else if (op.t === 'log') {
      var l = op.entry;
      store.append('log', [l.id, new Date(), l.staffId, l.staffName, l.recId, l.workDate, l.action, l.before, l.after, l.by, l.reason]);
    } else if (op.t === 'staff') store.upsert('staff', [op.staff.id, op.staff.name, op.staff.store || '']);
    else if (op.t === 'deleteStaff') store.remove('staff', op.id); // 打刻の記録は給与の記録として残す
    else if (op.t === 'settings') {
      if ('pin' in op.settings) store.upsert('settings', ['pin', String(op.settings.pin || '')]);
    } else throw new Error('不明な操作です: ' + op.t);
  });
}
