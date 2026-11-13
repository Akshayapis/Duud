import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import { get, getDatabase, ref, set, type Database } from "firebase/database";
import { firebaseConfig as baseFirebaseConfig } from "@/data/catalog";

/**
 * Firebase config resolution:
 *   1. Vite env (if all required values were provided at build time)
 *   2. The project config in src/data/catalog.ts
 * This keeps Render deploys working even when VITE_* variables are not set,
 * because Vite only reads them at build time — not at container runtime.
 */
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {});
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || baseFirebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || baseFirebaseConfig.authDomain,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || baseFirebaseConfig.databaseURL,
  projectId: env.VITE_FIREBASE_PROJECT_ID || baseFirebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || baseFirebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || baseFirebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || baseFirebaseConfig.appId,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;
let initError = "";

try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
} catch (e) {
  initError = e instanceof Error ? e.message : "Firebase initialization failed";
}

export const firebase = { app, auth, db, initError };
export const isFirebaseReady = Boolean(auth && db);

export function firebaseErrorMessage(error: unknown): { message: string; kind: "domain" | "config" | "credential" | "network" | "other" } {
  const code = (error as { code?: string })?.code ?? "";
  const raw = (error as { message?: string })?.message ?? "";
  switch (code) {
    case "auth/unauthorized-domain":
      return {
        kind: "domain",
        message:
          "Google sign-in is blocked because this domain is not authorised in the Firebase project. Add this exact hostname in Firebase Console → Authentication → Settings → Authorized domains, then try again.",
      };
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return {
        kind: "config",
        message:
          "This sign-in method is disabled in the Firebase project. Enable Google and Email/Password providers in Firebase Console → Authentication → Sign-in method.",
      };
    case "auth/popup-blocked":
      return { kind: "network", message: "The sign-in popup was blocked by the browser. Allow popups for this site, or use email sign-in." };
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return { kind: "other", message: "The sign-in window was closed before authentication finished. Please try again." };
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return { kind: "credential", message: "Email or password is incorrect. Use “Forgot password” if you need to reset it." };
    case "auth/email-already-in-use":
      return { kind: "credential", message: "An account with this email already exists. Sign in instead, or reset the password." };
    case "auth/weak-password":
      return { kind: "credential", message: "Firebase rejected this password as too weak. Use at least 8 characters with letters and numbers." };
    case "auth/invalid-email":
      return { kind: "credential", message: "Enter a valid email address." };
    case "auth/too-many-requests":
      return { kind: "network", message: "Too many attempts. Firebase has temporarily rate-limited this account. Try again shortly." };
    case "auth/network-request-failed":
      return { kind: "network", message: "Network request to Firebase failed. Check your connection and try again." };
    case "auth/requires-recent-login":
      return { kind: "credential", message: "Please sign in again before performing this sensitive operation." };
    case "PERMISSION_DENIED":
      return { kind: "config", message: "Firebase Realtime Database rejected this write. Publish the provided security rules and confirm the database URL." };
    default:
      return { kind: "other", message: raw || "Authentication failed. Please try again." };
  }
}

export type FbIdentity = {
  uid: string;
  email: string;
  name: string;
  photo?: string;
  emailVerified: boolean;
  provider: "google" | "password";
  createdAt: string;
};

function toIdentity(u: FirebaseUser): FbIdentity {
  const provider = u.providerData.some((p) => p.providerId === "google.com") ? "google" : "password";
  return {
    uid: u.uid,
    email: u.email ?? "",
    name: u.displayName ?? (u.email ? u.email.split("@")[0] : "Builder"),
    photo: u.photoURL ?? undefined,
    emailVerified: u.emailVerified,
    provider,
    createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : new Date().toISOString(),
  };
}

export function watchAuth(cb: (identity: FbIdentity | null) => void): () => void {
  if (!auth) return () => undefined;
  void getRedirectResult(auth).catch(() => undefined);
  return onAuthStateChanged(auth, (u) => cb(u ? toIdentity(u) : null));
}

