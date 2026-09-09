function requireAdmin(user) {
  if (user.primaryRole !== "admin") {
    const error = new Error("Admin access required");
    error.status = 403;
    throw error;
  }
}

function publicUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
    primaryRole: user.primaryRole
  };
}

function redactAudit(entry) {
  return {
    id: entry.id,
    actorUserId: entry.actorUserId,
    ownerUserId: entry.ownerUserId,
    action: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    createdAt: entry.createdAt
  };
}

export async function getAdminSummary(store, user) {
  requireAdmin(user);
  const state = await store.load();
  return {
    counts: {
      users: state.users.filter((entry) => !entry.deletedAt).length,
      deletedUsers: state.users.filter((entry) => entry.deletedAt).length,
      persons: state.persons.length,
      analyses: state.analyses.length,
      reports: state.reports.length,
      orders: state.orders.length,
      auditLogs: state.auditLogs.length
    },
    users: state.users.map(publicUserSummary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

export async function listAdminAuditLogs(store, user, input = {}) {
  requireAdmin(user);
  const state = await store.load();
  const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 200);
  const action = input.action ? String(input.action) : null;
  const ownerUserId = input.ownerUserId ? String(input.ownerUserId) : null;

  let auditLogs = state.auditLogs;
  if (action) {
    auditLogs = auditLogs.filter((entry) => entry.action === action);
  }
  if (ownerUserId) {
    auditLogs = auditLogs.filter((entry) => entry.ownerUserId === ownerUserId);
  }

  return {
    auditLogs: auditLogs
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(redactAudit)
  };
}
