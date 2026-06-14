/**
 * 売上データを各種CSVにエクスポートする
 *
 * 実行方法:
 *   引数なし → 当月データを出力
 *   exportAll('2026', '05') → 2026年5月分を出力
 */
function exportAll(year, month) {
  const y = year  || '2026';
  const m = month || '05';

  Logger.log(`エクスポート開始: ${y}年${m}月`);

  const salesData = _loadSalesDataForExport(y, m);
  if (salesData.length === 0) {
    Logger.log('対象データがありません');
    return;
  }

  const masterData = _loadMasterDataForExport();
  const folder     = DriveApp.getFolderById(CONFIG.EXPORT_FOLDER_ID);

  _exportFreee(salesData, masterData, y, m, folder);
  _exportSalesReport(salesData, masterData, y, m, folder);
  _exportTaxAccountant(salesData, masterData, y, m, folder);
  _exportBI(salesData, masterData, y, m, folder);

  Logger.log('エクスポート完了');
}

// ----------------------------------------------------------------
// 1. freee仕訳CSV
// ----------------------------------------------------------------

function _exportFreee(salesData, masterData, year, month, folder) {
  const headers = ['発生日','伝票番号','借方勘定科目','借方税区分','借方金額','借方税額','貸方勘定科目','貸方税区分','貸方金額','貸方税額','摘要'];

  const rows = salesData.map((row, i) => {
    const channelInput = String(row[COL.CHANNEL]).trim();
    const productCode  = String(row[COL.PRODUCT_CODE]).trim();
    const amount       = Number(row[COL.AMOUNT]);
    const channelName  = masterData.channelNames.get(channelInput) || channelInput;
    const channelType  = masterData.channelTypes.get(channelInput) || '';
    const category     = masterData.productCategories.get(productCode) || '';
    const productName  = String(row[COL.PRODUCT_NAME]).trim();
    const rule         = _findAccountingRule(masterData.accountingRules, category, channelType);
    const taxRate      = rule ? _getTaxRate(rule.taxType) : 0.1;
    const taxAmount    = Math.floor(amount * taxRate / (1 + taxRate));
    const summary      = rule
      ? rule.summary.replace('{チャネル}', channelName).replace('{商品名}', productName)
      : `${channelName}売上 ${productName}`;

    return [
      String(row[COL.DATE]).trim(),
      String(i + 1).padStart(6, '0'),
      rule ? rule.debit   : '売掛金',
      rule ? rule.taxType : '標準税率(10%)',
      amount,
      taxAmount,
      rule ? rule.credit  : '売上高',
      rule ? rule.taxType : '標準税率(10%)',
      amount,
      taxAmount,
      summary,
    ];
  });

  _writeCsv(folder, `freee_${year}${month}.csv`, [headers, ...rows]);
  Logger.log('freee仕訳CSV出力完了');
}

// ----------------------------------------------------------------
// 2. 売上集計・経営レポート用CSV
// ----------------------------------------------------------------

function _exportSalesReport(salesData, masterData, year, month, folder) {
  const headers = ['正規チャネル名','チャネル種別','店舗コード','店舗名','商品カテゴリ','売上件数','売上合計','送料合計','手数料合計'];

  const map = new Map();
  salesData.forEach(row => {
    const channelInput = String(row[COL.CHANNEL]).trim();
    const storeCode    = String(row[COL.STORE_CODE]).trim();
    const productCode  = String(row[COL.PRODUCT_CODE]).trim();
    const channelName  = masterData.channelNames.get(channelInput) || channelInput;
    const channelType  = masterData.channelTypes.get(channelInput) || '';
    const storeName    = masterData.storeNames.get(storeCode) || '';
    const category     = masterData.productCategories.get(productCode) || '';
    const key = `${channelName}|${storeCode}|${category}`;

    if (!map.has(key)) {
      map.set(key, { channelName, channelType, storeCode, storeName, category, count: 0, amount: 0, shipping: 0, fee: 0 });
    }
    const g = map.get(key);
    g.count    += 1;
    g.amount   += Number(row[COL.AMOUNT])   || 0;
    g.shipping += Number(row[COL.SHIPPING]) || 0;
    g.fee      += Number(row[COL.FEE])      || 0;
  });

  const rows = [...map.values()].map(g => [
    g.channelName, g.channelType, g.storeCode, g.storeName, g.category,
    g.count, g.amount, g.shipping, g.fee,
  ]);

  _writeCsv(folder, `sales_report_${year}${month}.csv`, [headers, ...rows]);
  Logger.log('売上集計レポートCSV出力完了');
}

// ----------------------------------------------------------------
// 3. 税理士・会計事務所提出用CSV
// ----------------------------------------------------------------

function _exportTaxAccountant(salesData, masterData, year, month, folder) {
  const headers = ['注文番号','売上日','正規チャネル名','チャネル種別','店舗コード','店舗名','商品コード','商品名','カテゴリ','数量','単価','売上金額','税区分','借方勘定科目','貸方勘定科目','摘要'];

  const rows = salesData.map(row => {
    const channelInput = String(row[COL.CHANNEL]).trim();
    const storeCode    = String(row[COL.STORE_CODE]).trim();
    const productCode  = String(row[COL.PRODUCT_CODE]).trim();
    const productName  = String(row[COL.PRODUCT_NAME]).trim();
    const channelName  = masterData.channelNames.get(channelInput) || channelInput;
    const channelType  = masterData.channelTypes.get(channelInput) || '';
    const storeName    = masterData.storeNames.get(storeCode) || '';
    const category     = masterData.productCategories.get(productCode) || '';
    const rule         = _findAccountingRule(masterData.accountingRules, category, channelType);
    const summary      = rule
      ? rule.summary.replace('{チャネル}', channelName).replace('{商品名}', productName)
      : `${channelName}売上 ${productName}`;

    return [
      row[COL.ORDER_NO], row[COL.DATE],
      channelName, channelType, storeCode, storeName,
      productCode, productName, category,
      row[COL.QTY], row[COL.UNIT_PRICE], row[COL.AMOUNT],
      rule ? rule.taxType : '',
      rule ? rule.debit   : '',
      rule ? rule.credit  : '',
      summary,
    ];
  });

  _writeCsv(folder, `tax_accountant_${year}${month}.csv`, [headers, ...rows]);
  Logger.log('税理士提出用CSV出力完了');
}

