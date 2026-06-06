/**
 * 設定ファイル
 *
 * セットアップ手順:
 *   1. MASTER_CSV_FOLDER_ID に data/master の CSV を置いた Drive フォルダのIDを設定
 *   2. setup.gs の setupMasterSpreadsheet() を実行
 *   3. ログに表示された Spreadsheet ID を MASTER_SPREADSHEET_ID に設定
 *   4. INPUT_FOLDER_ID・OUTPUT_FOLDER_ID を設定して完了
 *
 * フォルダIDの確認方法:
 *   Google Drive でフォルダを開き、URLの末尾の文字列がフォルダID
 *   例) https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXXXX
 *                                                ↑ これがフォルダID
 */

const CONFIG = {
  // data/master の CSV ファイルを置いた Drive フォルダのID（setup.gs が参照）
  MASTER_CSV_FOLDER_ID: '',

  // マスタデータスプレッドシートのID（setup.gs 実行後に設定）
  MASTER_SPREADSHEET_ID: '',

  // 売上CSVを配置するGoogle DriveフォルダのID
  INPUT_FOLDER_ID: '',

  // 処理済みファイルの出力先フォルダのID
  OUTPUT_FOLDER_ID: '',

  // Slack Webhook URL（通知機能を使う場合に設定）
  SLACK_WEBHOOK_URL: '',
};
