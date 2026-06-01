import type {
  ExportBundle,
  PracticeAttempt,
  SentenceNote,
  SyncRecord,
  UsageEvent,
  VocabItem
} from "../shared/types";

export type StoreName = "vocabItems" | "sentenceNotes" | "practiceAttempts" | "usageEvents" | "syncRecords";

type StoreRecord = VocabItem | SentenceNote | PracticeAttempt | UsageEvent | SyncRecord;

const DB_NAME = "youtube-language-lab";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

function createStore(db: IDBDatabase, name: StoreName): IDBObjectStore {
  const store = db.createObjectStore(name, { keyPath: "id" });
  store.createIndex("userId", "userId", { unique: false });
  store.createIndex("createdAt", "createdAt", { unique: false });
  return store;
}

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("vocabItems")) createStore(db, "vocabItems");
      if (!db.objectStoreNames.contains("sentenceNotes")) createStore(db, "sentenceNotes");
      if (!db.objectStoreNames.contains("practiceAttempts")) createStore(db, "practiceAttempts");
      if (!db.objectStoreNames.contains("usageEvents")) createStore(db, "usageEvents");
      if (!db.objectStoreNames.contains("syncRecords")) {
        const store = createStore(db, "syncRecords");
        store.createIndex("entityId", "entityId", { unique: false });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store);

    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function putRecord<T extends StoreRecord>(storeName: StoreName, record: T): Promise<T> {
  await withStore(storeName, "readwrite", (store) => store.put(record));
  return record;
}

export async function listByUser<T extends StoreRecord>(storeName: StoreName, userId: string): Promise<T[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = store.index("userId");
    const request = index.getAll(userId);

    request.onsuccess = () => resolve((request.result as T[]).sort(sortNewest));
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllStores(): Promise<void> {
  const db = await openDatabase();
  const storeNames: StoreName[] = ["vocabItems", "sentenceNotes", "practiceAttempts", "usageEvents", "syncRecords"];

  await Promise.all(
    storeNames.map(
      (storeName) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    )
  );
}

export async function buildExportBundle(
  base: Omit<ExportBundle, "vocabItems" | "sentenceNotes" | "practiceAttempts" | "usageEvents">
): Promise<ExportBundle> {
  const [vocabItems, sentenceNotes, practiceAttempts, usageEvents] = await Promise.all([
    listByUser<VocabItem>("vocabItems", base.user.id),
    listByUser<SentenceNote>("sentenceNotes", base.user.id),
    listByUser<PracticeAttempt>("practiceAttempts", base.user.id),
    listByUser<UsageEvent>("usageEvents", base.user.id)
  ]);

  return {
    ...base,
    vocabItems,
    sentenceNotes,
    practiceAttempts,
    usageEvents
  };
}

function sortNewest(a: StoreRecord, b: StoreRecord): number {
  const aTime = "createdAt" in a ? a.createdAt : "updatedAt" in a ? a.updatedAt : "";
  const bTime = "createdAt" in b ? b.createdAt : "updatedAt" in b ? b.updatedAt : "";
  return bTime.localeCompare(aTime);
}
