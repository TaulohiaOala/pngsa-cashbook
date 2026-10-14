// Presentation only: views remain mounted so navigation never resets a form.
const byId = id => document.getElementById(id);
function uiElement(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}
const uiMain = byId("main-content");
const uiBanner = uiElement("p", "", "feedback-banner");
uiBanner.id = "app-error";
uiBanner.setAttribute("role", "alert");
uiBanner.hidden = true;
const uiLive = uiElement("p", "", "feedback-success");
uiLive.id = "app-feedback";
uiLive.setAttribute("role", "status");
uiMain.before(uiBanner, uiLive);
function showFeedback(message, success = false) {
    const target = success ? uiLive : uiBanner;
    target.hidden = false;
    target.textContent = message;
    if (success) { uiBanner.hidden = true; uiBanner.textContent = ""; }
    const activeForm = document.activeElement?.closest("form");
    if (!success && activeForm) {
        let note = activeForm.querySelector(".form-feedback");
        if (!note) { note = uiElement("p", "", "form-feedback field-error"); note.setAttribute("role", "status"); activeForm.append(note); }
        note.textContent = message;
    }
}

const viewSections = {
    home: ["summary-heading", "opening-heading", "cash-check-heading"],
    add: ["transaction-heading"], history: ["history-heading"],
    reports: ["financial-report-heading"], backup: ["backup-heading", "offline-heading"]
};
const views = {};
const nav = uiElement("nav", "", "app-nav");
nav.setAttribute("aria-label", "Main navigation");
const iconPaths = {
    home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    add: "M12 4v16M4 12h16", history: "M6 4h14v17H6ZM9 8h8M9 12h8M9 16h5M3 7h3M3 12h3M3 17h3",
    reports: "M4 3v18h17M8 16v-5M13 16V7M18 16V4", backup: "M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"
};
const svgNS = "http://www.w3.org/2000/svg";
const sprite = document.createElementNS(svgNS, "svg");
sprite.setAttribute("aria-hidden", "true"); sprite.classList.add("icon-sprite");
for (const [key, path] of Object.entries(iconPaths)) {
    const symbol = document.createElementNS(svgNS, "symbol");
    symbol.id = `icon-${key}`; symbol.setAttribute("viewBox", "0 0 24 24");
    const shape = document.createElementNS(svgNS, "path"); shape.setAttribute("d", path);
    symbol.append(shape); sprite.append(symbol);
}
document.body.prepend(sprite);
for (const [key, headings] of Object.entries(viewSections)) {
    const view = uiElement("div", "", "app-view");
    view.id = `view-${key}`;
    for (const heading of headings) view.append(byId(heading).closest("section"));
    uiMain.append(view); views[key] = view;
    const button = uiElement("button"); button.type = "button";
    button.dataset.view = key; button.setAttribute("aria-controls", view.id);
    const icon = document.createElementNS(svgNS, "svg");
    icon.setAttribute("aria-hidden", "true"); icon.setAttribute("viewBox", "0 0 24 24");
    const use = document.createElementNS(svgNS, "use"); use.setAttribute("href", `#icon-${key}`);
    icon.append(use); button.append(icon, uiElement("span", key[0].toUpperCase() + key.slice(1)));
    button.addEventListener("click", () => showView(key, true)); nav.append(button);
}
document.body.append(nav);
function showView(key, focus = false) {
    for (const [name, view] of Object.entries(views)) view.hidden = name !== key;
    for (const button of nav.querySelectorAll("button")) {
        if (button.dataset.view === key) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    }
    if (focus) {
        const heading = views[key].querySelector("h2");
        heading.tabIndex = -1; heading.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "instant" });
    }
}
showView("home");

