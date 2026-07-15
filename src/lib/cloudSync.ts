import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { SavedTrade } from "../types/app";
import type { AuthUserSummary } from "../types/auth";
import { firebaseAuth, firestore, isFirebaseConfigured } from "./firebaseConfig";
import { loadTradeHistory, parseTradeHistory } from "./tradeHistory";
export { getAuthErrorMessage } from "./authErrors";

export const CLOUD_TRADES_COLLECTION = "user_trades";
export const CLOUD_MIGRATION_KEY_PREFIX = "fund-sync:cloud-migration:v1:";

export function isCloudSyncAvailable() {
  return isFirebaseConfigured && Boolean(firebaseAuth && firestore);
}

export function observeAuthState(
  listener: (user: AuthUserSummary | null) => void,
): () => void {
  const auth = firebaseAuth;
  if (!auth || !isCloudSyncAvailable()) {
    listener(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, (user) => listener(toUserSummary(user)));
}

export async function registerWithEmail(email: string, password: string) {
  const auth = requireFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return toUserSummary(credential.user);
}

export async function loginWithEmail(email: string, password: string) {
  const auth = requireFirebaseAuth();
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return toUserSummary(credential.user);
}

export async function loginWithGoogle() {
  const auth = requireFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return toUserSummary(credential.user);
}

export async function logoutFromCloud() {
  await signOut(requireFirebaseAuth());
}

export async function saveCloudTrade(trade: SavedTrade) {
  const user = requireCurrentUser();
  const database = requireFirestore();
  const tradeId = encodeURIComponent(trade.id);

  await setDoc(doc(database, CLOUD_TRADES_COLLECTION, tradeId), {
    ownerId: user.uid,
    clientId: trade.id,
    savedAt: trade.savedAt,
    trade: removeUndefinedValues(trade),
  });
}

export async function loadCloudTrades(): Promise<SavedTrade[]> {
  const user = requireCurrentUser();
  const database = requireFirestore();
  const tradesQuery = query(
    collection(database, CLOUD_TRADES_COLLECTION),
    where("ownerId", "==", user.uid),
  );
  const snapshot = await getDocs(tradesQuery);
  const trades: SavedTrade[] = [];

  for (const document of snapshot.docs) {
    const data = document.data();
    const trade = parseTradeHistory(JSON.stringify([data.trade]))[0];
    if (trade) {
      trades.push({
        ...trade,
        id: typeof data.clientId === "string" ? data.clientId : trade.id,
      });
    }
  }

  return trades.sort(compareSavedAt);
}

export function observeCloudTrades(
  listener: (trades: SavedTrade[]) => void,
  onError: (error: unknown) => void,
) {
  const user = requireCurrentUser();
  const database = requireFirestore();
  const tradesQuery = query(
    collection(database, CLOUD_TRADES_COLLECTION),
    where("ownerId", "==", user.uid),
  );

  return onSnapshot(
    tradesQuery,
    (snapshot) => {
      const trades: SavedTrade[] = [];
      for (const document of snapshot.docs) {
        const data = document.data();
        const trade = parseTradeHistory(JSON.stringify([data.trade]))[0];
        if (trade) {
          trades.push({
            ...trade,
            id: typeof data.clientId === "string" ? data.clientId : trade.id,
          });
        }
      }
      listener(trades.sort(compareSavedAt));
    },
    onError,
  );
}

export async function deleteCloudTrade(tradeId: string) {
  const database = requireFirestore();
  await deleteDoc(
    doc(database, CLOUD_TRADES_COLLECTION, encodeURIComponent(tradeId)),
  );
}

export async function syncUserHistory(
  user: AuthUserSummary,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = getBrowserStorage(),
) {
  const cloudTrades = await loadCloudTrades();
  const migrationKey = `${CLOUD_MIGRATION_KEY_PREFIX}${user.uid}`;

  if (storage?.getItem(migrationKey) !== "done") {
    const cloudIds = new Set(cloudTrades.map((trade) => trade.id));
    const localTrades = loadTradeHistory(storage);
    const localOnlyTrades = localTrades.filter((trade) => !cloudIds.has(trade.id));

    await Promise.all(localOnlyTrades.map((trade) => saveCloudTrade(trade)));
    storage?.setItem(migrationKey, "done");

    return mergeTradeHistories(cloudTrades, localOnlyTrades);
  }

  return cloudTrades;
}

export function mergeTradeHistories(
  cloudTrades: SavedTrade[],
  localTrades: SavedTrade[],
): SavedTrade[] {
  const merged = new Map<string, SavedTrade>();

  for (const trade of localTrades) {
    merged.set(trade.id, trade);
  }
  for (const trade of cloudTrades) {
    merged.set(trade.id, trade);
  }

  return Array.from(merged.values()).sort(compareSavedAt);
}

function requireCurrentUser(): User {
  const user = requireFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Необходимо войти в аккаунт для синхронизации.");
  }
  return user;
}

function requireFirestore() {
  if (!isCloudSyncAvailable() || !firestore) {
    throw new Error(
      "Firebase не настроен. Добавь VITE_FIREBASE_* переменные окружения.",
    );
  }
  return firestore;
}

function requireFirebaseAuth(): Auth {
  if (!isCloudSyncAvailable() || !firebaseAuth) {
    throw new Error(
      "Firebase не настроен. Добавь VITE_FIREBASE_* переменные окружения.",
    );
  }
  return firebaseAuth;
}

function toUserSummary(user: User | null): AuthUserSummary | null {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

function compareSavedAt(first: SavedTrade, second: SavedTrade) {
  return second.savedAt.localeCompare(first.savedAt);
}

function removeUndefinedValues<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
