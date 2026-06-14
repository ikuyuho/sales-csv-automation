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
  const fileIterator = inputFolder.getFilesByType(MimeType.CSV);

  const files = [];
  while (fileIterator.hasNext()) files.push(fileIterator.next());

  if (files.length === 0) {
    Logger.log('処理対象のCSVファイルがありません');
    return;
  }

  // ファイル名順にソート
  files.sort((a, b) => a.getName().localeCompare(b.getName()));

  const masterData = _loadMasterData();
  const salesSs    = _getOrCreateSalesSpreadsheet();
  const existingOrderNos = _loadExistingOrderNos(salesSs);

  files.forEach(file => {
    Logger.log('処理開始: ' + file.getName());

    const { valid, errors, skipped } = _processFile(file, masterData, existingOrderNos);

    _appendValidRows(salesSs, valid, existingOrderNos);
    _appendRows(salesSs, 'エラーデータ', [...HEADERS, 'エラー理由', '取込ファイル名'], errors.map(r => [...r, file.getName()]));
    _writeHistory(salesSs, file.getName(), valid.length, errors.length, skipped);
    _notifyByStore(valid, errors, masterData.storeWebhooks, salesSs.getUrl(), file.getName());

    file.moveTo(DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID));
    Logger.log(`完了: 正常=${valid.length}件, エラー=${errors.length}件, スキップ=${skipped}件`);
  });
}

function _processFile(file, masterData, existingOrderNos) {
  const raw  = file.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
  const rows = Utilities.parseCsv(raw);
  if (rows.length <= 1) return { valid: [], errors: [], skipped: 0 };

  const valid       = [];
  const errors      = [];
  const fileOrderNos = new Set();
  let skipped       = 0;

  rows.slice(1).forEach(row => {
    const orderNo = (row[COL.ORDER_NO] || '').trim();

    if (existingOrderNos.has(orderNo)) {
      skipped++;
      return;
    }

    const reasons = _validate(row, masterData, fileOrderNos);
    if (reasons.length === 0) {
      fileOrderNos.add(orderNo);
      valid.push(row);
    } else {
      errors.push([...row, reasons.join(' / ')]);
    }
  });

  return { valid, errors, skipped };
}

function _validate(row, masterData, orderNos) {
  const reasons = [];
  const get     = idx => (row[idx] || '').trim();

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

  // ファイル内重複チェック
  if (orderNos.has(get(COL.ORDER_NO))) {
    reasons.push('注文番号が重複しています');
  }

  // 日付フォーマット
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(get(COL.DATE))) {
    reasons.push('売上日のフォーマットが不正です（yyyy/MM/dd）');
  }

  // マスタ参照チェック
  if (!masterData.channels.has(get(COL.CHANNEL)))      reasons.push('販売チャネルがマスタに存在しません');
  if (!masterData.products.has(get(COL.PRODUCT_CODE))) reasons.push('商品コードがマスタに存在しません');
  if (!masterData.payments.has(get(COL.PAYMENT)))      reasons.push('支払方法がマスタに存在しません');

  // 店舗コードチェック（実店舗チャネルは必須）
  const channelType = masterData.channelTypes.get(get(COL.CHANNEL));
  if (channelType === '実店舗') {
    if (get(COL.STORE_CODE) === '') {
      reasons.push('店舗コードが空です（POSチャネルは必須）');
    } else if (!masterData.stores.has(get(COL.STORE_CODE))) {
      reasons.push('店舗コードがマスタに存在しません');
    }
  }

  // enumチェック
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

  const channelRows  = ss.getSheetByName('販売チャネル').getDataRange().getValues().slice(1);
  const channels     = new Set(channelRows.map(r => String(r[2]).trim()));
  const channelTypes = new Map(channelRows.map(r => [String(r[2]).trim(), String(r[3]).trim()]));

  const storeRows    = ss.getSheetByName('店舗マスタ').getDataRange().getValues().slice(1);
  const stores       = new Set(storeRows.map(r => String(r[0]).trim()).filter(v => v));
  // 店舗コード → Slack Webhook URL（F列 = index 5）
  const storeWebhooks = new Map(
    storeRows
      .filter(r => String(r[5]).trim().startsWith('https://'))
      .map(r => [String(r[0]).trim(), String(r[5]).trim()])
  );

  const payments = new Set(
    ss.getSheetByName('支払方法').getDataRange().getValues().slice(1)
      .map(r => String(r[2]).trim()).filter(v => v)
  );
  const products = new Set(
    ss.getSheetByName('商品マスタ').getDataRange().getValues().slice(1)
      .map(r => String(r[0]).trim()).filter(v => v)
  );

  return { channels, channelTypes, stores, storeWebhooks, payments, products };
}

function _loadExistingOrderNos(salesSs) {
  const sheet = salesSs.getSheetByName('取込済み注文番号');
  if (!sheet || sheet.getLastRow() <= 1) return new Set();
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return new Set(values.map(r => String(r[0]).trim()).filter(v => v));
}

function _appendValidRows(salesSs, rows, existingOrderNos) {
  if (rows.length === 0) return;

  _appendRows(salesSs, '売上データ', HEADERS, rows);

  let sheet = salesSs.getSheetByName('取込済み注文番号');
  if (!sheet) {
    sheet = salesSs.insertSheet('取込済み注文番号');
    sheet.appendRow(['注文番号']);
    const hr = sheet.getRange(1, 1, 1, 1);
    hr.setFontWeight('bold');
    hr.setBackground('#E8F0FE');
    hr.setFontColor('#1A237E');
    sheet.setFrozenRows(1);
  }

  const newNos = rows.map(r => [(r[COL.ORDER_NO] || '').trim()]);
  sheet.getRange(sheet.getLastRow() + 1, 1, newNos.length, 1).setValues(newNos);
  rows.forEach(r => existingOrderNos.add((r[COL.ORDER_NO] || '').trim()));
}

function _writeHistory(salesSs, fileName, validCount, errorCount, skipped) {
  let sheet = salesSs.getSheetByName('取込履歴');
  if (!sheet) {
    sheet = salesSs.insertSheet('取込履歴');
    const headers = ['実行日時', 'ファイル名', '取込件数', 'エラー件数', 'スキップ件数', 'ステータス'];
    sheet.appendRow(headers);
    const hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setFontWeight('bold');
    hr.setBackground('#E8F0FE');
    hr.setFontColor('#1A237E');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  const status = errorCount === 0 ? '完了' : '完了（エラーあり）';
  sheet.appendRow([new Date(), fileName, validCount, errorCount, skipped, status]);
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

function _notifyByStore(valid, errors, storeWebhooks, url, fileName) {
  const allRows = [...valid, ...errors];
  if (allRows.length === 0) return;

  const storeCodes = new Set(
    allRows.map(r => (r[COL.STORE_CODE] || '').trim()).filter(v => v)
  );

  const webhookUrl = (storeCodes.size === 1)
    ? (storeWebhooks.get([...storeCodes][0]) || CONFIG.SLACK_WEBHOOK_URL)
    : CONFIG.SLACK_WEBHOOK_URL;

  if (!webhookUrl) return;

  const message = errors.length === 0
    ? `✅ 売上CSV取込完了：${valid.length}件取込\nファイル名：${fileName}`
    : `⚠️ 売上CSV取込完了：${valid.length}件取込、${errors.length}件エラー\nファイル名：${fileName}\nエラーシートを確認してください：${url}\nエラーレコードを修正したCSVを再度INPUTフォルダに配置してください。`;

  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: message }),
  });
}
