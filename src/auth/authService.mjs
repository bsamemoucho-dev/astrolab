import {
  createSessionToken,
  createVerificationCode,
  hashPassword,
  isStrongEnoughPassword,
  normalizeEmail,
  verifyPassword
} from "./security.mjs";
import { verificationEmail } from "../notifications/mailer.mjs";
import { MAX_VERIFICATION_ATTEMPTS, verificationCheck, verificationFailure } from "./verification.mjs";

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

function authError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  // Code stable, indépendant de la langue : le navigateur s'en sert pour
  // afficher sa propre phrase.
  if (code) {
    error.code = code;
  }
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
    const courriel = verificationEmail(input.language, verificationCode);
    state.outbox.push({
      id: store.id("mail"),
      to: email,
      type: "email_verification",
      subject: courriel.subject,
      body: courriel.body,
      createdAt: now()
    });

    return { user: publicUser(user), devVerificationCode: verificationCode };
  });
}

export async function verifyEmail(store, input) {
  const email = normalizeEmail(input.email);
  const code = String(input.code ?? "").trim();

  // La transaction est annulée si l'on lève une erreur à l'intérieur : le
  // compteur d'essais fautifs serait donc perdu à chaque échec, et la limite ne
  // limiterait rien. On enregistre d'abord, on refuse ensuite.
  const resultat = await store.transact((state) => {
    const user = state.users.find((entry) => entry.email === email);
    if (!user) {
      return { ok: false, reason: "missing" };
    }
    const controle = verificationCheck(user, code);
    if (controle.ok) {
      user.emailVerifiedAt = user.emailVerifiedAt ?? now();
      user.verificationCode = null;
      user.verificationAttempts = 0;
      return { ok: true, user: publicUser(user) };
    }
    if (controle.reason === "invalid") {
      user.verificationAttempts = (user.verificationAttempts ?? 0) + 1;
      if (user.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
        // Le code est mort : il faut en demander un nouveau (bouton « renvoyer »).
        user.verificationCode = null;
      }
    }
    return { ok: false, reason: controle.reason };
  });

  if (!resultat.ok) {
    const echec = verificationFailure(resultat.reason);
    // Le motif précis ne sort pas de la réponse : il est journalisé ici.
    console.warn(`[Lastro] vérification refusée (${echec.reason}) — ${email}`);
    throw authError(echec.message, 401, echec.code);
  }
  return { user: resultat.user };
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
