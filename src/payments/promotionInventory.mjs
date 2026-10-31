// Read the existing native single-use stock. Never mint a promotion or expose
// its clear code. The private operator registry is preserved across deploys.
import { readdir, readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { eligiblePromotion, STRIPE_PROMOTION_API_VERSION } from "./stripePromotionCodes.mjs";
import { stripeConfiguration } from "./stripe.mjs";

const UUID_FILE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.json$/i;
const sha = value => createHash("sha256").update(value).digest("hex");
const unavailable = () => Object.assign(new Error("Le stock de réductions ne peut pas être vérifié pour le moment."), {
  status: 503, code: "INVITATION_STOCK_UNAVAILABLE", expected: true
});

export async function readPromotionInventory({ stateDir = "/var/data/lastro-promotions", env = process.env, fetchImpl = globalThis.fetch } = {}) {
  let names;
  try { names = await readdir(stateDir); }
  catch (error) { if (error.code === "ENOENT") return []; throw unavailable(); }
  const candidates = names.filter(name => UUID_FILE.test(name));
  if (candidates.length > 100) throw unavailable();
  const config = stripeConfiguration(env);
  const stock = [];
  const seenIds = new Set();
  for (const name of candidates.sort()) {
    let state;
    try {
      const path = join(stateDir, name), info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 200000) throw unavailable();
      state = JSON.parse(await readFile(path, "utf8"));
    } catch { throw unavailable(); }
    if (state.phase !== "active") continue;
    if (state.schema !== "lastro.private_stripe_discount_batch@1.0.0"
        || `${state.batchId}.json` !== name || state.couponId !== `lstr_d10_${state.batchId.replaceAll("-", "")}`
        || !Array.isArray(state.slots) || state.slots.length !== 50
        || new Set(state.slots.map(slot => slot.id)).size !== 50
        || state.slots.some(slot => !/^promo_[A-Za-z0-9_]+$/.test(slot.id ?? "") || !/^[a-f0-9]{64}$/.test(slot.codeHash ?? ""))) throw unavailable();
    if (!config || typeof fetchImpl !== "function") throw unavailable();
    let data;
    try {
      const query = new URLSearchParams({ coupon: state.couponId, limit: "100" });
      const response = await fetchImpl(`https://api.stripe.com/v1/promotion_codes?${query}`, {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${config.secretKey}`, "Stripe-Version": STRIPE_PROMOTION_API_VERSION }
      });
      if (!response?.ok) throw unavailable();
      data = await response.json();
    } catch { throw unavailable(); }
    if (data?.object !== "list" || data.has_more !== false || !Array.isArray(data.data)
        || data.data.length !== state.slots.length || new Set(data.data.map(p => p.id)).size !== state.slots.length) throw unavailable();
    for (const slot of state.slots) {
      const promotion = data.data.find(p => p.id === slot.id);
      if (!promotion || typeof promotion.code !== "string" || sha(promotion.code.toLowerCase()) !== slot.codeHash
          || promotion.metadata?.batch_id !== state.batchId
          || (typeof promotion.coupon === "string" ? promotion.coupon : promotion.coupon?.id) !== state.couponId
          || seenIds.has(promotion.id)) throw unavailable();
      seenIds.add(promotion.id);
      // Used/disabled codes remain in the original registry and are not offered
      // for another recipient. Quotas are still decided by Stripe at Checkout.
      if (!eligiblePromotion(promotion, promotion.code.toLowerCase(), config.secretKey.includes("_live_"))) continue;
      stock.push({ id: promotion.id, batchId: state.batchId });
    }
  }
  return stock;
}