// Home prioritises the current balance and hides the locked setup form.
const hero = byId("current-balance").closest(".summary-card");
hero.classList.add("balance-hero");
byId("summary-heading").textContent = "Your cashbook";
byId("summary-heading").after(hero);
const openingNote = uiElement("p", "", "muted");
openingNote.id = "opening-note"; hero.append(openingNote);
const homeActions = uiElement("div", "", "action-row");
for (const type of ["income", "expense"]) {
    const button = uiElement("button", type === "income" ? "+ Add income" : "− Add expense");
    button.type = "button";
    button.addEventListener("click", () => {
        // Don't silently change a partially entered transaction.
        if (!transactionHasDraft()) setTransactionType(type);
        else showFeedback("Your unfinished transaction is still here. Review its type before saving.", true);
        showView("add", true);
    }); homeActions.append(button);
}
hero.after(homeActions);
const addGuidance = uiElement("p", "Set your opening balance on Home before adding transactions.", "notice");
const setupLink = uiElement("button", "Go to opening balance"); setupLink.type = "button";
setupLink.addEventListener("click", () => showView("home", true));
addGuidance.append(document.createElement("br"), setupLink);
byId("transaction-form").before(addGuidance);
const cashDetails = uiElement("details");
cashDetails.append(uiElement("summary", "Compare a physical cash count"));
const cashForm = byId("cash-check-form");
cashForm.before(cashDetails); cashDetails.append(cashForm, byId("cash-check-result"));
const recentSection = uiElement("section"); recentSection.append(uiElement("h2", "Recent activity"));
const recentList = uiElement("ul", "", "transaction-list"); recentList.id = "recent-list";
const seeAll = uiElement("button", "See all transactions", "secondary"); seeAll.type = "button";
seeAll.addEventListener("click", () => showView("history", true));
recentSection.append(recentList, seeAll); views.home.append(recentSection);

// Preserve the existing type select as the single value read by app.js.
const typeSelect = byId("transaction-type");
typeSelect.closest(".form-field").hidden = true;
typeSelect.required = false;
const typeChoices = uiElement("fieldset", "", "type-choices");
typeChoices.append(uiElement("legend", "Transaction type"));
for (const type of ["income", "expense"]) {
    const label = uiElement("label");
    const radio = document.createElement("input"); radio.type = "radio";
    radio.name = "type-choice"; radio.value = type; radio.id = `type-${type}`;
    radio.required = true; radio.addEventListener("change", () => setTransactionType(type));
    label.append(radio, document.createTextNode(type === "income" ? "Income" : "Expense")); typeChoices.append(label);
}
byId("transaction-form").prepend(typeChoices);
typeChoices.after(byId("transaction-amount").closest(".form-field"));
function setTransactionType(type) {
    typeSelect.value = type;
    for (const radio of typeChoices.querySelectorAll("input")) radio.checked = radio.value === type;
    document.querySelector('label[for="transaction-person"]').textContent =
        type === "income" ? "Received from" : type === "expense" ? "Paid to" : "Received from / paid to";
    for (const radio of typeChoices.querySelectorAll("input")) clearFieldError(radio);
}
typeSelect.addEventListener("change", () => setTransactionType(typeSelect.value));
function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function resetEntryDefaults() {
    byId("transaction-date").value = localToday();
    setTransactionType("");
}
resetEntryDefaults();
byId("transaction-form").addEventListener("reset", () => queueMicrotask(resetEntryDefaults));
function transactionHasDraft() {
    return ["amount", "person", "description", "reference", "category"].some(name => byId(`transaction-${name}`).value) ||
        byId("transaction-date").value !== localToday() || Boolean(typeSelect.value);
}
let pendingTemplate = null;
const templatePrompt = uiElement("div", "", "notice"); templatePrompt.hidden = true;
templatePrompt.append(uiElement("p", "You have an unfinished entry. Replace it with the selected template?"));
for (const [label, replace] of [["Replace draft", true], ["Keep my draft", false]]) {
    const button = uiElement("button", label); button.type = "button";
    button.addEventListener("click", () => { if (replace && pendingTemplate) fillTemplate(pendingTemplate); pendingTemplate = null; templatePrompt.hidden = true; });
    templatePrompt.append(button);
}
byId("transaction-form").before(templatePrompt);
function useTransactionTemplate(record) {
    showView("add", true);
    if (transactionHasDraft()) { pendingTemplate = record; templatePrompt.hidden = false; return; }
    fillTemplate(record);
}
function fillTemplate(record) {
    byId("transaction-form").reset();
    // Reset defaults run in a microtask; fill after that reset completes.
    queueMicrotask(() => {
        setTransactionType(record.type);
        byId("transaction-amount").value = centsToDecimal(record.amountCents);
        for (const name of ["category", "person", "description"]) byId(`transaction-${name}`).value = record[name];
        byId("transaction-reference").value = "";
        showFeedback("Template copied. Today’s date is selected and the reference is blank. Review before saving.", true);
    });
}

