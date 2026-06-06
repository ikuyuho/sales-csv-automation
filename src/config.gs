/**
 * 設定ファイル
 *
 * セットアップ手順:
 *   1. setup.gs の setupMasterSpreadsheet() を実行
 *   2. ログに表示された Spreadsheet ID を MASTER_SPREADSHEET_ID に設定
 *   3. 売上CSV配置フォルダ・出力フォルダのIDをそれぞれ設定
 */

const CONFIG = {
  // マスタデータスプレッドシートのID（setup.gs 実行後に設定）
  MASTER_SPREADSHEET_ID: '',

  // 売上CSVを配置するGoogle DriveフォルダのID
  INPUT_FOLDER_ID: '',

  // 処理済みファイルの出力先フォルダのID
  OUTPUT_FOLDER_ID: '',

  // Slack Webhook URL（通知機能を使う場合に設定）
  SLACK_WEBHOOK_URL: '',
};
