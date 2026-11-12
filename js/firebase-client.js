import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';

const config = window.PRISMA_FIREBASE_CONFIG || {};
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
const missingConfigKeys = requiredConfigKeys.filter((key) => !String(config[key] || '').trim());
const observers = new Set();
let app;
let auth;
let database;
let currentUser = null;
let authStateReady;
let resolveAuthState;
let rejectAuthState;
let authStateSettled = false;
let persistenceMode = 'local';

authStateReady = new Promise((resolve, reject) => {
  resolveAuthState = resolve;
  rejectAuthState = reject;
});

function assertAvailable() {
  if (missingConfigKeys.length) {
    throw new Error(`Configuração Firebase incompleta. Configure: ${missingConfigKeys.join(', ')}.`);
  }
}

function serializeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Os dados financeiros estão em um formato inválido.');
  }

  const serialized = JSON.stringify(state);
  if (typeof serialized !== 'string') {
    throw new TypeError('Não foi possível serializar os dados financeiros.');
  }

  const byteLength = new TextEncoder().encode(serialized).length;
  if (byteLength > 800000) {
    throw new Error('Os dados excedem o limite seguro de sincronização. Reduza o histórico antes de sincronizar.');
  }

  return JSON.parse(serialized);
}

function stateReference(uid) {
  return doc(database, 'users', uid, 'appData', 'state');
}

function profileReference(uid) {
  return doc(database, 'users', uid);
}

function consentReference(uid) {
  return doc(database, 'users', uid, 'appData', 'consent');
}

const ready = (async () => {
  assertAvailable();
  app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  database = getFirestore(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (localPersistenceError) {
    try {
      await setPersistence(auth, browserSessionPersistence);
      persistenceMode = 'session';
      console.warn('O navegador bloqueou a persistência local do Firebase; a sessão ficará ativa nesta aba até o fim da sessão.');
    } catch (sessionPersistenceError) {
      throw new Error(
        'O navegador bloqueou o armazenamento local e de sessão. Habilite armazenamento para este site e tente novamente.',
        { cause: sessionPersistenceError || localPersistenceError }
      );
    }
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (!authStateSettled) {
      authStateSettled = true;
      resolveAuthState(user);
    }
    observers.forEach((observer) => observer(user));
  }, (error) => {
    if (!authStateSettled) {
      authStateSettled = true;
      rejectAuthState(error);
    }
    observers.forEach((observer) => observer(null, error));
  });

  await authStateReady;
  return { app, auth, database, persistenceMode };
})();

function requireCurrentUser(uid) {
  if (!currentUser || currentUser.uid !== uid) {
    throw new Error('A sessão Firebase expirou. Entre novamente para continuar.');
  }
}

async function saveProfile(user, { created = false } = {}) {
  await ready;
  requireCurrentUser(user.uid);
  const reference = profileReference(user.uid);
  const profile = {
    displayName: String(user.displayName || '').trim(),
    email: String(user.email || '').trim(),
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp()
  };
  if (created) profile.createdAt = serverTimestamp();
  await setDoc(reference, profile, { merge: true });
}

async function updateDisplayName(name) {
  await ready;
  if (!currentUser) throw new Error('Nenhuma conta autenticada.');
  const displayName = String(name || '').trim();
  if (displayName.length < 2) throw new Error('O nome deve ter pelo menos 2 caracteres.');
  await updateProfile(currentUser, { displayName });
  await saveProfile(currentUser);
  return currentUser;
}

async function register(email, password, name) {
  await ready;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await saveProfile(credential.user, { created: true });
  return credential.user;
}

