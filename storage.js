
//prevent changes while saving
let storageReady = false;
let saving = false;
let storageRevision = null;


// Function to persist the cashbook data to IndexedDB
async function persistCashbook(balanceCents, startDate, records) {
    if (!storageReady || saving) {
        alert("Please wait for loading or saving to finish.");
        return false;
    }

    saving = true;

    try {
        storageRevision = await saveCashbook({
            schemaVersion: 2,
            openingBalanceCents: balanceCents,
            openingDate: startDate,
            transactions: records
        });

        return true;
    } catch (error) {
        console.error("Save failed:", error);
        alert(`Could not save: ${error.message} Your entry is still in the form.`);

        return false;
    } finally {
        saving = false;
    }
}



// Function to open the IndexedDB database
function openCashbookDatabase() {
    return new Promise(function (resolve, reject) {
        const request = indexedDB.open("pngsa-cashbook", 1);

        request.onupgradeneeded = function () {
            const database = request.result;

            if (!database.objectStoreNames.contains("cashbook")) {
                database.createObjectStore("cashbook");
            }
        };

        request.onsuccess = function () {
            const database = request.result;

            database.onversionchange = function () {
                database.close();
            };

            resolve(database);
        };

        request.onerror = function () {
            reject(request.error);
        };

        request.onblocked = function () {
            alert("Close other Cashbook tabs, then reload this page.");
        };
    });
}
// Function to save the cashbook data to IndexedDB
async function saveCashbook(data, expectedRevision = storageRevision) {
    validateCashbook(data);
    const database = await openCashbookDatabase();

    try {
        return await new Promise(function (resolve, reject) {
            const transaction = database.transaction("cashbook", "readwrite");
            const store = transaction.objectStore("cashbook");

            let failure;
            let nextRevision;
            transaction.oncomplete = function () {
                resolve(nextRevision);
            };

            transaction.onabort = function () {
                reject(failure || transaction.error || new Error("Save was cancelled."));
            };

            const request = store.get("main");
            request.onsuccess = function () {
                try {
                    const current = request.result;
                    const revision = current === undefined ? null :
                        current.schemaVersion === 1 ? 0 : current.revision;
                    if (revision !== expectedRevision) {
                        throw new Error("Another tab changed this cashbook. Copy any unsaved entry, then reload before saving.");
                    }
                    nextRevision = (revision ?? 0) + 1;
                    if (!Number.isSafeInteger(nextRevision)) throw new Error("Storage revision limit reached.");
                    // Preserve the original v1 snapshot atomically with its first upgrade.
                    if (current && current.schemaVersion === 1) store.put(current, "recovery-schema-1");
                    store.put({ ...data, revision: nextRevision }, "main");
                } catch (error) {
                    failure = error;
                    transaction.abort();
                }
            };
        });
    } finally {
        database.close();
    }
}


// Function to load the cashbook data from IndexedDB
async function loadCashbook() {
    const database = await openCashbookDatabase();

    try {
        return await new Promise(function (resolve, reject) {
            const transaction = database.transaction("cashbook", "readonly");
            const store = transaction.objectStore("cashbook");
            const request = store.get("main");

            transaction.oncomplete = function () {
                resolve(request.result);
            };

            transaction.onabort = function () {
                reject(transaction.error || new Error("Loading failed."));
            };
        });
    } finally {
        database.close();
    }
}
