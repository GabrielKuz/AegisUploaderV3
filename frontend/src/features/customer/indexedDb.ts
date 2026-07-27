export type UploadSession = {
  uuid: string;
  uploadToken: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  chunkSize: number;
  file: File;
  region: "US" | "EU";
};

export type StoredUploadSession = {
  uuid: string;
  uploadToken: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  chunkSize: number;
  region: "US" | "EU";
};

export type UploadSettings = {
  uuid: string;
  region: "US" | "EU";
  uploadStarted: boolean;
  deletionRequested: boolean;
};

const DATABASE_NAME = "CustomerUploads";
const DATABASE_VERSION = 2;
const UPLOAD_STORE_NAME = "uploads";
const SETTINGS_STORE_NAME = "settings";

/* ==========================================================================
   DATABASE
   ========================================================================== */

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(UPLOAD_STORE_NAME)) {
        database.createObjectStore(UPLOAD_STORE_NAME, {
          keyPath: "uploadToken",
        });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        database.createObjectStore(SETTINGS_STORE_NAME, {
          keyPath: "uuid",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open the upload database."));
    };
  });
}

/* ==========================================================================
   TRANSACTION HELPER
   ========================================================================== */

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      console.error("IndexedDB transaction failed:", {
        name: transaction.error?.name,
        message: transaction.error?.message,
        error: transaction.error,
      });

      reject(
        transaction.error ??
          new Error("The upload database transaction failed."),
      );
    };

    transaction.onabort = () => {
      console.error("IndexedDB transaction aborted:", {
        name: transaction.error?.name,
        message: transaction.error?.message,
        error: transaction.error,
      });

      reject(
        transaction.error ??
          new Error("The upload database transaction was aborted."),
      );
    };
  });
}

/* ==========================================================================
   UPLOAD SESSIONS
   ========================================================================== */

/** Saves upload metadata to IndexedDB.
 * IMPORTANT: File object is intentionally NOT stored
 * -> Large File objects can exceed browser IndexedDB storage limits
 */
export async function saveUploadSession(session: UploadSession): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(UPLOAD_STORE_NAME, "readwrite");

    /* Remove File object before saving session.
     * session.file remains available in memory for current upload,
     * but is not copied into IndexedDB.
     */
    const { file: _file, ...storedSession } = session;

    const request = transaction
      .objectStore(UPLOAD_STORE_NAME)
      .put(storedSession);

    request.onerror = () => {
      console.error("Failed to save upload session:", {
        fileName: session.fileName,
        fileSize: session.fileSize,
        name: request.error?.name,
        message: request.error?.message,
        error: request.error,
      });
    };

    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

/* Gets saved upload sessions.
 * Saved sessions only contain upload metadata (NOT original File object)
 */
export async function getUploadSessions(
  uuid?: string,
): Promise<StoredUploadSession[]> {
  const database = await openDatabase();

  try {
    const sessions = await new Promise<StoredUploadSession[]>(
      (resolve, reject) => {
        const request = database
          .transaction(UPLOAD_STORE_NAME, "readonly")
          .objectStore(UPLOAD_STORE_NAME)
          .getAll();

        request.onsuccess = () => {
          resolve(request.result as StoredUploadSession[]);
        };

        request.onerror = () => {
          reject(
            request.error ?? new Error("Failed to read saved upload sessions."),
          );
        };
      },
    );

    if (!uuid) {
      return sessions;
    }

    return sessions.filter((session) => session.uuid === uuid);
  } finally {
    database.close();
  }
}

// Deletes a saved upload session using its upload token
export async function deleteUploadSession(uploadToken: string): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(UPLOAD_STORE_NAME, "readwrite");

    transaction.objectStore(UPLOAD_STORE_NAME).delete(uploadToken);

    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

/* ==========================================================================
   UPLOAD SETTINGS
   ========================================================================== */

// Saves settings associated with customer upload UUID.
export async function saveUploadSettings(
  settings: UploadSettings,
): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(SETTINGS_STORE_NAME, "readwrite");

    transaction.objectStore(SETTINGS_STORE_NAME).put(settings);

    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

// Gets upload settings for customer upload UUID
export async function getUploadSettings(
  uuid: string,
): Promise<UploadSettings | null> {
  const database = await openDatabase();

  try {
    return await new Promise<UploadSettings | null>((resolve, reject) => {
      const request = database
        .transaction(SETTINGS_STORE_NAME, "readonly")
        .objectStore(SETTINGS_STORE_NAME)
        .get(uuid);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read upload settings."));
      };
    });
  } finally {
    database.close();
  }
}
