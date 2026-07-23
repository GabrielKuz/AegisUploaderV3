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

export type UploadSettings = {
  uuid: string;
  region: "US" | "EU";
  uploadStarted: boolean;
};
const DATABASE_NAME = "CustomerUploads";
const DATABASE_VERSION = 2;
const UPLOAD_STORE_NAME = "uploads";

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

      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", {
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

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(
        transaction.error ??
          new Error("The upload database transaction failed."),
      );
    };

    transaction.onabort = () => {
      reject(
        transaction.error ??
          new Error("The upload database transaction was aborted."),
      );
    };
  });
}

export async function saveUploadSession(session: UploadSession): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(UPLOAD_STORE_NAME, "readwrite");

    transaction.objectStore(UPLOAD_STORE_NAME).put(session);

    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function saveUploadSettings(
  settings: UploadSettings,
): Promise<void> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(
      "settings",
      "readwrite",
    );

    transaction.objectStore("settings").put(settings);

    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function getUploadSettings(
  uuid: string,
): Promise<UploadSettings | null> {
  const database = await openDatabase();

  try {
    return await new Promise<UploadSettings | null>(
      (resolve, reject) => {
        const request = database
          .transaction("settings", "readonly")
          .objectStore("settings")
          .get(uuid);

        request.onsuccess = () => {
          resolve(request.result ?? null);
        };

        request.onerror = () => {
          reject(
            request.error ??
            new Error("Failed to read upload settings."),
          );
        };
      },
    );
  } finally {
    database.close();
  }
}

export async function getUploadSessions(
  uuid?: string,
): Promise<UploadSession[]> {
  const database = await openDatabase();

  try {
    const sessions = await new Promise<UploadSession[]>((resolve, reject) => {
      const request = database
        .transaction(UPLOAD_STORE_NAME, "readonly")
        .objectStore(UPLOAD_STORE_NAME)
        .getAll();

      request.onsuccess = () => {
        resolve(request.result as UploadSession[]);
      };

      request.onerror = () => {
        reject(
          request.error ?? new Error("Failed to read saved upload sessions."),
        );
      };
    });

    if (!uuid) {
      return sessions;
    }

    return sessions.filter((session) => session.uuid === uuid);
  } finally {
    database.close();
  }
}

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
