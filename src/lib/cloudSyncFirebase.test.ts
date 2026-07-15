import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedTrade } from "../types/app";
import { calculateTrade } from "./tradeCalculator";
import { TRADE_HISTORY_STORAGE_KEY } from "./tradeHistory";

const firebaseState = vi.hoisted(() => ({
  auth: {
    currentUser: {
      uid: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    },
  } as {
    currentUser: {
      uid: string;
      email: string | null;
      displayName: string | null;
    } | null;
  },
  database: { name: "firestore" },
  providerParameters: [] as Array<Record<string, string>>,
}));

const authMocks = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  where: vi.fn(),
}));

vi.mock("./firebaseConfig", () => ({
  firebaseAuth: firebaseState.auth,
  firestore: firebaseState.database,
  isFirebaseConfigured: true,
}));

vi.mock("firebase/auth", () => {
  class GoogleAuthProvider {
    setCustomParameters(parameters: Record<string, string>) {
      firebaseState.providerParameters.push(parameters);
    }
  }

  return {
    GoogleAuthProvider,
    createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
    onAuthStateChanged: authMocks.onAuthStateChanged,
    signInWithEmailAndPassword: authMocks.signInWithEmailAndPassword,
    signInWithPopup: authMocks.signInWithPopup,
    signOut: authMocks.signOut,
  };
});

vi.mock("firebase/firestore", () => ({
  collection: firestoreMocks.collection,
  deleteDoc: firestoreMocks.deleteDoc,
  doc: firestoreMocks.doc,
  getDocs: firestoreMocks.getDocs,
  onSnapshot: firestoreMocks.onSnapshot,
  query: firestoreMocks.query,
  setDoc: firestoreMocks.setDoc,
  where: firestoreMocks.where,
}));

import {
  CLOUD_MIGRATION_KEY_PREFIX,
  CLOUD_TRADES_COLLECTION,
  deleteCloudTrade,
  loadCloudTrades,
  loginWithEmail,
  loginWithGoogle,
  logoutFromCloud,
  observeAuthState,
  observeCloudTrades,
  registerWithEmail,
  saveCloudTrade,
  syncUserHistory,
} from "./cloudSync";

