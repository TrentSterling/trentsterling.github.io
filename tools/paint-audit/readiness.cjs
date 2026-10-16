'use strict';
function isIntermediary(text) { return /Site\s*Unavailable|ERR_.*PROXY|upstream connect error/i.test(text || ''); }
function applyReadiness(summary, { text, status, error, criticalFailures = [], fontsStatus } = {}) {
  const result = { ...summary, unsettledFonts: fontsStatus === 'loading' };
  if (isIntermediary(text) || error || status >= 400 || criticalFailures.length) result.status = 'blocked-or-incomplete';
  else if (result.unsettledFonts && result.status === 'no-observed-delta') result.status = 'inconclusive-fonts-unsettled';
  return result;
}
module.exports = { isIntermediary, applyReadiness };