// ----------------------------------------------------------------
// 4. BI/分析ツール取込用CSV
// ----------------------------------------------------------------

function _exportBI(salesData, masterData, year, month, folder) {
  const headers = ['注文番号','売上日','正規チャネル名','チャネル種別','店舗コード','店舗名','地域','都道府県','商品コード','商品名','カテゴリ','数量','単価','売上金額','送料','手数料','正規支払方法名','支払種別','顧客区分'];

  const rows = salesData.map(row => {
    const channelInput = String(row[COL.CHANNEL]).trim();
    const storeCode    = String(row[COL.STORE_CODE]).trim();
    const productCode  = String(row[COL.PRODUCT_CODE]).trim();
    const paymentInput = String(row[COL.PAYMENT]).trim();
    const info         = masterData.storeInfo.get(storeCode) || {};

    return [
      row[COL.ORDER_NO], row[COL.DATE],
      masterData.channelNames.get(channelInput) || channelInput,
      masterData.channelTypes.get(channelInput) || '',
      storeCode,
      info.name       || '',
      info.region     || '',
      info.prefecture || '',
      productCode,
      String(row[COL.PRODUCT_NAME]).trim(),
      masterData.productCategories.get(productCode) || '',
      row[COL.QTY], row[COL.UNIT_PRICE], row[COL.AMOUNT],
      row[COL.SHIPPING], row[COL.FEE],
      masterData.paymentNames.get(paymentInput) || paymentInput,
      masterData.paymentTypes.get(paymentInput) || '',
      row[COL.CUSTOMER],
    ];
  });

  _writeCsv(folder, `bi_${year}${month}.csv`, [headers, ...rows]);
  Logger.log('BI分析用CSV出力完了');
}

// ----------------------------------------------------------------
// 共通ユーティリティ
// ----------------------------------------------------------------

function _loadSalesDataForExport(year, month) {
  const ss    = SpreadsheetApp.openById(CONFIG.SALES_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('売上データ');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const tz     = Session.getScriptTimeZone();
  const prefix = `${year}/${month}/`;

  return sheet.getDataRange().getValues().slice(1).map(row => {
    const dateVal = row[COL.DATE];
    row[COL.DATE] = dateVal instanceof Date
      ? Utilities.formatDate(dateVal, tz, 'yyyy/MM/dd')
      : String(dateVal).trim();
    return row;
  }).filter(row => row[COL.DATE].startsWith(prefix));
}

function _loadMasterDataForExport() {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);

  const channelRows = ss.getSheetByName('販売チャネル').getDataRange().getValues().slice(1);
  const channelNames = new Map(channelRows.map(r => [String(r[2]).trim(), String(r[1]).trim()]));
  const channelTypes = new Map(channelRows.map(r => [String(r[2]).trim(), String(r[3]).trim()]));

  const storeRows = ss.getSheetByName('店舗マスタ').getDataRange().getValues().slice(1);
  const storeNames = new Map(storeRows.map(r => [String(r[0]).trim(), String(r[1]).trim()]));
  const storeInfo  = new Map(storeRows.map(r => [String(r[0]).trim(), {
    name:       String(r[1]).trim(),
    region:     String(r[2]).trim(),
    prefecture: String(r[3]).trim(),
  }]));

  const productRows = ss.getSheetByName('商品マスタ').getDataRange().getValues().slice(1);
  const productCategories = new Map(productRows.map(r => [String(r[0]).trim(), String(r[2]).trim()]));

  const paymentRows = ss.getSheetByName('支払方法').getDataRange().getValues().slice(1);
  const paymentNames = new Map(paymentRows.map(r => [String(r[2]).trim(), String(r[1]).trim()]));
  const paymentTypes = new Map(paymentRows.map(r => [String(r[2]).trim(), String(r[3]).trim()]));

  const ruleRows = ss.getSheetByName('会計ルール').getDataRange().getValues().slice(1);
  const accountingRules = ruleRows.map(r => ({
    category:    String(r[1]).trim(),
    channelType: String(r[2]).trim(),
    debit:       String(r[3]).trim(),
    credit:      String(r[4]).trim(),
    taxType:     String(r[5]).trim(),
    summary:     String(r[6]).trim(),
  }));

  return { channelNames, channelTypes, storeNames, storeInfo, productCategories, paymentNames, paymentTypes, accountingRules };
}

function _findAccountingRule(rules, category, channelType) {
  return rules.find(r => r.category === category && r.channelType === channelType) || null;
}

function _getTaxRate(taxType) {
  return taxType === '軽減税率(8%)' ? 0.08 : 0.1;
}

function _writeCsv(folder, filename, rows) {
  const bom     = '﻿';
  const content = bom + rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = Utilities.newBlob(content, 'text/csv', filename);

  const existing = folder.getFilesByName(filename);
  while (existing.hasNext()) existing.next().setTrashed(true);

  folder.createFile(blob);
}
