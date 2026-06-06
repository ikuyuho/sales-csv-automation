#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
架空サンプルCSVデータ生成スクリプト
国産雑貨・日用品 EC/卸売事業者向け バックオフィス自動化ポートフォリオ用
※ このデータはすべて架空です。実在の企業・人物・商品とは一切関係ありません。
"""

import csv
import random
import os
from datetime import date, timedelta

random.seed(42)

BASE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(BASE, 'master')
RAW    = os.path.join(BASE, 'raw')

# ================================================================
# マスタデータ定義
# ================================================================

PRODUCTS = [
    # (商品コード, 商品名, カテゴリ, 標準単価, 税区分, 勘定科目)
    ('P001', '桐のまな板（中）',              'キッチン用品',  3800,  '標準税率(10%)', '売上高'),
    ('P002', '竹製スパチュラセット',           'キッチン用品',  1980,  '標準税率(10%)', '売上高'),
    ('P003', '白磁小鉢3点セット',              '食器・雑貨',    2400,  '標準税率(10%)', '売上高'),
    ('P004', '国産桧の風呂椅子',               '日用品',        4200,  '標準税率(10%)', '売上高'),
    ('P005', '天然ゴムまな板シート',           'キッチン用品',   890,  '標準税率(10%)', '売上高'),
    ('P006', '純綿ふきん5枚組',                '日用品',        1200,  '標準税率(10%)', '売上高'),
    ('P007', '和紙ラッピングセット',           'ギフト用品',     650,  '標準税率(10%)', '売上高'),
    ('P008', '国産杉の一輪挿し',               '雑貨',          1800,  '標準税率(10%)', '売上高'),
    ('P009', '有機玄米（2kg）',                '食品',          1600,  '軽減税率(8%)',  '売上高'),
    ('P010', '九州産はちみつ（200g）',         '食品',          1450,  '軽減税率(8%)',  '売上高'),
    ('P011', '梅干し詰め合わせギフト',         'ギフト用品',    2800,  '軽減税率(8%)',  '売上高'),
    ('P012', '鉄製南部鉄瓶（小）',             'キッチン用品',  8500,  '標準税率(10%)', '売上高'),
    ('P013', '漆塗り箸2膳セット',              '食器・雑貨',    3200,  '標準税率(10%)', '売上高'),
    ('P014', '手ぬぐい（注染）',               '雑貨',          1100,  '標準税率(10%)', '売上高'),
    ('P015', '和風アロマキャンドルセット',     '雑貨',          2200,  '標準税率(10%)', '売上高'),
    ('P016', '竹製歯ブラシ3本組',              '日用品',         980,  '標準税率(10%)', '売上高'),
    ('P017', '国産みりん（500ml）',            '食品',           780,  '軽減税率(8%)',  '売上高'),
    ('P018', 'だし昆布詰め合わせ（50g）',      '食品',           950,  '軽減税率(8%)',  '売上高'),
    ('P019', '木製コースター4枚組',            '雑貨',          1600,  '標準税率(10%)', '売上高'),
    ('P020', '信楽焼マグカップ',               '食器・雑貨',    2600,  '標準税率(10%)', '売上高'),
    ('P021', '和紙メモパッド',                 '文具・雑貨',     480,  '標準税率(10%)', '売上高'),
    ('P022', '天然わっぱ弁当箱（小）',         'キッチン用品',  4800,  '標準税率(10%)', '売上高'),
    ('P023', '米糠石鹸（2個セット）',          '日用品',        1380,  '標準税率(10%)', '売上高'),
    ('P024', '和風ギフトボックスM',            'ギフト用品',     320,  '標準税率(10%)', '売上高'),
    ('P025', '国産ごま油（170g）',             '食品',           680,  '軽減税率(8%)',  '売上高'),
    ('P026', '桐のお重（3段）',                'キッチン用品', 12000,  '標準税率(10%)', '売上高'),
    ('P027', '麻素材トートバッグ',             '雑貨',          2800,  '標準税率(10%)', '売上高'),
    ('P028', '有機緑茶ティーバッグ（30袋）',  '食品',          1200,  '軽減税率(8%)',  '売上高'),
    ('P029', '陶器の醤油差し',                 '食器・雑貨',    1450,  '標準税率(10%)', '売上高'),
    ('P030', '和風ギフトラッピングリボン',     'ギフト用品',     280,  '標準税率(10%)', '売上高'),
]

CHANNELS = [
    # (チャネルID, 正規チャネル名, 入力値, チャネル種別, 備考)
    ('CH001', 'Shopify',  'Shopify',  'EC',     '正規表記'),
    ('CH002', 'Shopify',  'shopify',  'EC',     '表記ゆれ：小文字'),
    ('CH003', '楽天市場', '楽天市場', 'EC',     '正規表記'),
    ('CH004', '楽天市場', '楽天',     'EC',     '表記ゆれ：略称'),
    ('CH005', 'Amazon',   'Amazon',   'EC',     '正規表記'),
    ('CH006', 'Amazon',   'amazon',   'EC',     '表記ゆれ：小文字'),
    ('CH007', 'Amazon',   'AMAZON',   'EC',     '表記ゆれ：全大文字'),
    ('CH008', '店舗POS',  '店舗POS',  '実店舗', '正規表記'),
    ('CH009', '店舗POS',  'POS',      '実店舗', '表記ゆれ：略称'),
    ('CH010', '卸販売',   '卸販売',   '卸売',   '正規表記'),
    ('CH011', '卸販売',   '卸売',     '卸売',   '表記ゆれ'),
    ('CH012', '卸販売',   '卸',       '卸売',   '表記ゆれ：略称'),
]

ACCOUNTING_RULES = [
    # (ルールID, 対象カテゴリ, 対象チャネル種別, 借方勘定科目, 貸方勘定科目, 税区分, 摘要テンプレート)
    ('AR001', '食品',       'EC',     '売掛金',     '売上高', '軽減税率(8%)',  '{チャネル}売上 {商品名} 軽減税率'),
    ('AR002', '食品',       '実店舗', '現金・預金', '売上高', '軽減税率(8%)',  '店舗売上 {商品名} 軽減税率'),
    ('AR003', '食品',       '卸売',   '売掛金',     '売上高', '軽減税率(8%)',  '卸売売上 {商品名} 軽減税率'),
    ('AR004', 'キッチン用品','EC',    '売掛金',     '売上高', '標準税率(10%)', '{チャネル}売上 {商品名}'),
    ('AR005', 'キッチン用品','実店舗','現金・預金', '売上高', '標準税率(10%)', '店舗売上 {商品名}'),
    ('AR006', '日用品',     'EC',     '売掛金',     '売上高', '標準税率(10%)', '{チャネル}売上 {商品名}'),
    ('AR007', '日用品',     '実店舗', '現金・預金', '売上高', '標準税率(10%)', '店舗売上 {商品名}'),
    ('AR008', '雑貨',       'EC',     '売掛金',     '売上高', '標準税率(10%)', '{チャネル}売上 {商品名}'),
    ('AR009', 'ギフト用品', 'EC',     '売掛金',     '売上高', '標準税率(10%)', '{チャネル}ギフト売上 {商品名}'),
    ('AR010', 'ギフト用品', '卸売',   '売掛金',     '売上高', '標準税率(10%)', '卸売ギフト売上 {商品名}'),
    ('AR011', '食器・雑貨', 'EC',     '売掛金',     '売上高', '標準税率(10%)', '{チャネル}売上 {商品名}'),
    ('AR012', '文具・雑貨', 'EC',     '売掛金',     '売上高', '標準税率(10%)', '{チャネル}売上 {商品名}'),
]

STORES = [
    # (店舗コード, 店舗名, 地域, 都道府県, 備考)
    ('S001', '花まるや 渋谷店', '関東', '東京都',   '旗艦店'),
    ('S002', '花まるや 横浜店', '関東', '神奈川県', ''),
    ('S003', '花まるや 京都店', '関西', '京都府',   ''),
    ('S004', '花まるや 梅田店', '関西', '大阪府',   ''),
    ('S005', '花まるや 福岡店', '九州', '福岡県',   ''),
]

PAYMENT_METHODS = [
    # (支払方法ID, 正規支払方法名, 入力値, 支払種別)
    ('PM001', 'クレジットカード', 'クレジットカード', 'カード決済'),
    ('PM002', 'クレジットカード', 'クレカ',           'カード決済'),
    ('PM003', 'クレジットカード', 'CREDIT',           'カード決済'),
    ('PM004', '銀行振込',         '銀行振込',         '振込'),
    ('PM005', '銀行振込',         '振込',             '振込'),
    ('PM006', '現金',             '現金',             '現金'),
    ('PM007', '代引き',           '代引き',           '代引き'),
    ('PM008', '代引き',           '代金引換',         '代引き'),
    ('PM009', '請求書払い',       '請求書払い',       '後払い'),
    ('PM010', '請求書払い',       '後払い',           '後払い'),
    ('PM011', 'コンビニ払い',     'コンビニ払い',     '後払い'),
    ('PM012', 'PayPay',           'PayPay',           'QR決済'),
]

# ================================================================
# CSV書き込みユーティリティ
# ================================================================

def write_csv(filepath, headers, rows):
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f'  Created: {os.path.relpath(filepath)}  ({len(rows)} rows)')

# ================================================================
# マスタ CSV 出力
# ================================================================

print('=== マスタCSV生成 ===')

write_csv(os.path.join(MASTER, 'products.csv'),
    ['商品コード', '商品名', 'カテゴリ', '標準単価', '税区分', '勘定科目'],
    PRODUCTS)

write_csv(os.path.join(MASTER, 'sales_channels.csv'),
    ['チャネルID', '正規チャネル名', '入力値', 'チャネル種別', '備考'],
    CHANNELS)

write_csv(os.path.join(MASTER, 'accounting_rules.csv'),
    ['ルールID', '対象カテゴリ', '対象チャネル種別', '借方勘定科目', '貸方勘定科目', '税区分', '摘要テンプレート'],
    ACCOUNTING_RULES)

write_csv(os.path.join(MASTER, 'stores.csv'),
    ['店舗コード', '店舗名', '地域', '都道府県', '備考'],
    STORES)

write_csv(os.path.join(MASTER, 'payment_methods.csv'),
    ['支払方法ID', '正規支払方法名', '入力値', '支払種別'],
    PAYMENT_METHODS)

# ================================================================
# 売上データ生成
# ================================================================

print('\n=== 売上データ生成 ===')

START_DATE = date(2026, 5, 1)
END_DATE   = date(2026, 5, 31)

def rand_date(fmt='%Y/%m/%d'):
    d = START_DATE + timedelta(days=random.randint(0, 30))
    return d.strftime(fmt)

EC_CH   = ['Shopify', 'shopify', '楽天市場', '楽天', 'Amazon', 'amazon', 'AMAZON']
POS_CH  = ['店舗POS', 'POS']
WS_CH   = ['卸販売', '卸売', '卸']

EC_PAY  = ['クレジットカード', 'クレカ', 'CREDIT', '銀行振込', '振込',
           '代引き', '代金引換', 'コンビニ払い', 'PayPay']
POS_PAY = ['現金', 'クレジットカード', 'クレカ', 'PayPay']
WS_PAY  = ['銀行振込', '振込', '請求書払い', '後払い']

STORE_CODES = [s[0] for s in STORES]

EC_REM  = ['', '', '', '', 'ギフト包装希望', 'のし対応希望', '急ぎ対応希望', '']
POS_REM = ['', '', '', 'ポイント利用', 'ギフト購入', '']
WS_REM  = ['', '', '定期注文', 'サンプル含む', '請求書別送', '']

_order_n = [1000]
def next_order():
    _order_n[0] += 1
    return f'ORD-202605-{_order_n[0]}'

def make_normal_row(order_no, ch_type):
    code, name, _, price, _, _ = random.choice(PRODUCTS)

    if ch_type == 'ec':
        ch       = random.choice(EC_CH)
        store    = ''
        qty      = random.choices([1,2,3,4,5], weights=[35,30,20,10,5])[0]
        payment  = random.choice(EC_PAY)
        ctype    = random.choices(['個人','法人'], weights=[85,15])[0]
        remark   = random.choice(EC_REM)
        shipping = random.choices([0,500,800], weights=[70,20,10])[0]
        fee      = int(price * qty * random.choice([0.03, 0.05, 0.10]))
    elif ch_type == 'pos':
        ch       = random.choice(POS_CH)
        store    = random.choice(STORE_CODES)
        qty      = random.choices([1,2,3], weights=[55,30,15])[0]
        payment  = random.choice(POS_PAY)
        ctype    = '個人'
        remark   = random.choice(POS_REM)
        shipping = 0
        fee      = 0
    else:  # wholesale
        ch       = random.choice(WS_CH)
        store    = ''
        qty      = random.choices([3,5,10,20,30], weights=[20,30,25,15,10])[0]
        payment  = random.choice(WS_PAY)
        ctype    = random.choices(['法人','卸先'], weights=[30,70])[0]
        remark   = random.choice(WS_REM)
        shipping = random.choices([0,1000], weights=[75,25])[0]
        fee      = 0

    amount = qty * price
    return [order_no, rand_date(), ch, store, code, name,
            qty, price, amount, shipping, fee, payment, ctype, remark]

# ---------- 正常データ (EC:~150行, POS:~80行, 卸:~70行 → trim to 269) ----------
normal_rows = []

for _ in range(90):   # EC orders
    ono = next_order()
    for _ in range(random.choices([1,2,3], weights=[50,35,15])[0]):
        normal_rows.append(make_normal_row(ono, 'ec'))

for _ in range(55):   # POS orders
    ono = next_order()
    for _ in range(random.choices([1,2,3], weights=[60,30,10])[0]):
        normal_rows.append(make_normal_row(ono, 'pos'))

for _ in range(30):   # Wholesale orders
    ono = next_order()
    for _ in range(random.choices([1,2,3,4], weights=[25,35,25,15])[0]):
        normal_rows.append(make_normal_row(ono, 'wholesale'))

random.shuffle(normal_rows)
normal_rows = normal_rows[:269]

# ---------- エラーデータ (計31行) ----------
# 意図的に混ぜるエラー種別を明記したコメント付き

error_rows = []

# E1: 商品コードが空欄 (3行)
for _ in range(3):
    _, name, _, price, _, _ = random.choice(PRODUCTS)
    ono = next_order()
    qty = random.randint(1, 3)
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       '',  # ← 商品コードが空欄
                       name, qty, price, qty*price, 0, 0,
                       random.choice(EC_PAY), '個人', ''])

# E2: 存在しない商品コード (3行)
for fake_code in ['X999', 'P099', 'Z001']:
    ono  = next_order()
    pr   = random.choice([980, 1980, 3800])
    qty  = random.randint(1, 3)
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       fake_code, f'架空商品{fake_code}',  # ← マスタ非存在コード
                       qty, pr, qty*pr, 0, 0,
                       random.choice(EC_PAY), '個人', ''])

# E3: 商品名が商品マスタと一致しない (3行)
for code, name, _, price, _, _ in random.sample(PRODUCTS, 3):
    ono = next_order()
    qty = random.randint(1, 3)
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       code, name + '（旧モデル）',  # ← 商品名が不一致
                       qty, price, qty*price, 0, 0,
                       random.choice(EC_PAY), '個人', ''])

# E4: 単価が標準単価と異なる (3行)
for code, name, _, price, _, _ in random.sample(PRODUCTS, 3):
    ono        = next_order()
    qty        = random.randint(1, 3)
    wrong_pr   = int(price * 0.8)   # ← 20%オフの誤入力
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       code, name, qty, wrong_pr, qty*wrong_pr, 0, 0,
                       random.choice(EC_PAY), '個人', ''])

# E5: 売上金額が数量×単価と一致しない (3行)
for code, name, _, price, _, _ in random.sample(PRODUCTS, 3):
    ono    = next_order()
    qty    = random.randint(2, 5)
    offset = random.choice([-500, -100, 100, 500])
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       code, name, qty, price,
                       qty*price + offset,  # ← 金額不一致
                       0, 0, random.choice(EC_PAY), '個人', ''])

# E6: 注文番号×商品コードの組み合わせが重複 (3組=6行)
for code, name, _, price, _, _ in random.sample(PRODUCTS, 3):
    ono = next_order()
    qty = random.randint(1, 3)
    row = [ono, rand_date(), random.choice(EC_CH), '',
           code, name, qty, price, qty*price, 0, 0,
           random.choice(EC_PAY), '個人', '']
    error_rows.append(row)
    error_rows.append(row[:])   # ← 全く同じ行を重複追加

# E7: 数量が0またはマイナス (2行)
for qty_err in [0, -2]:
    code, name, _, price, _, _ = random.choice(PRODUCTS)
    ono = next_order()
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       code, name,
                       qty_err, price, qty_err*price,  # ← 数量が異常値
                       0, 0, random.choice(EC_PAY), '個人', ''])

# E8: 単価が空欄 (2行)
for _ in range(2):
    code, name, _, _, _, _ = random.choice(PRODUCTS)
    ono = next_order()
    qty = random.randint(1, 3)
    error_rows.append([ono, rand_date(), random.choice(EC_CH), '',
                       code, name, qty,
                       '', '',  # ← 単価・売上金額が空欄
                       0, 0, random.choice(EC_PAY), '個人', ''])

# E9: 日付形式が異なる (3行)
for fmt in ['%Y-%m-%d', '%Y%m%d', '%m/%d/%Y']:
    code, name, _, price, _, _ = random.choice(PRODUCTS)
    ono = next_order()
    qty = random.randint(1, 3)
    d   = START_DATE + timedelta(days=random.randint(0, 30))
    error_rows.append([ono, d.strftime(fmt), random.choice(EC_CH), '',  # ← 日付フォーマット違い
                       code, name, qty, price, qty*price, 0, 0,
                       random.choice(EC_PAY), '個人', ''])

# E10: 店舗POSなのに店舗コードが空欄 (3行)
for _ in range(3):
    code, name, _, price, _, _ = random.choice(PRODUCTS)
    ono = next_order()
    qty = random.randint(1, 3)
    error_rows.append([ono, rand_date(), '店舗POS',
                       '',  # ← POS売上なのに店舗コードが空欄
                       code, name, qty, price, qty*price, 0, 0,
                       random.choice(POS_PAY), '個人', ''])

# 合計: 3+3+3+3+3+6+2+2+3+3 = 31行

# ================================================================
# 統合・シャッフル・300行出力
# ================================================================

all_rows = normal_rows + error_rows   # 269 + 31 = 300
random.shuffle(all_rows)

SALES_HEADERS = [
    '注文番号', '売上日', '販売チャネル', '店舗コード',
    '商品コード', '商品名', '数量', '単価', '売上金額',
    '送料', '手数料', '支払方法', '顧客区分', '備考',
]

write_csv(os.path.join(RAW, 'sales_raw.csv'), SALES_HEADERS, all_rows)

print(f'\n  正常データ : {len(normal_rows)} 行')
print(f'  エラーデータ: {len(error_rows)} 行')
print(f'  合計        : {len(all_rows)} 行')
print('\n完了しました。')
