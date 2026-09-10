import {
  createSessionToken,
  createVerificationCode,
  hashPassword,
  isStrongEnoughPassword,
  normalizeEmail,
  verifyPassword
} from "./security.mjs";

function now() {
  return new Date().toISOString();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    primaryRole: user.primaryRole
  };
}

function authError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function register(store, input) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");

  if (!email.includes("@")) {
    throw authError("Valid email is required");
  }

  if (!isStrongEnoughPassword(password)) {
    throw authError("Password must be at least 10 characters");
  }

  return store.transact((state) => {
    if (state.users.some((user) => user.email === email)) {
      throw authError("Email is already registered", 409);
    }

    const verificationCode = createVerificationCode();
    const user = {
      id: store.id("user"),
      email,
      passwordHash: hashPassword(password),
      emailVerifiedAt: null,
      verificationCode,
      verificationCodeCreatedAt: now(),
      createdAt: now(),
      deletedAt: null,
      primaryRole: "user"
    };

    state.users.push(user);
    state.outbox.push({
      id: store.id("mail"),
      to: email,
      type: "email_verification",
      subject: "Lastro verification code",
      body: `Your Lastro verification code is ${verificationCode}.`,
      createdAt: now()
    });

    return { user: publicUser(user), devVerificationCode: verificationCode };
  });
}

export async function verifyEmail(store, input) {
  const email = normalizeEmail(input.email);
  const code = String(input.code ?? "").trim();

  return store.transact((state) => {
    const user = state.users.find((entry) => entry.email === email);
    if (!user || user.verificationCode !== code) {
      throw authError("Invalid verification code", 401);
    }

    user.emailVerifiedAt = user.emailVerifiedAt ?? now();
    user.verificationCode = null;
    return { user: publicUser(user) };
  });
}

export async function login(store, input) {
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");

  return store.transact((state) => {
    const user = state.users.find((entry) => entry.email === email && !entry.deletedAt);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw authError("Invalid email or password", 401);
    }

    if (!user.emailVerifiedAt) {
      throw authError("Email must be verified before full access", 403);
    }

    const token = createSessionToken();
    const session = {
      id: store.id("session"),
      userId: user.id,
      token,
      createdAt: now(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
    };
    state.sessions.push(session);
    return { user: publicUser(user), token };
  });
}

export async function logout(store, token) {
  return store.transact((state) => {
    state.sessions = state.sessions.filter((session) => session.token !== token);
    return { ok: true };
  });
}

export async function deleteAccount(store, userId) {
  return store.transact((state) => {
    const user = state.users.find((entry) => entry.id === userId && !entry.deletedAt);
    if (!user) {
      throw authError("User not found", 404);
    }

    user.deletedAt = now();
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
    state.auditLogs.push({
      id: store.id("audit"),
      actorUserId: userId,
      ownerUserId: userId,
      action: "account.deleted",
      subjectType: "User",
      subjectId: userId,
      before: { user: publicUser(user) },
      after: { deletedAt: user.deletedAt },
      createdAt: now()
    });
    return { deleted: true };
  });
}

export async function getUserForSession(store, token) {
  if (!token) {
    return null;
  }

  const state = await store.load();
  const session = state.sessions.find((entry) => entry.token === token && entry.expiresAt > now());
  if (!session) {
    return null;
  }

  const user = state.users.find((entry) => entry.id === session.userId && !entry.deletedAt);
  return user ? publicUser(user) : null;
}
