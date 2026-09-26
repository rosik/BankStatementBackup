# BankStatementBackup

Export Ozon Bank income and expense operations for a date range to CSV from a Chrome extension.

## What it does

Adds a popup with two date inputs (**С даты** / **По дату**, both default to today). When you click **Выгрузить CSV**, the extension calls the Ozon Bank operations API (`groupOperationsV3`) from the active `finance.ozon.ru` tab (using your existing login session/cookies), fetches both income (`EFFECT_CREDIT`) and expenses (`EFFECT_DEBIT`), paginates through all results (`perPage: 100`), and downloads one chronologically sorted CSV file.

### CSV columns

`Дата`, `Время`, `Сумма`, `Комментарий`, `Плательщик`

- `Дата` — operation date in the browser's local timezone, format `YYYY-MM-DD`
- `Время` — operation time in the browser's local timezone, format `HH:MM`
- `Сумма` — rubles with two decimals (negative for debits)
- `Комментарий` — the API `comment` field
- `Плательщик` — combined from the API `purpose` and `counterpartyName` fields as `<purpose>, <counterpartyName>`

The file is named `OzonBank_<from>_to_<to>.csv` (e.g. `OzonBank_2026-08-28_to_2026-08-28.csv`) and saved to your Downloads folder. A UTF-8 BOM is included so Excel opens it correctly.

### Date handling

The API `dateRange` filter is calendar-date based. `from` and `to` are sent as the selected dates, so all operations in that inclusive range are returned regardless of timezone.

## Install (load unpacked)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `BankStatementBackup/Chrome extension` folder (the one containing `manifest.json`)
5. Pin the extension icon to the toolbar

## Use

1. Open `https://finance.ozon.ru/` and log in (keep the tab open)
2. Click the extension icon
3. Pick **С даты** and **По дату** (both default to today)
4. Click **Выгрузить CSV**
5. The CSV downloads automatically

> The extension only works while you have an active, logged-in `finance.ozon.ru` tab. It exports both incoming operations (`EFFECT_CREDIT`) and expenses (`EFFECT_DEBIT`).
