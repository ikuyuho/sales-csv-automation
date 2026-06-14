const CUSTOMER_TYPES = ['個人', '法人', '卸先'];

const COL = {
  ORDER_NO:     0,
  DATE:         1,
  CHANNEL:      2,
  STORE_CODE:   3,
  PRODUCT_CODE: 4,
  PRODUCT_NAME: 5,
  QTY:          6,
  UNIT_PRICE:   7,
  AMOUNT:       8,
  SHIPPING:     9,
  FEE:          10,
  PAYMENT:      11,
  CUSTOMER:     12,
  NOTE:         13,
};

const HEADERS = ['注文番号','売上日','販売チャネル','店舗コード','商品コード','商品名','数量','単価','売上金額','送料','手数料','支払方法','顧客区分','備考'];

function processCSV() {
  const inputFolder = DriveApp.getFolderById(CONFIG.INPUT_FOLDER_ID);
  const files = inputFolder.getFilesByType(MimeType.CSV);

  if (!files.hasNext()) {
    Logger.log('処理対象のCSVファイルがありません');
    return;
  }

  const masterData = _loadMasterData();
  const salesSs = _getOrCreateSalesSpreadsheet();

  let totalValid = 0;
  let totalError = 0;

  while (files.hasNext()) {
    const file = files.next();
    Logger.log('処理開始: ' + file.getName());

    const { valid, errors } = _processFile(file, masterData);
    _appendRows(salesSs, '売上データ', HEADERS, valid);
    _appendRows(salesSs, 'エラーデータ', [...HEADERS, 'エラー理由'], errors);

    totalValid += valid.length;
    totalError += errors.length;

    file.moveTo(DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID));
    Logger.log(`完了: 正常=${valid.length}件, エラー=${errors.length}件`);
  }

  _notify(totalValid, totalError, salesSs.getUrl());
}

function _processFile(file, masterData) {
  const raw = file.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
  const rows = Utilities.parseCsv(raw);
  if (rows.length <= 1) return { valid: [], errors: [] };

  const valid = [];
  const errors = [];
  const orderNos = new Set();

  rows.slice(1).forEach(row => {
    const reasons = _validate(row, masterData, orderNos);
    if (reasons.length === 0) {
      orderNos.add((row[COL.ORDER_NO] || '').trim());
      valid.push(row);
    } else {
      errors.push([...row, reasons.join(' / ')]);
    }
  });

  return { valid, errors };
}

