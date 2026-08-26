/**
 * Offline booking queue — IndexedDB-backed.
 *
 * When the user submits a booking while offline, we store the request body
 * in IndexedDB and drain the queue on reconnect. localStorage won't work
 * here — it's synchronous, limited to ~5MB, and blocks the main thread.
 *
 * Usage:
 *   import { queueBooking, drainQueue, getQueueSize } from "@/lib/offline-queue";
 *   await queueBooking(bookingData);
 *   await drainQueue(); // called on online event
 *   const count = await getQueueSize();
 */

const DB_NAME = "davaobook-offline";
const DB_VERSION = 1;
const STORE_NAME = "bookings";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("created_at", "created_at");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Store a booking request for later submission. */
export async function queueBooking(
  data: Record<string, unknown>
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry = {
      data,
      created_at: Date.now(),
      status: "queued" as const,
    };
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Drain the queue — submit all pending bookings. Returns count of successes. */
export async function drainQueue(): Promise<number> {
  const db = await openDB();
  let successCount = 0;

  const entries = await new Promise<Array<{ id: number; data: Record<string, unknown>; status: string }>>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  for (const entry of entries) {
    if (entry.status !== "queued") continue;
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.data),
      });
      if (res.ok) {
        // Mark as sent and remove from queue
        await markAndDelete(db, entry.id);
        successCount++;
      }
      // If server rejects (e.g. capacity full), leave in queue — user can retry
    } catch {
      // Still offline or network error — stop draining
      break;
    }
  }

  db.close();
  return successCount;
}

/** Get the number of pending bookings in the queue. */
export async function getQueueSize(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Remove a single entry by ID. */
async function markAndDelete(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