export async function googleSignIn(): Promise<FbIdentity> {
  if (!auth) throw Object.assign(new Error(firebase.initError || "Firebase is not configured"), { code: "auth/operation-not-allowed" });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    return toIdentity(result.user);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
      throw Object.assign(new Error("Redirecting to Google sign-in…"), { code: "auth/redirecting" });
    }
    throw error;
  }
}

export async function emailRegister(name: string, email: string, password: string): Promise<FbIdentity> {
  if (!auth) throw Object.assign(new Error(firebase.initError || "Firebase is not configured"), { code: "auth/operation-not-allowed" });
  const result = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(result.user, { displayName: name });
  } catch {
    /* display name is non-critical */
  }
  await sendEmailVerification(result.user);
  return { ...toIdentity(result.user), name };
}

export async function emailLogin(email: string, password: string): Promise<FbIdentity> {
  if (!auth) throw Object.assign(new Error(firebase.initError || "Firebase is not configured"), { code: "auth/operation-not-allowed" });
  const result = await signInWithEmailAndPassword(auth, email, password);
  return toIdentity(result.user);
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth?.currentUser) throw new Error("No authenticated account. Sign in again.");
  await sendEmailVerification(auth.currentUser);
}

export async function passwordReset(email: string): Promise<void> {
  if (!auth) throw Object.assign(new Error("Firebase is not configured"), { code: "auth/operation-not-allowed" });
  await sendPasswordResetEmail(auth, email);
}

export async function hasVerifiedEmail(): Promise<boolean> {
  if (!auth?.currentUser) return false;
  await auth.currentUser.reload();
  return auth.currentUser.emailVerified;
}

export async function authToken(): Promise<string | null> {
  try {
    if (!auth?.currentUser) return null;
    return await auth.currentUser.getIdToken(false);
  } catch {
    return null;
  }
}

export async function fbLogout(): Promise<void> {
  if (auth) await signOut(auth);
}

export type RemoteProfile = {
  uid?: string;
  name?: string;
  email?: string;
  provider?: string;
  emailVerified?: boolean;
  planId?: string;
  planActivatedAt?: string;
  planExpiresAt?: string;
  createdAt?: string;
  notifyBuilds?: boolean;
  notifyPayments?: boolean;
  notifyProduct?: boolean;
  company?: string;
  bio?: string;
};

export async function readProfile(uid: string): Promise<RemoteProfile | null> {
  if (!db) return null;
  try {
    const snap = await get(ref(db, `users/${uid}/profile`));
    return snap.exists() ? (snap.val() as RemoteProfile) : null;
  } catch {
    return null;
  }
}

const PROFILE_WRITABLE = new Set(["name", "email", "provider", "emailVerified", "createdAt", "photo", "bio", "company", "notifyBuilds", "notifyPayments", "notifyProduct"]);

/** Plan/quota fields are server/admin-only; never send them from the browser. */
export async function writeProfile(uid: string, profile: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: initError || "Realtime Database is not configured." };
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(profile)) if (PROFILE_WRITABLE.has(k)) safe[k] = v;
  if (!Object.keys(safe).length) return { ok: true };
  try {
    // Write each allowed child individually: RTDB rules protect plan/quota
    // fields at the profile level, so a parent-level update would be rejected.
    await Promise.all(Object.entries(safe).map(([k, v]) => set(ref(db, `users/${uid}/profile/${k}`), v)));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: firebaseErrorMessage(e).message };
  }
}

export async function writeProjectMeta(uid: string, projectId: string, data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  try {
    await set(ref(db, `users/${uid}/projects/${projectId}`), data);
  } catch {
    /* metadata remains safely in the local workspace cache */
  }
}

export async function writeActivity(uid: string, eventId: string, data: Record<string, unknown>): Promise<void> {
  if (!db) return;
  try {
    await set(ref(db, `users/${uid}/activity/${eventId}`), data);
  } catch {
    /* non-critical */
  }
}