async function login(email, password) {
  await ready;
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

async function resetPassword(email) {
  await ready;
  await sendPasswordResetEmail(auth, email);
}

async function applyPasswordReset(code, password) {
  await ready;
  await confirmPasswordReset(auth, code, password);
}

async function logout() {
  await ready;
  await signOut(auth);
}

async function loadUserData(uid) {
  await ready;
  requireCurrentUser(uid);
  const [profileSnapshot, stateSnapshot, consentSnapshot] = await Promise.all([
    getDoc(profileReference(uid)),
    getDoc(stateReference(uid)),
    getDoc(consentReference(uid))
  ]);
  const stateDocument = stateSnapshot.exists() ? stateSnapshot.data() : null;
  return {
    profile: profileSnapshot.exists() ? profileSnapshot.data() : null,
    state: stateDocument ? stateDocument.data : null,
    revision: stateDocument ? stateDocument.revision : null,
    consent: consentSnapshot.exists() ? consentSnapshot.data() : null
  };
}

async function saveState(uid, state, expectedRevision) {
  await ready;
  requireCurrentUser(uid);
  const data = serializeState(state);
  const reference = stateReference(uid);
  const revision = crypto.randomUUID();

  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const actualRevision = snapshot.exists() ? snapshot.data().revision || null : null;
    if (actualRevision !== expectedRevision) {
      const error = new Error('Os dados desta conta foram alterados em outro dispositivo. Recarregue para evitar sobrescrever alterações.');
      error.code = 'PRISMA_DATA_CONFLICT';
      throw error;
    }

    transaction.set(reference, {
      schemaVersion: 1,
      data,
      revision,
      updatedAt: serverTimestamp()
    });
  });

  return revision;
}

function watchState(uid, onChange, onError) {
  const reference = stateReference(uid);
  return onSnapshot(reference, (snapshot) => {
    if (!snapshot.exists()) {
      onChange(null, null);
      return;
    }
    const stateDocument = snapshot.data();
    onChange(stateDocument.data, stateDocument.revision || null);
  }, onError);
}

async function saveConsent(uid, preferences) {
  await ready;
  requireCurrentUser(uid);
  await setDoc(consentReference(uid), {
    essentialAccepted: true,
    communicationsConsent: Boolean(preferences.communicationsConsent),
    analyticsConsent: Boolean(preferences.analyticsConsent),
    openFinanceConsent: Boolean(preferences.openFinanceConsent),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function deleteAccount(password) {
  await ready;
  if (!currentUser) throw new Error('Nenhuma conta autenticada.');

  const passwordProvider = currentUser.providerData.find((provider) => provider.providerId === 'password');
  if (passwordProvider) {
    if (!password) throw new Error('Confirme sua senha para excluir a conta.');
    const { EmailAuthProvider, reauthenticateWithCredential, deleteUser } = await import(
      'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'
    );
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);
    const batch = writeBatch(database);
    batch.delete(stateReference(currentUser.uid));
    batch.delete(consentReference(currentUser.uid));
    batch.delete(profileReference(currentUser.uid));
    await batch.commit();
    await deleteUser(currentUser);
    return;
  }

  throw new Error('A exclusão segura desta conta requer reautenticação pelo provedor de login.');
}

function onUserChanged(observer) {
  observers.add(observer);
  if (authStateSettled) queueMicrotask(() => observer(currentUser));
  return () => observers.delete(observer);
}

window.PrismaFirebase = Object.freeze({
  ready,
  onUserChanged,
  getCurrentUser: async () => {
    await ready;
    return currentUser;
  },
  getPersistenceMode: async () => {
    await ready;
    return persistenceMode;
  },
  register,
  login,
  resetPassword,
  applyPasswordReset,
  logout,
  saveProfile,
  updateDisplayName,
  loadUserData,
  saveState,
  watchState,
  saveConsent,
  deleteAccount,
  isConfigured: missingConfigKeys.length === 0
});
window.dispatchEvent(new Event('prisma-firebase-ready'));

ready.catch((error) => {
  console.error('Falha ao inicializar Firebase:', error);
  if (!authStateSettled) {
    authStateSettled = true;
    rejectAuthState(error);
  }
});
