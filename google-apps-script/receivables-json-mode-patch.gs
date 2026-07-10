/**
 * OPS Portal JSON mode patch for the existing ICBANQ Receivables web app.
 *
 * How to apply:
 * 1) In the existing receivables Apps Script, replace the current doGet(e)
 *    with the doGet(e) below.
 * 2) Paste every helper function in this file near the bottom of the script.
 * 3) Deploy a new web app version.
 * 4) In Vercel, set OPS_RECEIVABLES_WEBAPP_URL to the web app /exec URL.
 *
 * Normal URL:
 *   /exec
 *   -> existing HTML dashboard
 *
 * JSON URL for OPS:
 *   /exec?mode=receivables
 *   -> { ok, updatedAt, summary, records }
 */

function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();

  if (mode === 'receivables') {
    return opsReceivablesJsonOutput_(opsBuildReceivablesPayload_());
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ICBANQ Receivables Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function opsReceivablesJsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function opsBuildReceivablesPayload_() {
  try {
    const overview = typeof getOverviewData === 'function' ? getOverviewData() : null;
    const sourceRecords = overview && Array.isArray(overview.records) ? overview.records : [];
    const records = sourceRecords
      .map((record, index) => opsNormalizeReceivableRecord_(record, index))
      .filter(record => record && record.name && record.expected > 0);

    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      source: 'ICBANQ Receivables Dashboard',
      summary: opsBuildReceivablesSummary_(records),
      records,
      rawOverview: {
        meta: overview && overview.meta ? overview.meta : null,
        kpi: overview && overview.kpi ? overview.kpi : null,
        error: overview && overview.error ? overview.error : ''
      }
    };
  } catch (error) {
    return {
      ok: false,
      updatedAt: new Date().toISOString(),
      message: error && error.message ? error.message : String(error),
      records: []
    };
  }
}

function opsNormalizeReceivableRecord_(record, index) {
  const expected = opsNumber_(record.expected);
  const paid = opsNumber_(record.paid);
  const explicitDiff = opsNumberOrNull_(record.diff);
  const status = opsNormalizeReceivableStatus_(record.status);
  const diff = explicitDiff !== null ? Math.max(0, explicitDiff) : opsInferDiff_(expected, paid, status);

  return {
    id: record.id || ('receivable-live-' + (index + 1)),
    team: String(record.team || '').trim(),
    sales: String(record.sales || '').trim(),
    fSales: String(record.fSales || record.fsales || '').trim(),
    name: String(record.name || record.company || '').trim(),
    expected,
    paid: paid || Math.max(0, expected - diff),
    diff,
    rate: opsNumber_(record.rate) || (expected > 0 ? Math.round(((paid || Math.max(0, expected - diff)) / expected) * 1000) / 10 : 0),
    status,
    gubun: String(record.gubun || '').trim(),
    basis: String(record.basis || '').trim(),
    matched_payer: String(record.matched_payer || record.matchedPayer || '').trim(),
    overdueDays: opsNumber_(record.overdueDays),
    agingBucket: String(record.agingBucket || '').trim()
  };
}

function opsBuildReceivablesSummary_(records) {
  const totalExpected = records.reduce((sum, record) => sum + record.expected, 0);
  const completed = records.filter(record => record.status === '완료');
  const partial = records.filter(record => record.status === '부분수금');
  const unpaid = records.filter(record => record.status === '미수');
  const completedAmount = completed.reduce((sum, record) => sum + record.expected, 0);
  const unpaidAmount = records.reduce((sum, record) => sum + (record.status === '완료' ? 0 : record.diff), 0);

  return {
    totalCount: records.length,
    totalExpected,
    completedCount: completed.length,
    completedAmount,
    partialCount: partial.length,
    partialAmount: partial.reduce((sum, record) => sum + record.diff, 0),
    unpaidCount: unpaid.length,
    unpaidAmount,
    collectionRate: totalExpected > 0 ? Math.round((completedAmount / totalExpected) * 1000) / 10 : 0
  };
}

function opsInferDiff_(expected, paid, status) {
  if (status === '완료') return 0;
  if (expected > 0 && paid > 0) return Math.max(0, expected - paid);
  return Math.max(0, expected);
}

function opsNormalizeReceivableStatus_(value) {
  const text = String(value || '').trim();
  if (text.indexOf('부분') >= 0) return '부분수금';
  if (text.indexOf('미수') >= 0) return '미수';
  if (text.indexOf('완료') >= 0 || text.indexOf('취소') >= 0 || text === 'O') return '완료';
  return '미수';
}

function opsNumber_(value) {
  const number = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function opsNumberOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = opsNumber_(value);
  return Number.isFinite(number) ? number : null;
}
