// Payment codes live only in memory. All amounts and acceptance decisions come
// from the server; this controller only rejects stale or unusable responses.
function normalizeCode(value) {
  return String(value ?? "").trim();
}

function usableQuote(quote, hasCode) {
  if (!quote || !Number.isSafeInteger(quote.baseCents) || quote.baseCents <= 0
      || !Number.isSafeInteger(quote.discountCents) || quote.discountCents < 0
      || !Number.isSafeInteger(quote.totalCents) || quote.totalCents <= 0
      || quote.totalCents + quote.discountCents !== quote.baseCents
      || typeof quote.currency !== "string" || !/^[a-z]{3}$/i.test(quote.currency)) return false;
  return hasCode
    ? quote.valid === true && quote.reason === "applied" && quote.discountCents > 0
    : quote.valid === false && quote.reason === "empty" && quote.discountCents === 0;
}

export function createPromoQuoteController({ requestQuote, onChange = () => {} }) {
  let code = "";
  let revision = 0;
  let status = "idle";
  let quote = null;
  const snapshot = () => ({ code, status, quote, revision });
  const publish = () => onChange(snapshot());
  const invalidate = () => {
    revision += 1;
    quote = null;
    status = code ? "unverified" : "idle";
    publish();
  };
  const setCode = (value) => {
    const next = normalizeCode(value);
    if (next !== code) {
      code = next;
      invalidate();
    }
    return snapshot();
  };
  const refresh = async () => {
    const requestedCode = code;
    const requestRevision = ++revision;
    status = "loading";
    quote = null;
    publish();
    try {
      const response = await requestQuote(requestedCode);
      if (requestRevision !== revision || code !== requestedCode) return null;
      if (!usableQuote(response, Boolean(requestedCode))) {
        status = requestedCode && response?.valid === false ? "rejected" : "error";
        publish();
        return null;
      }
      // Retain only the public quote. No transport error, private Stripe ID or
      // code returned by a server can accidentally enter the displayed state.
      quote = Object.freeze({
        version: response.version, currency: response.currency.toLowerCase(),
        baseCents: response.baseCents, discountCents: response.discountCents,
        totalCents: response.totalCents, valid: response.valid, reason: response.reason
      });
      status = "ready";
      publish();
      return quote;
    } catch {
      if (requestRevision !== revision || code !== requestedCode) return null;
      status = "error";
      publish();
      return null;
    }
  };
  const prepareCheckout = async () => {
    const requestCode = code;
    const confirmed = await refresh();
    if (!confirmed || status !== "ready" || code !== requestCode) {
      const error = new Error("A current server quote is required before payment.");
      error.code = "PRICE_QUOTE_REQUIRED";
      throw error;
    }
    return Object.freeze({ promoCode: code, quote: confirmed, revision });
  };
  const isCurrent = (ticket) => Boolean(ticket && ticket.revision === revision
    && ticket.promoCode === code && ticket.quote === quote && status === "ready");
  return { snapshot, setCode, refresh, invalidate, prepareCheckout, isCurrent };
}