function _validate(row, masterData, orderNos) {
  const reasons = [];
  const get = idx => (row[idx] || '').trim();

  // 必須項目nullチェック
  const required = [
    [COL.ORDER_NO,     '注文番号'],
    [COL.DATE,         '売上日'],
    [COL.CHANNEL,      '販売チャネル'],
    [COL.PRODUCT_CODE, '商品コード'],
    [COL.QTY,          '数量'],
    [COL.UNIT_PRICE,   '単価'],
    [COL.AMOUNT,       '売上金額'],
    [COL.PAYMENT,      '支払方法'],
    [COL.CUSTOMER,     '顧客区分'],
  ];
  const missing = required.filter(([idx]) => get(idx) === '').map(([, name]) => name);
  if (missing.length > 0) {
    reasons.push('必須項目が空です: ' + missing.join('・'));
    return reasons;
  }

  // 重複チェック
  if (orderNos.has(get(COL.ORDER_NO))) {
    reasons.push('注文番号が重複しています');
  }

  // 日付フォーマット
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(get(COL.DATE))) {
    reasons.push('売上日のフォーマットが不正です（yyyy/MM/dd）');
  }

  // マスタ参照チェック
  if (!masterData.channels.has(get(COL.CHANNEL))) {
    reasons.push('販売チャネルがマスタに存在しません');
  }
  if (!masterData.products.has(get(COL.PRODUCT_CODE))) {
    reasons.push('商品コードがマスタに存在しません');
  }
  if (!masterData.payments.has(get(COL.PAYMENT))) {
    reasons.push('支払方法がマスタに存在しません');
  }

  // 店舗コードチェック（実店舗チャネルは必須）
  const channelType = masterData.channelTypes.get(get(COL.CHANNEL));
  if (channelType === '実店舗') {
    if (get(COL.STORE_CODE) === '') {
      reasons.push('店舗コードが空です（POSチャネルは必須）');
    } else if (!masterData.stores.has(get(COL.STORE_CODE))) {
      reasons.push('店舗コードがマスタに存在しません');
    }
  }

  // enumチェック（顧客区分）
  if (!CUSTOMER_TYPES.includes(get(COL.CUSTOMER))) {
    reasons.push('顧客区分が不正です（個人・法人・卸先）');
  }

  // 数値チェック
  const qty       = Number(get(COL.QTY));
  const unitPrice = Number(get(COL.UNIT_PRICE));
  const amount    = Number(get(COL.AMOUNT));
  const shipping  = get(COL.SHIPPING) === '' ? 0 : Number(get(COL.SHIPPING));
  const fee       = get(COL.FEE)      === '' ? 0 : Number(get(COL.FEE));

  if (isNaN(qty)       || !Number.isInteger(qty)       || qty < 0)        reasons.push('数量が不正です（0以上の整数）');
  if (isNaN(unitPrice) || !Number.isInteger(unitPrice) || unitPrice <= 0) reasons.push('単価が不正です（1以上の整数）');
  if (isNaN(amount))                                                       reasons.push('売上金額が不正です');
  if (isNaN(shipping)  || shipping < 0)                                   reasons.push('送料が不正です（0以上）');
  if (isNaN(fee)       || fee < 0)                                        reasons.push('手数料が不正です（0以上）');

  // 金額整合チェック
  if (!isNaN(qty) && !isNaN(unitPrice) && !isNaN(amount)) {
    if (qty * unitPrice !== amount) {
      reasons.push(`売上金額不整合（数量×単価=${qty * unitPrice}、売上金額=${amount}）`);
    }
  }

  return reasons;
}

function _loadMasterData() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);

  const channelRows = ss.getSheetByName('販売チャネル').getDataRange().getValues().slice(1);
  const channels     = new Set(channelRows.map(r => String(r[2]).trim()));
  const channelTypes = new Map(channelRows.map(r => [String(r[2]).trim(), String(r[3]).trim()]));

  const stores = new Set(
    ss.getSheetByName('店舗マスタ').getDataRange().getValues().slice(1)
      .map(r => String(r[0]).trim()).filter(v => v)
  );
  const payments = new Set(
    ss.getSheetByName('支払方法').getDataRange().getValues().slice(1)
      .map(r => String(r[2]).trim()).filter(v => v)
  );
  const products = new Set(
    ss.getSheetByName('商品マスタ').getDataRange().getValues().slice(1)
      .map(r => String(r[0]).trim()).filter(v => v)
  );

  return { channels, channelTypes, stores, payments, products };
}

function _getOrCreateSalesSpreadsheet() {
  if (CONFIG.SALES_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SALES_SPREADSHEET_ID);
  }
  const ss = SpreadsheetApp.create('【サンプル】売上管理 売上データ');
  Logger.log('売上スプレッドシートを作成しました');
  Logger.log('ID: ' + ss.getId());
  Logger.log('↑ このIDを config.gs の SALES_SPREADSHEET_ID に設定してください');
  return ss;
}

function _appendRows(ss, sheetName, headers, rows) {
  if (rows.length === 0) return;

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    const hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setFontWeight('bold');
    hr.setBackground('#E8F0FE');
    hr.setFontColor('#1A237E');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
}

function _notify(validCount, errorCount, url) {
  if (!CONFIG.SLACK_WEBHOOK_URL) {
    Logger.log(`通知スキップ（SLACK_WEBHOOK_URL未設定）: 正常=${validCount}件, エラー=${errorCount}件`);
    return;
  }

  const message = errorCount === 0
    ? `✅ 売上CSV取込完了：${validCount}件取込`
    : `⚠️ 売上CSV取込完了：${validCount}件取込、${errorCount}件エラー\nエラーシートを確認してください：${url}\nエラーレコードを修正したCSVを再度INPUTフォルダに配置してください。`;

  UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: message }),
  });
}
