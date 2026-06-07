/**
 * マスタデータ初期セットアップスクリプト
 *
 * 事前準備:
 *   1. data/master/ の CSV ファイルをGoogle Driveの任意フォルダにアップロード
 *   2. そのフォルダのIDを config.gs の MASTER_CSV_FOLDER_ID に設定
 *
 * 実行方法:
 *   Apps Script エディタで setupMasterSpreadsheet() を選択して実行
 *   → 権限の確認が出たら「許可」
 *   → ログに表示されたスプレッドシートIDを config.gs の MASTER_SPREADSHEET_ID に設定
 */

// CSVファイル名 → スプレッドシートのシート名 の対応表
const MASTER_SHEET_MAP = [
  { file: 'products.csv',         sheet: '商品マスタ'   },
  { file: 'sales_channels.csv',   sheet: '販売チャネル' },
  { file: 'accounting_rules.csv', sheet: '会計ルール'   },
  { file: 'stores.csv',           sheet: '店舗マスタ'   },
  { file: 'payment_methods.csv',  sheet: '支払方法'     },
];

function setupMasterSpreadsheet() {
  if (!CONFIG.MASTER_CSV_FOLDER_ID) {
    throw new Error('config.gs の MASTER_CSV_FOLDER_ID を設定してください。');
  }

  const folder = DriveApp.getFolderById(CONFIG.MASTER_CSV_FOLDER_ID);
  const ss = CONFIG.MASTER_SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID)
    : SpreadsheetApp.create('【サンプル】売上管理 マスタデータ');

  Logger.log(CONFIG.MASTER_SPREADSHEET_ID ? '既存スプレッドシートを使用します' : 'スプレッドシートを作成しました');

  MASTER_SHEET_MAP.forEach(({ file, sheet }) => {
    const csvFile = _findFile(folder, file);
    if (!csvFile) {
      Logger.log('  [SKIP] ' + file + ' が見つかりません');
      return;
    }
    const rows = _parseCsv(csvFile);
    _writeSheet(ss, sheet, rows);
  });

  // 自動生成されるデフォルトシートを削除
  ['Sheet1', 'シート1'].forEach(name => {
    const s = ss.getSheetByName(name);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  Logger.log('========================================');
  Logger.log('セットアップ完了');
  Logger.log('URL : ' + ss.getUrl());
  Logger.log('ID  : ' + ss.getId());
  Logger.log('↑ このIDを config.gs の MASTER_SPREADSHEET_ID に設定してください');
  Logger.log('========================================');
}

// ----------------------------------------------------------------
// ユーティリティ関数
// ----------------------------------------------------------------

/**
 * フォルダ内からファイル名で1件取得する
 */
function _findFile(folder, filename) {
  const files = folder.getFilesByName(filename);
  if (!files.hasNext()) return null;
  return files.next();
}

/**
 * DriveファイルのCSVを2次元配列に変換する
 * UTF-8 BOM（Excel出力で付くことがある）も除去する
 */
function _parseCsv(file) {
  const raw = file.getBlob().getDataAsString('UTF-8');
  const content = raw.replace(/^﻿/, ''); // BOM除去
  return Utilities.parseCsv(content);
}

/**
 * 2次元配列をスプレッドシートの指定シートに書き込む
 * rows[0] をヘッダー行として装飾する
 */
function _writeSheet(ss, sheetName, rows) {
  if (!rows || rows.length === 0) return;

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clearContents();
  }

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // ヘッダー行の装飾
  const headerRange = sheet.getRange(1, 1, 1, rows[0].length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#E8F0FE');
  headerRange.setFontColor('#1A237E');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);

  Logger.log('  ' + sheetName + ': ' + (rows.length - 1) + '件');
}
