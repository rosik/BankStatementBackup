# BankStatementBackup
Save client operations from online bank to local disk

## T-Bank

1. Open `chrome://extensions`, enable Developer mode, and load the `Chrome extension` directory with **Load unpacked**. If already installed, reload the extension after updating it.
2. Sign in to the T-Bank website at `https://www.tbank.ru`, then click the extension icon on that tab to attach the network debugger.
3. Open the operation history and select the desired period. If the history was already loaded before attaching, reload the page or change the period to trigger a new history request. Scroll or load more history if needed.
4. Each completed response from `/mybank/api/operations/timeline/public/legacy/v1/operations` is saved to the browser's download directory as `TBank_YYYY-MM-DD_to_YYYY-MM-DD.json`, for example `TBank_2026-09-12_to_2026-09-27.json`. Dates come from the request's `start` and `end` Unix timestamps in milliseconds, formatted in the `Europe/Moscow` timezone. Missing or invalid dates fall back to `TbankClientOperations.json`. Chrome adds a suffix when that filename already exists.

The file contains the complete original JSON response, including the `resultCode`, `trackingId`, and `payload` envelope and every operation field. Query parameters such as the selected period do not affect matching. The extension observes requests made by the page; it does not fetch additional pages or combine, filter, or deduplicate responses. Each file covers only the operations returned in that response. Request URLs, headers, and session parameters are not included in the backup.