// Field-level errors, linked to controls, without blocking browser alerts.
function clearFieldError(input) {
    input.removeAttribute("aria-invalid");
    const error = byId(`${input.id}-error`); if (error) error.remove();
    const descriptions = (input.getAttribute("aria-describedby") || "").split(" ").filter(id => id && id !== `${input.id}-error`);
    if (descriptions.length) input.setAttribute("aria-describedby", descriptions.join(" "));
    else input.removeAttribute("aria-describedby");
}
function fieldError(input, message) {
    clearFieldError(input);
    const error = uiElement("p", message, "field-error"); error.id = `${input.id}-error`;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", `${input.getAttribute("aria-describedby") || ""} ${error.id}`.trim());
    input.closest(".form-field, fieldset").append(error);
}
for (const form of document.querySelectorAll("form")) {
    form.noValidate = true;
    form.addEventListener("input", event => { if (event.target.id) clearFieldError(event.target); });
    form.addEventListener("reset", () => { for (const input of form.querySelectorAll("input, select")) clearFieldError(input); });
    form.addEventListener("submit", event => {
        const oldFeedback = form.querySelector(".form-feedback"); if (oldFeedback) oldFeedback.remove();
        let firstInvalid;
        for (const input of form.querySelectorAll("input, select")) {
            if (input.disabled || input.closest("[hidden]")) continue;
            clearFieldError(input);
            let message = input.validity.valid ? "" : input.validationMessage;
            if (input.required && input.type === "text" && !input.value.trim()) message = "Enter a value; spaces alone are not enough.";
            if (input.id === "transaction-date" && openingDate && input.value < openingDate) message = "Choose a date on or after the opening date.";
            if (message) { fieldError(input, message); firstInvalid ||= input; }
        }
        if (firstInvalid) { event.preventDefault(); event.stopImmediatePropagation(); firstInvalid.focus(); }
    }, true);
}

const filters = uiElement("details", "", "filters-disclosure");
const filtersSummary = uiElement("summary", "Filters (0 active)"); filters.append(filtersSummary);
const filtersGrid = document.querySelector(".history-filters"); filtersGrid.before(filters);
filters.append(filtersGrid, byId("filter-status").closest(".form-field"), byId("clear-filters"));
const filterInputs = ["filter-start", "filter-end", "filter-type", "filter-status"];
function refreshFilterCount() {
    filtersSummary.textContent = `Filters (${filterInputs.filter(id => byId(id).value).length} active)`;
}
for (const id of filterInputs) byId(id).addEventListener("change", refreshFilterCount);
byId("clear-filters").addEventListener("click", () => queueMicrotask(refreshFilterCount));
byId("export-csv").after(byId("report-message"));
const voidDialog = document.createElement("dialog"); voidDialog.id = "void-dialog";
voidDialog.setAttribute("aria-labelledby", "void-heading");
document.body.append(voidDialog); voidDialog.append(byId("void-form"));
voidDialog.addEventListener("cancel", event => { event.preventDefault(); if (!saving) closeVoidForm(); });