describe("Firebase cloud adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.auth.currentUser = {
      uid: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    };
    firebaseState.providerParameters.length = 0;

    authMocks.createUserWithEmailAndPassword.mockResolvedValue({
      user: firebaseState.auth.currentUser,
    });
    authMocks.signInWithEmailAndPassword.mockResolvedValue({
      user: firebaseState.auth.currentUser,
    });
    authMocks.signInWithPopup.mockResolvedValue({
      user: firebaseState.auth.currentUser,
    });
    authMocks.signOut.mockResolvedValue(undefined);

    firestoreMocks.collection.mockImplementation((_database, path) => ({ path }));
    firestoreMocks.doc.mockImplementation((_database, collectionName, id) => ({
      collectionName,
      id,
    }));
    firestoreMocks.where.mockImplementation((field, operator, value) => ({
      field,
      operator,
      value,
    }));
    firestoreMocks.query.mockImplementation((collectionRef, constraint) => ({
      collectionRef,
      constraint,
    }));
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.deleteDoc.mockResolvedValue(undefined);
  });

  it("trims email credentials and maps Firebase users to the public auth shape", async () => {
    await expect(registerWithEmail("  owner@example.com  ", "secret1")).resolves.toEqual({
      uid: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    });
    expect(authMocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      firebaseState.auth,
      "owner@example.com",
      "secret1",
    );

    await loginWithEmail("  owner@example.com ", "secret2");
    expect(authMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      firebaseState.auth,
      "owner@example.com",
      "secret2",
    );
  });

  it("opens Google account selection and signs out through Firebase Auth", async () => {
    await expect(loginWithGoogle()).resolves.toMatchObject({ uid: "user-1" });
    expect(firebaseState.providerParameters).toEqual([{ prompt: "select_account" }]);
    expect(authMocks.signInWithPopup).toHaveBeenCalledWith(
      firebaseState.auth,
      expect.anything(),
    );

    await logoutFromCloud();
    expect(authMocks.signOut).toHaveBeenCalledWith(firebaseState.auth);
  });

  it("maps auth state changes and returns the Firebase unsubscribe callback", () => {
    const unsubscribe = vi.fn();
    authMocks.onAuthStateChanged.mockImplementation((_auth, listener) => {
      listener(firebaseState.auth.currentUser);
      return unsubscribe;
    });
    const listener = vi.fn();

    const stop = observeAuthState(listener);

    expect(listener).toHaveBeenCalledWith({
      uid: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    });
    expect(stop).toBe(unsubscribe);
  });

  it("writes a trade to an encoded deterministic document owned by the user", async () => {
    const trade = {
      ...createTrade("bundle/with/slash", "2026-07-15T12:00:00.000Z"),
      optionalValue: undefined,
    } as SavedTrade;

    await saveCloudTrade(trade);

    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      firebaseState.database,
      CLOUD_TRADES_COLLECTION,
      "bundle%2Fwith%2Fslash",
    );
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { collectionName: CLOUD_TRADES_COLLECTION, id: "bundle%2Fwith%2Fslash" },
      expect.objectContaining({
        ownerId: "user-1",
        clientId: "bundle/with/slash",
        savedAt: "2026-07-15T12:00:00.000Z",
      }),
    );
    expect(
      (firestoreMocks.setDoc.mock.calls[0][1] as { trade: Record<string, unknown> })
        .trade,
    ).not.toHaveProperty("optionalValue");
  });

  it("queries only the current owner, ignores malformed documents and sorts newest first", async () => {
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        cloudDocument(createTrade("old", "2026-07-14T10:00:00.000Z")),
        { data: () => ({ clientId: "invalid", trade: { id: "invalid" } }) },
        cloudDocument(createTrade("new", "2026-07-15T10:00:00.000Z")),
      ],
    });

    const trades = await loadCloudTrades();

    expect(firestoreMocks.collection).toHaveBeenCalledWith(
      firebaseState.database,
      CLOUD_TRADES_COLLECTION,
    );
    expect(firestoreMocks.where).toHaveBeenCalledWith("ownerId", "==", "user-1");
    expect(trades.map((trade) => trade.id)).toEqual(["new", "old"]);
  });

  it("delivers sorted live snapshots and forwards listener errors", () => {
    const unsubscribe = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_query, next, error) => {
      next({
        docs: [
          cloudDocument(createTrade("old", "2026-07-14T10:00:00.000Z")),
          cloudDocument(createTrade("new", "2026-07-15T10:00:00.000Z")),
        ],
      });
      error(new Error("listener failed"));
      return unsubscribe;
    });
    const listener = vi.fn();
    const onError = vi.fn();

    const stop = observeCloudTrades(listener, onError);

    expect(listener.mock.calls[0][0].map((trade: SavedTrade) => trade.id)).toEqual([
      "new",
      "old",
    ]);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "listener failed" }));
    expect(stop).toBe(unsubscribe);
  });

  it("deletes the encoded cloud document", async () => {
    await deleteCloudTrade("trade/1");

    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith({
      collectionName: CLOUD_TRADES_COLLECTION,
      id: "trade%2F1",
    });
  });

  it("uploads local-only history once, marks migration and gives cloud data precedence", async () => {
    const sharedLocal = createTrade("shared", "2026-07-14T10:00:00.000Z", "local");
    const localOnly = createTrade("local-only", "2026-07-15T09:00:00.000Z");
    const sharedCloud = createTrade("shared", "2026-07-15T10:00:00.000Z", "cloud");
    const storage = createMemoryStorage({
      [TRADE_HISTORY_STORAGE_KEY]: JSON.stringify([sharedLocal, localOnly]),
    });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [cloudDocument(sharedCloud)] });

    const merged = await syncUserHistory({
      uid: "user-1",
      email: "owner@example.com",
      displayName: null,
    }, storage);

    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.setDoc.mock.calls[0][1]).toMatchObject({
      clientId: "local-only",
    });
    expect(storage.getItem(`${CLOUD_MIGRATION_KEY_PREFIX}user-1`)).toBe("done");
    expect(merged.map((trade) => trade.id)).toEqual(["shared", "local-only"]);
    expect(merged[0].instructions).toBe("cloud");

    firestoreMocks.setDoc.mockClear();
    await syncUserHistory(
      { uid: "user-1", email: null, displayName: null },
      storage,
    );
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it("does not mark migration complete when uploading local history fails", async () => {
    const storage = createMemoryStorage({
      [TRADE_HISTORY_STORAGE_KEY]: JSON.stringify([
        createTrade("local-only", "2026-07-15T09:00:00.000Z"),
      ]),
    });
    firestoreMocks.setDoc.mockRejectedValue(new Error("write failed"));

    await expect(
      syncUserHistory(
        { uid: "user-1", email: null, displayName: null },
        storage,
      ),
    ).rejects.toThrow("write failed");
    expect(storage.getItem(`${CLOUD_MIGRATION_KEY_PREFIX}user-1`)).toBeNull();
  });

  it("refuses writes when Firebase has no authenticated user", async () => {
    firebaseState.auth.currentUser = null;

    await expect(
      saveCloudTrade(createTrade("blocked", "2026-07-15T12:00:00.000Z")),
    ).rejects.toThrow("Необходимо войти в аккаунт");
  });
});

function cloudDocument(trade: SavedTrade) {
  return {
    data: () => ({
      ownerId: "user-1",
      clientId: trade.id,
      savedAt: trade.savedAt,
      trade,
    }),
  };
}

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function createTrade(
  id: string,
  savedAt: string,
  instructions = "",
): SavedTrade {
  const analysis = {
    bundleType: "Фьючерс + Спот",
    future: {
      symbol: "BTCUSDT",
      volumeUsdt: 1000,
      realizedPnlUsdt: 10,
    },
    spot: { volumeUsdt: 1000, rawPnlUsdt: 5 },
    legs: [],
    conflicts: [],
    notes: [],
  };

  return {
    id,
    savedAt,
    instructions,
    analysis,
    calculation: calculateTrade(analysis),
  };
}
