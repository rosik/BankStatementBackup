// Save downloar methor reference for future use
download = chrome.downloads.download;

// Attach network debugger  to current page
chrome.action.onClicked.addListener(function (tab) {
  if (tab.url.startsWith('http')) {
    chrome.debugger.attach({ tabId: tab.id }, '1.2', function () {
      chrome.debugger.sendCommand(
        { tabId: tab.id },
        'Network.enable',
        {},
        function () {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          }
        }
      );
    });
  } else {
    console.log('Debugger can only be attached to HTTP/HTTPS pages.');
  }
});

// Requests buffer. We may need both request and response
const requests = {};

chrome.debugger.onEvent.addListener(function (source, method, params) {

  const requestKey = `${source.tabId}:${params.requestId}`;

  if (method === 'Network.requestWillBeSent') {

    // Redirects reuse request IDs; only retain the current matching request.
    delete requests[requestKey];

    let fileName = whereToSave(params);

    if(!fileName)
      return;

    const request = {
      requestId: params.requestId,
      requestWillBeSent: params,
      requestBody: undefined,
      responseReceived: undefined,
      responseBody: undefined,
      fileName: fileName,
    }

    requests[requestKey] = request;

    return;
  }


  if (method === 'Network.loadingFailed') {
    delete requests[requestKey];
    return;
  }

  if (method === 'Network.loadingFinished') {

    if (!Object.prototype.hasOwnProperty.call(requests, requestKey))
      return;

    const request = requests[requestKey];
    // Read once, after the full response has arrived.
    delete requests[requestKey];

    chrome.debugger.sendCommand(
      { tabId: source.tabId },
      "Network.getResponseBody",
      { "requestId": params.requestId },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Could not read the bank response body.');
          return;
        }
        if (!response || typeof response.body !== 'string') {
          console.error('The bank response body is unavailable.');
          return;
        }
        saveDump(response.body, request.fileName, response.base64Encoded);
      }
    );

    return;
  }

});


async function saveDump(details, fileName, base64Encoded = false) {
  const body = base64Encoded ? details : btoa(unescape(encodeURIComponent(details)));
  const dataURL = `data:application/json;base64,${body}`;

  chrome.downloads.download({
    url: dataURL,
    filename: fileName,
    saveAs: false,
  });
}

/* 
Returns the name of file to be used to save request data 
If request should be ignored returns undefined
*/
function whereToSave(params){

  if (!params.request || typeof params.request.url !== 'string')
    return undefined;

  if (params.request.url === "https://finance.ozon.ru/api/v2/clientOperations")
    return `OzonClientOperations.json`;

  if(params.request.url.startsWith("https://bank.yandex.ru/graphql")){

    let postData = JSON.parse(params.request.postData);

    if(postData.operationName === "GetTransactionFeedView")
      return `YandexClientOperations.json`;
      
  }

  if(params.request.url.startsWith('https://online.vtb.ru/msa/api-gw/private/history-hub/history-hub-homer/v1/history/byAccount?')){
    return `VtbClientOperations.json`;
  }

  if(params.request.url.startsWith('https://omni.online.gpb.ru/omni-operation-history/api/v3/client/operation/list/main')){
    return `GpbClientOperations.json`;
  }

  const tbankOperationsUrl = 'https://www.tbank.ru/mybank/api/operations/timeline/public/legacy/v1/operations';
  if (params.request.url === tbankOperationsUrl || params.request.url.startsWith(tbankOperationsUrl + '?')) {
    const query = new URL(params.request.url).searchParams;
    const formatDate = (timestamp) => {
      if (!/^\d+$/.test(timestamp || ''))
        return undefined;
      const date = new Date(Number(timestamp));
      if (!Number.isFinite(date.getTime()))
        return undefined;
      // Request bounds are Unix milliseconds; use the bank's Moscow calendar dates.
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(date);
      const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
      return `${fields.year}-${fields.month}-${fields.day}`;
    };
    const start = formatDate(query.get('start'));
    const end = formatDate(query.get('end'));
    if (start && end)
      return `TBank_${start}_to_${end}.json`;
    return `TbankClientOperations.json`;
  }

  return undefined;

}
