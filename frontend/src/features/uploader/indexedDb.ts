function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(
            "CustomerUploads",
            1,
        );

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains("uploads")) {
                db.createObjectStore(
                    "uploads",
                    { keyPath: "uploadToken" }
                );
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}
export async function saveUploadSession(
    session: any,
) {
    const db = await openDatabase();

    const tx = db.transaction(
        "uploads",
        "readwrite",
    );

    tx.objectStore("uploads").put(session);

    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
export async function getUploadSessions() {
    const db = await openDatabase();

    return new Promise<any[]>((resolve, reject) => {

        const request = db
            .transaction("uploads")
            .objectStore("uploads")
            .getAll();

        request.onsuccess = () =>
            resolve(request.result);

        request.onerror = () =>
            reject(request.error);
    });
}
export async function deleteUploadSession(
    uploadToken: string,
) {
    const db = await openDatabase();

    const tx = db.transaction(
        "uploads",
        "readwrite",
    );

    tx.objectStore("uploads")
        .delete(uploadToken);

    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}