const deviceChip = uiElement("button", "Checking offline…", "device-chip"); deviceChip.type = "button";
deviceChip.setAttribute("aria-label", "View offline availability and app updates");
deviceChip.addEventListener("click", () => showView("backup", true));
document.querySelector("header").append(uiElement("p", "ASSOCIATION FUNDS · FJD", "brand-caption"), deviceChip);
function refreshDeviceChip() {
    const update = byId("update-status").textContent;
    const offline = byId("offline-status").textContent;
    deviceChip.textContent = update.startsWith("Update ready") ? "Update ready" :
        offline.startsWith("Offline ready") ? "Offline ready" : "Device status";
}
for (const id of ["offline-status", "update-status"]) new MutationObserver(refreshDeviceChip).observe(byId(id), { childList: true, subtree: true, characterData: true });
byId("offline-heading").textContent = "This device";
const backupReminder = uiElement("p", "", "notice"); backupReminder.id = "backup-reminder";
byId("download-backup").before(backupReminder);
function refreshBackupReminder() {
    try {
        const last = localStorage.getItem("pngsa-last-backup-request");
        backupReminder.textContent = last && Number.isFinite(Date.parse(last)) ?
            `${Date.now() - Date.parse(last) > 7 * 86400000 ? "Backup reminder: your last download request was over a week ago. " : ""}Last backup download requested: ${new Date(last).toLocaleString()}. Check that you saved it outside this device.` :
            "No backup download recorded on this device. Keep a JSON backup outside this device after each cash-handling session.";
    } catch { backupReminder.textContent = "Backup reminder unavailable. Keep a JSON backup outside this device."; }
}
function recordBackupRequest() {
    try { localStorage.setItem("pngsa-last-backup-request", new Date().toISOString()); } catch { /* Reminder is optional. */ }
    refreshBackupReminder();
}
refreshBackupReminder();
function friendlyDate(value) {
    return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function refreshExperience() {
    const ready = storageReady;
    const configured = openingBalanceCents !== null;
    byId("opening-form").hidden = configured && transactions.length > 0;
    byId("opening-heading").closest("section").hidden = configured && transactions.length > 0;
    byId("transaction-form").hidden = !configured;
    addGuidance.hidden = configured;
    openingNote.textContent = configured ? `Opening cash ${formatMoney(openingBalanceCents)} · ${friendlyDate(openingDate)}` : "Set your opening cash to get started.";
    for (const form of [byId("opening-form"), byId("transaction-form"), byId("cash-check-form"), byId("restore-form")]) {
        for (const control of form.elements) control.disabled = !ready;
    }
    recentList.replaceChildren();
    for (const record of [...transactions].slice(-3).reverse()) {
        const item = uiElement("li", "", "transaction-item");
        item.append(uiElement("h3", record.description), uiElement("p", `${record.voidedAt ? "Voided · " : ""}${record.type === "income" ? "+" : "−"}${formatMoney(record.amountCents)}`, "transaction-amount"), uiElement("p", friendlyDate(record.date), "muted"));
        recentList.append(item);
    }
    if (!transactions.length) recentList.append(uiElement("li", "Your transactions will appear here after your first entry.", "empty-state"));
}
document.addEventListener("cashbook-updated", () => queueMicrotask(refreshExperience));
document.addEventListener("cashbook-ready", refreshExperience);
// Keep editing visibly unavailable while the initial database read is pending.
for (const id of ["opening-form", "transaction-form", "cash-check-form", "restore-form"]) {
    for (const control of byId(id).elements) control.disabled = true;
}
if (getComputedStyle(document.documentElement).getPropertyValue("--cashbook-ui-version").trim() !== "3") {
    showFeedback("The interface stylesheet is missing or out of date. In Backup → This device, check for app updates, then close every Cashbook tab and reopen. Do not clear website data.");
}
