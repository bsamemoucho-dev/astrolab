const CREDIT_PLANS = Object.freeze([
  {
    id: "starter",
    name: "Explorateur",
    credits: 10,
    amountCents: 900,
    currency: "EUR",
    productionEligible: false
  },
  {
    id: "complete",
    name: "Analyse complète",
    credits: 50,
    amountCents: 2900,
    currency: "EUR",
    productionEligible: false
  },
  {
    id: "professional",
    name: "Cabinet",
    credits: 150,
    amountCents: 7900,
    currency: "EUR",
    productionEligible: false
  }
]);

const CREDIT_PLAN_BY_ID = new Map(CREDIT_PLANS.map((plan) => [plan.id, plan]));

function now() {
  return new Date().toISOString();
}

function requirePlan(planId) {
  const plan = CREDIT_PLAN_BY_ID.get(planId);
  if (!plan) {
    const error = new Error("Unknown credit plan");
    error.status = 400;
    throw error;
  }
  return plan;
}

function balanceFor(state, userId) {
  return state.creditLedger
    .filter((entry) => entry.ownerUserId === userId)
    .reduce((total, entry) => total + entry.delta, 0);
}

function publicOrder(order) {
  return {
    id: order.id,
    ownerUserId: order.ownerUserId,
    planId: order.planId,
    credits: order.credits,
    amountCents: order.amountCents,
    currency: order.currency,
    status: order.status,
    provider: order.provider,
    createdAt: order.createdAt
  };
}

export async function getCommerceSummary(store, userId) {
  const state = await store.load();
  return {
    balance: balanceFor(state, userId),
    plans: CREDIT_PLANS,
    orders: state.orders.filter((entry) => entry.ownerUserId === userId).map(publicOrder),
    ledger: state.creditLedger.filter((entry) => entry.ownerUserId === userId)
  };
}

export async function createDevelopmentCreditOrder(store, userId, input = {}) {
  const plan = requirePlan(input.planId ?? "starter");

  return store.transact((state) => {
    const order = {
      id: store.id("order"),
      ownerUserId: userId,
      planId: plan.id,
      credits: plan.credits,
      amountCents: plan.amountCents,
      currency: plan.currency,
      status: "paid",
      provider: "development",
      providerReference: null,
      createdAt: now()
    };
    state.orders.push(order);

    const ledgerEntry = {
      id: store.id("credit"),
      ownerUserId: userId,
      orderId: order.id,
      delta: plan.credits,
      reason: "development_credit_grant",
      createdAt: now()
    };
    state.creditLedger.push(ledgerEntry);

    state.auditLogs.push({
      id: store.id("audit"),
      actorUserId: userId,
      ownerUserId: userId,
      action: "credits.granted",
      subjectType: "Order",
      subjectId: order.id,
      before: null,
      after: { order: publicOrder(order), ledgerEntry },
      createdAt: now()
    });

    return {
      order: publicOrder(order),
      ledgerEntry,
      balance: balanceFor(state, userId)
    };
  });
}

export async function consumeCredits(store, userId, input = {}) {
  const amount = Number(input.amount ?? 0);
  if (!Number.isInteger(amount) || amount <= 0) {
    const error = new Error("Credit amount must be a positive integer");
    error.status = 400;
    throw error;
  }

  return store.transact((state) => {
    const currentBalance = balanceFor(state, userId);
    if (currentBalance < amount) {
      const error = new Error("Insufficient credits");
      error.status = 402;
      throw error;
    }

    const ledgerEntry = {
      id: store.id("credit"),
      ownerUserId: userId,
      orderId: null,
      delta: -amount,
      reason: input.reason ?? "manual_consumption",
      createdAt: now()
    };
    state.creditLedger.push(ledgerEntry);

    state.auditLogs.push({
      id: store.id("audit"),
      actorUserId: userId,
      ownerUserId: userId,
      action: "credits.consumed",
      subjectType: "CreditLedger",
      subjectId: ledgerEntry.id,
      before: { balance: currentBalance },
      after: { balance: currentBalance - amount, ledgerEntry },
      createdAt: now()
    });

    return {
      ledgerEntry,
      balance: currentBalance - amount
    };
  });
}
