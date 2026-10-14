const offlineStatus = document.getElementById("offline-status");
const updateStatus = document.getElementById("update-status");
const checkUpdatesButton = document.getElementById("check-updates");
let appRegistration;

async function refreshOfflineStatus() {
    const worker = navigator.serviceWorker.controller;
    if (!worker) {
        offlineStatus.textContent = "Preparing offline files. Keep this app open and online until ready.";
        return;
    }
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
        channel.port1.close();
        offlineStatus.textContent = "Could not confirm offline readiness. Connect and reopen the app to check again.";
    }, 5000);
    channel.port1.onmessage = event => {
        clearTimeout(timeout);
        channel.port1.close();
        offlineStatus.textContent = event.data.complete ?
            `Offline ready · ${navigator.onLine ? "Connection available" : "No connection"}. Records stay on this device.` :
            "Offline files are incomplete. Connect to the internet and check for an app update before relying on offline use.";
    };
    worker.postMessage("CHECK_OFFLINE", [channel.port2]);
}

function showWaitingUpdate() {
    if (appRegistration.waiting) {
        updateStatus.textContent = "Update ready. Finish and save your work, then close all Cashbook tabs and app windows. Reopen to use the update. Your records stay on this device.";
    }
}

async function initialiseOffline() {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
        offlineStatus.textContent = "Offline installation requires a supported browser and HTTPS (or localhost for laptop development).";
        checkUpdatesButton.disabled = true;
        return;
    }
    try {
        appRegistration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
        const watchInstall = () => {
            const worker = appRegistration.installing;
            if (!worker) return;
            updateStatus.textContent = "Downloading app files…";
            worker.addEventListener("statechange", () => {
                if (worker.state === "installed") {
                    updateStatus.textContent = "";
                    showWaitingUpdate();
                } else if (worker.state === "redundant") {
                    updateStatus.textContent = "App download failed. Reconnect and check for updates to retry. Existing saved records are unchanged.";
                }
            });
        };
        appRegistration.addEventListener("updatefound", watchInstall);
        watchInstall();
        showWaitingUpdate();
        navigator.serviceWorker.addEventListener("controllerchange", refreshOfflineStatus);
        await refreshOfflineStatus();
        navigator.serviceWorker.ready.then(refreshOfflineStatus);
        window.addEventListener("online", refreshOfflineStatus);
        window.addEventListener("offline", refreshOfflineStatus);
    } catch (error) {
        offlineStatus.textContent = "Offline setup failed. Keep an internet connection and reopen to retry.";
        console.error("Offline setup failed:", error);
    }
}

checkUpdatesButton.addEventListener("click", async () => {
    if (!appRegistration) { await initialiseOffline(); return; }
    checkUpdatesButton.disabled = true;
    try {
        await appRegistration.update();
        if (appRegistration.waiting) showWaitingUpdate();
        else if (!appRegistration.installing) updateStatus.textContent = "No new app update found.";
        await refreshOfflineStatus();
    } catch {
        updateStatus.textContent = "Could not check for updates. Try again when connected.";
    } finally { checkUpdatesButton.disabled = false; }
});

initialiseOffline();
