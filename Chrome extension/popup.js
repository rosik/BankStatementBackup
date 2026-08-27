// Default range: today (both from and to default to today)
function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const fromInput = document.getElementById("from");
const toInput = document.getElementById("to");
const exportBtn = document.getElementById("export");
const statusEl = document.getElementById("status");

// Pre-fill today
const today = todayInputValue();
fromInput.value = today;
toInput.value = today;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

exportBtn.addEventListener("click", async () => {
  const fromDate = fromInput.value;
  const toDate = toInput.value;

  if (!fromDate || !toDate) {
    setStatus("Укажите обе даты", true);
    return;
  }
  if (fromDate > toDate) {
    setStatus("Дата «С» больше даты «По»", true);
    return;
  }

  exportBtn.disabled = true;
  setStatus("Запрос к Ozon Bank…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.startsWith("https://finance.ozon.ru/")) {
      throw new Error("Откройте страницу https://finance.ozon.ru/ и авторизуйтесь.");
    }

    // Run the export logic inside the page context (so cookies/credentials apply)
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: exportInPage,
      args: [fromDate, toDate],
    });

    if (result && result.error) {
      throw new Error(result.error);
    }

    const count = result ? result.count : 0;
    if (count === 0) {
      setStatus("Нет операций за выбранный период.");
    } else {
      setStatus(`Готово: ${count} операций. Файл скачан.`);
    }
  } catch (e) {
    setStatus(e.message || String(e), true);
  } finally {
    exportBtn.disabled = false;
  }
});

// This function is serialized and injected into the page.
// It must be self-contained (no external references).
async function exportInPage(fromDate, toDate) {
  try {
    const PER_PAGE = 100;
    const ENDPOINT = "https://finance.ozon.ru/apps/pfm/api/operations/groupOperationsV3";

    // The API dateRange is calendar-date based.
    const body = {
      cursorPagination: { perPage: PER_PAGE },
      filter: {
        timeZone: "Europe/Moscow",
        dateRange: { from: fromDate, to: toDate },
        coopAccountIDs: [],
        accountTokens: [],
        effect: "EFFECT_CREDIT",
      },
    };

    const allItems = [];
    let cursor = null;

    do {
      const request = JSON.parse(JSON.stringify(body));
      if (cursor) {
        request.cursorPagination.cursor = cursor;
      }

      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-o3-language": "ru",
        },
        credentials: "include",
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      }

      const json = await resp.json();
      const group = json?.data?.me?.client?.groupOperationsV3;
      if (!group) {
        throw new Error("Неожиданный ответ API");
      }

      allItems.push(...(group.items || []));
      cursor = group.cursors?.next || null;
    } while (cursor);

    // Convert UTC time to the browser's local timezone, split into date and time
    function toLocalDate(isoUtc) {
      const d = new Date(isoUtc);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    }

    function toLocalTime(isoUtc) {
      const d = new Date(isoUtc);
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${h}:${mi}`;
    }

    function toAmount(cents, sign) {
      const value = cents / 100;
      const s = sign === "NEGATIVE" ? -value : value;
      // Use dot as decimal separator, two decimals
      return s.toFixed(2);
    }

    function csvEscape(value) {
      if (value === null || value === undefined) return "";
      const s = String(value);
      if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    const header = ["Дата", "Время", "Сумма", "Комментарий", "Плательщик"];
    const rows = [header.join(",")];

    for (const item of allItems) {
      const date = toLocalDate(item.time);
      const time = toLocalTime(item.time);
      const amount = toAmount(item.accountAmount?.amountAbs?.cents ?? 0, item.accountAmount?.sign);
      const comment = csvEscape(item.comment);
      // Combine purpose and counterpartyName into a single column
      const purpose = item.purpose || "";
      const counterparty = item.counterpartyName || "";
      const payer = csvEscape(`${purpose}, ${counterparty}`);
      rows.push([date, time, amount, comment, payer].join(","));
    }

    // Prepend BOM so Excel detects UTF-8
    const csv = "\uFEFF" + rows.join("\r\n");

    // Trigger download from the page context
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OzonBank_${fromDate}_to_${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { count: allItems.length };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}
