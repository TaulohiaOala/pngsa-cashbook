// selects cash check form and message display
const cashCheckForm = document.getElementById("cash-check-form");
const countedCashInput = document.getElementById("counted-cash");
const cashCheckResult = document.getElementById("cash-check-result");

// selects export button and message display
const exportCsvButton = document.getElementById("export-csv");
const reportMessage = document.getElementById("report-message");


// selects restore form and message display
const restoreForm = document.getElementById("restore-form");
const restoreFileInput = document.getElementById("restore-file");
const restoreMessage = document.getElementById("restore-message");


// selects filter inputs and message display
const filterStart = document.getElementById("filter-start");
const filterEnd = document.getElementById("filter-end");
const filterType = document.getElementById("filter-type");
const filterStatus = document.getElementById("filter-status");
const clearFiltersButton = document.getElementById("clear-filters");
const filterMessage = document.getElementById("filter-message");


// selects html elements 

const openingForm = document.getElementById("opening-form");
const openingDateInput = document.getElementById("opening-date");
const openingAmountInput = document.getElementById("opening-amount");

const openingBalanceDisplay = document.getElementById("opening-balance");
const currentBalanceDisplay = document.getElementById("current-balance");

let openingBalanceCents = null;
let openingDate = null;

// selects transaction list and empty history message

const transactionList = document.getElementById("transaction-list");
const emptyHistory = document.getElementById("empty-history");

// selects transaction form inputs
const totalIncomeDisplay = document.getElementById("total-income");
const totalExpensesDisplay = document.getElementById("total-expenses");

const transactions = [];


// selects transaction form and adds event listener for submission
const transactionForm = document.getElementById("transaction-form");
transactionForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!storageReady || saving) {
    alert("Please wait for loading or saving to finish.");
    return;
    }

    if (openingBalanceCents === null) {
        alert("Set the opening balance before adding transactions.");
        return;
    }

    const date = document.getElementById("transaction-date").value;
    const type = document.getElementById("transaction-type").value;

    const amountCents = parseAmountToCents(
        document.getElementById("transaction-amount").value
    );

    const category =
        document.getElementById("transaction-category").value;

    const person =
        document.getElementById("transaction-person").value.trim();

    const description =
        document.getElementById("transaction-description").value.trim();

    const reference =
        document.getElementById("transaction-reference").value.trim();

    if (!date || date < openingDate) {
        alert("Choose a date on or after the opening balance date.");
        return;
    }

    if (type !== "income" && type !== "expense") {
        alert("Choose income or expense.");
        return;
    }

    if (amountCents === null || amountCents <= 0) {
        alert("Enter a positive amount with no more than two decimal places.");
        return;
    }

    if (!category || !person || !description) {
        alert("Complete the category, person, and description fields.");
        return;
    }

    const transaction = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        voidedAt: null,
        voidReason: "",
        date: date,
        type: type,
        amountCents: amountCents,
        category: category,
        person: person,
        description: description,
        reference: reference
    };

const updatedTransactions = [...transactions, transaction];

    const saved = await persistCashbook(
        openingBalanceCents,
        openingDate,
        updatedTransactions
    );

    if (!saved) {
        return;
    }

    transactions.push(transaction);

    updateSummary();
    renderTransactions();
    transactionForm.reset();

    alert("Transaction saved on this device.");
});

// selects backup button and message display
const downloadBackupButton = document.getElementById("download-backup");
const backupMessage = document.getElementById("backup-message");

// Function to get filtered transactions based on user input
function getFilteredTransactions() {
    const start = filterStart.value;
    const end = filterEnd.value;
    const type = filterType.value;

    return transactions.filter(function (transaction) {
        const matchesStart = !start || transaction.date >= start;
        const matchesEnd = !end || transaction.date <= end;
        const matchesType = !type || transaction.type === type;

        const matchesStatus = !filterStatus.value ||
            (filterStatus.value === "voided" ? transaction.voidedAt !== null : transaction.voidedAt === null);
        return matchesStart && matchesEnd && matchesType && matchesStatus;
    });
}

// Function to convert a value to a CSV cell, escaping as necessary
function csvCell(value) {
    let text = String(value);

    // Prevent text from being interpreted as a spreadsheet formula.
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) {
        text = "'" + text;
    }

    // Escape quotation marks and enclose the cell in quotes.
    return '"' + text.replace(/"/g, '""') + '"';
}

// Function to calculate the current cash balance in cents

function calculateCashBalanceCents() {
    if (openingBalanceCents === null) {
        return null;
    }

    let balanceCents = openingBalanceCents;

    for (const transaction of transactions) {
        if (transaction.voidedAt !== null) continue;
        if (transaction.type === "income") {
            balanceCents += transaction.amountCents;
        } else if (transaction.type === "expense") {
            balanceCents -= transaction.amountCents;
        }
    }

    return balanceCents;
}

// Function to convert amount string to cents

function parseAmountToCents(value) {
    const amountText = value.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
        return null;
    }

    const [dollars, cents = ""] = amountText.split(".");

    const totalCents = BigInt(dollars) * 100n + BigInt(cents.padEnd(2, "0"));
    if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) {
        return null;
    }

    return Number(totalCents);
}

// Function to display currency

function formatMoney(cents) {
    return `FJD ${centsToDecimal(cents)}`;
}

function centsToDecimal(cents) {
    const value = BigInt(cents);
    const absolute = value < 0n ? -value : value;
    return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

// Function to update the summary display

function updateSummary() {
    document.dispatchEvent(new Event("cashbook-updated"));
    countedCashInput.value = "";
    cashCheckResult.textContent = "";

    let incomeCents = 0;
    let expenseCents = 0;

    for (const transaction of transactions) {
        if (transaction.voidedAt !== null) continue;
        if (transaction.type === "income") {
            incomeCents += transaction.amountCents;
        } else if (transaction.type === "expense") {
            expenseCents += transaction.amountCents;
        }
    }

    totalIncomeDisplay.textContent = formatMoney(incomeCents);
    totalExpensesDisplay.textContent = formatMoney(expenseCents);

    if (openingBalanceCents === null) {
        openingBalanceDisplay.textContent = "Not set";
        currentBalanceDisplay.textContent = "Not set";
        return;
    }

    openingBalanceDisplay.textContent = formatMoney(openingBalanceCents);

    const balanceCents = calculateCashBalanceCents();

    currentBalanceDisplay.textContent = formatMoney(balanceCents);
}


// Function to render/display the transaction list

function renderTransactions() {
transactionList.replaceChildren();
filterMessage.textContent = "";

if (
    filterStart.value &&
    filterEnd.value &&
    filterStart.value > filterEnd.value
) {
    emptyHistory.hidden = true;
    filterMessage.textContent =
        "The From date must be on or before the To date.";
    return;
}

const visibleTransactions = getFilteredTransactions();

emptyHistory.hidden = visibleTransactions.length > 0;

emptyHistory.textContent = transactions.length === 0
    ? "No transactions recorded yet."
    : "No transactions match these filters.";

filterMessage.textContent =
    `Showing ${visibleTransactions.length} of ${transactions.length} transactions ` +
    `(${visibleTransactions.filter(record => record.voidedAt === null).length} active, ` +
    `${visibleTransactions.filter(record => record.voidedAt !== null).length} voided in this view).`;

for (const transaction of [...visibleTransactions].reverse()) {
        const item = document.createElement("li");
        item.classList.add("transaction-item");

        const heading = document.createElement("h3");
        heading.textContent = transaction.description;

        const amount = document.createElement("p");
        amount.classList.add("transaction-amount", transaction.type);

        const isIncome = transaction.type === "income";
        const typeLabel = isIncome ? "Income" : "Expense";
        const sign = isIncome ? "+" : "−";

        amount.textContent =
            `${typeLabel}: ${sign}${formatMoney(transaction.amountCents)}`;

        const date = document.createElement("p");
        date.textContent = `Date: ${transaction.date}`;

        const person = document.createElement("p");
        const personLabel = isIncome ? "Received from" : "Paid to";
        person.textContent = `${personLabel}: ${transaction.person}`;

        const category = document.createElement("p");
        category.textContent = `Category: ${transaction.category}`;

        const reference = document.createElement("p");
        reference.textContent =
            `Reference: ${transaction.reference || "Not provided"}`;

        item.append(heading, amount, date, person, category, reference);
        if (transaction.voidedAt !== null) {
            item.classList.add("voided");
            const details = document.createElement("p");
            details.textContent = `Voided — excluded from totals. Reason: ${transaction.voidReason}. Time: ${new Date(transaction.voidedAt).toLocaleString()}`;
            item.append(details);
        } else {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Void transaction";
            button.addEventListener("click", () => openVoidForm(transaction.id));
            item.append(button);
        }
        transactionList.append(item);
    }
}


//function to persist cashbook data to storage

openingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!storageReady || saving) {
        alert("Please wait for loading or saving to finish.");
        return;
    }

    if (transactions.length > 0) {
        alert("The opening balance cannot be changed after adding transactions.");
        return;
    }

    const amountCents = parseAmountToCents(openingAmountInput.value);
    const startDate = openingDateInput.value;

    if (amountCents === null || !startDate) {
        alert("Enter a starting date and a valid non-negative amount.");
        return;
    }

    const saved = await persistCashbook(
        amountCents,
        startDate,
        transactions
    );

    if (!saved) {
        return;
    }

    openingBalanceCents = amountCents;
    openingDate = startDate;

    updateSummary();
});

renderTransactions();

// Function to initialise storage and load cashbook data
async function initialiseStorage() {
    try {
        let saved = await loadCashbook();

        if (saved !== undefined) {
            validateCashbook(saved);
            if (saved.schemaVersion === 1) {
                const migrated = migrateCashbook(saved);
                storageRevision = await saveCashbook(migrated, 0);
                saved = migrated;
            } else {
                if (!Number.isSafeInteger(saved.revision) || saved.revision < 1) {
                    throw new Error("Invalid storage revision.");
                }
                storageRevision = saved.revision;
            }

            openingBalanceCents = saved.openingBalanceCents;
            openingDate = saved.openingDate;

            transactions.length = 0;

            for (const transaction of saved.transactions) {
                transactions.push(transaction);
            }

            openingDateInput.value = openingDate;
            openingAmountInput.value =
                centsToDecimal(openingBalanceCents);
        }

        updateSummary();
        renderTransactions();

        storageReady = true;

        console.log("Cashbook loaded and ready.");
    } catch (error) {
        console.error("Loading failed:", error);
        alert("Could not load the cashbook. Entries are blocked. Please reload.");
    }
}


// button click event listener to download a backup of the cashbook data
downloadBackupButton.addEventListener("click", function () {
    backupMessage.textContent = "";

    if (!storageReady || saving) {
        backupMessage.textContent =
            "Please wait for loading or saving to finish.";
        return;
    }

    if (openingBalanceCents === null) {
        backupMessage.textContent =
            "Set an opening balance before creating a backup.";
        return;
    }

    const exportedAt = new Date().toISOString();

    const backup = {
        app: "PNGSA Cashbook",
        schemaVersion: 2,
        exportedAt: exportedAt,
        openingBalanceCents: openingBalanceCents,
        openingDate: openingDate,
        transactions: transactions
    };

    const json = JSON.stringify(backup, null, 2);

    const file = new Blob([json], {
        type: "application/json"
    });

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    const timestamp = exportedAt.replace(/[:.]/g, "-");

    link.href = url;
    link.download = `pngsa-cashbook-backup-${timestamp}.json`;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 60000);

    backupMessage.textContent =
        "Backup download requested. Check that the file was saved.";
});

// Function to check file validity and restore cashbook data from a backup file
function isValidDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith("0000")
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

function validateBackup(data) {
    if (!data || data.app !== "PNGSA Cashbook") throw new Error("This is not a PNGSA Cashbook backup.");
    validateCashbook(data);
}

function isValidTimestamp(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
        Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function migrateCashbook(data) {
    validateCashbook(data);
    return {
        schemaVersion: 2,
        openingBalanceCents: data.openingBalanceCents,
        openingDate: data.openingDate,
        transactions: data.transactions.map(record => data.schemaVersion === 1 ? {
            date: record.date, type: record.type, amountCents: record.amountCents,
            category: record.category, person: record.person, description: record.description,
            reference: record.reference, id: crypto.randomUUID(), createdAt: null,
            voidedAt: null, voidReason: ""
        } : { ...record })
    };
}

function validateCashbook(data) {
    if (
        !data ||
        ![1, 2].includes(data.schemaVersion) ||
        !Number.isSafeInteger(data.openingBalanceCents) ||
        data.openingBalanceCents < 0 ||
        !isValidDate(data.openingDate) ||
        !Array.isArray(data.transactions)
    ) {
        throw new Error("This is not a supported PNGSA Cashbook backup.");
    }

    const categories = [
        "membership", "donations", "fundraising",
        "events", "transport", "supplies", "other"
    ];

    let incomeCents = 0;
    let expenseCents = 0;
    const ids = new Set();

    for (const record of data.transactions) {
        if (
            !record ||
            !isValidDate(record.date) ||
            record.date < data.openingDate ||
            !["income", "expense"].includes(record.type) ||
            !Number.isSafeInteger(record.amountCents) ||
            record.amountCents <= 0 ||
            !categories.includes(record.category) ||
            typeof record.person !== "string" ||
            !record.person.trim() ||
            record.person.length > 100 ||
            typeof record.description !== "string" ||
            !record.description.trim() ||
            record.description.length > 200 ||
            typeof record.reference !== "string" ||
            record.reference.length > 100
        ) {
            throw new Error("The backup contains an invalid transaction.");
        }

        if (data.schemaVersion === 2) {
            if (typeof record.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(record.id) || ids.has(record.id) ||
                !(record.createdAt === null || isValidTimestamp(record.createdAt)) ||
                !(record.voidedAt === null || isValidTimestamp(record.voidedAt)) ||
                typeof record.voidReason !== "string" || record.voidReason.length > 200 ||
                (record.voidedAt === null ? record.voidReason !== "" : !record.voidReason.trim())) {
                throw new Error("Invalid transaction ID or void details.");
            }
            ids.add(record.id);
            if (record.voidedAt !== null) continue;
        }
        if (record.type === "income") {
            incomeCents += record.amountCents;
        } else {
            expenseCents += record.amountCents;
        }

        if (
            !Number.isSafeInteger(incomeCents) ||
            !Number.isSafeInteger(expenseCents) ||
            !Number.isSafeInteger(
                data.openingBalanceCents + incomeCents
            )
        ) {
            throw new Error("The amounts exceed the supported range.");
        }
    }
}

// adds event listener to restore form submission to restore cashbook data from a backup file
restoreForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    restoreMessage.textContent = "";

    if (!storageReady || saving) {
        restoreMessage.textContent =
            "Please wait for loading or saving to finish.";
        return;
    }

    const file = restoreFileInput.files[0];

    if (!file) {
        restoreMessage.textContent = "Choose a backup file first.";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        restoreMessage.textContent =
            "This file exceeds our current 5 MB backup limit.";
        return;
    }

    saving = true;

    try {
        const text = await file.text();
        let backup;

        try {
            backup = JSON.parse(text);
        } catch {
            throw new Error("The file does not contain valid JSON.");
        }

        validateBackup(backup);

        const confirmed = window.confirm(
            `Replace the current cashbook with this backup?\n\n` +
            `Opening date: ${backup.openingDate}\n` +
            `Opening balance: ${formatMoney(backup.openingBalanceCents)}\n` +
            `Transactions: ${backup.transactions.length}\n\n` +
            `This replaces all current records; it does not merge them.`
        );

        if (!confirmed) {
            restoreMessage.textContent =
                "Restore cancelled. Your records were not changed.";
            return;
        }

        backup = migrateCashbook(backup);
        storageRevision = await saveCashbook(backup);

        openingBalanceCents = backup.openingBalanceCents;
        openingDate = backup.openingDate;

        transactions.length = 0;

        for (const record of backup.transactions) {
            transactions.push(record);
        }

        openingDateInput.value = openingDate;
        openingAmountInput.value =
            centsToDecimal(openingBalanceCents);

        updateSummary();
        renderTransactions();

        transactionForm.reset();
        closeVoidForm();
        restoreForm.reset();

        restoreMessage.textContent = "Backup restored successfully.";
    } catch (error) {
        console.error("Restore failed:", error);

        restoreMessage.textContent =
            `Restore failed: ${error.message}`;
    } finally {
        saving = false;
    }
});


//connects filter inputs to renderTransactions function to update the transaction list based on user input
filterStart.addEventListener("change", renderTransactions);
filterEnd.addEventListener("change", renderTransactions);
filterType.addEventListener("change", renderTransactions);
filterStatus.addEventListener("change", renderTransactions);

clearFiltersButton.addEventListener("click", function () {
    filterStart.value = "";
    filterEnd.value = "";
    filterType.value = "";
    filterStatus.value = "";

    renderTransactions();
});



//adds event listener to the export button to export filtered transactions as a CSV file
exportCsvButton.addEventListener("click", function () {
    reportMessage.textContent = "";

    if (!storageReady || saving) {
        reportMessage.textContent =
            "Please wait for loading or saving to finish.";
        return;
    }

    if (
        filterStart.value &&
        filterEnd.value &&
        filterStart.value > filterEnd.value
    ) {
        reportMessage.textContent =
            "Correct the date range before exporting.";
        return;
    }

    const records = getFilteredTransactions();

    if (records.length === 0) {
        reportMessage.textContent =
            "There are no matching transactions to export.";
        return;
    }

    records.sort(function (first, second) {
        return first.date.localeCompare(second.date);
    });

    const rows = [
        [
            "Date",
            "Type",
            "Category",
            "Received from / Paid to",
            "Description",
            "Reference",
            "Income (FJD)",
            "Expense (FJD)", "ID", "Status", "Created at (UTC)",
            "Voided at (UTC)", "Void reason", "Original amount (FJD)"
        ]
    ];

    for (const transaction of records) {
        const amount = centsToDecimal(transaction.amountCents);

        rows.push([
            transaction.date,
            transaction.type === "income" ? "Income" : "Expense",
            transaction.category,
            transaction.person,
            transaction.description,
            transaction.reference,
            transaction.voidedAt === null && transaction.type === "income" ? amount : "",
            transaction.voidedAt === null && transaction.type === "expense" ? amount : "",
            transaction.id, transaction.voidedAt === null ? "Active" : "Voided",
            transaction.createdAt || "", transaction.voidedAt || "", transaction.voidReason, amount
        ]);
    }

    const csv = rows
        .map(function (row) {
            return row.map(csvCell).join(",");
        })
        .join("\r\n");

    const file = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    link.href = url;
    link.download = `pngsa-transactions-${timestamp}.csv`;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 60000);

    reportMessage.textContent =
        `Download requested for ${records.length} transactions. ` +
        "Check that the file was saved.";
});



//adds event listener to the cash check form to compare counted cash with expected cash balance
cashCheckForm.addEventListener("submit", function (event) {
    event.preventDefault();
    cashCheckResult.textContent = "";

    if (!storageReady || saving) {
        cashCheckResult.textContent =
            "Please wait for loading or saving to finish.";
        return;
    }

    const expectedCents = calculateCashBalanceCents();

    if (expectedCents === null) {
        cashCheckResult.textContent =
            "Set the opening balance before checking the cash.";
        return;
    }

    const countedCents = parseAmountToCents(countedCashInput.value);

    if (countedCents === null) {
        cashCheckResult.textContent =
            "Enter a valid non-negative amount with up to two decimal places.";
        return;
    }

    const differenceCents = countedCents - expectedCents;
    if (!Number.isSafeInteger(differenceCents)) {
        cashCheckResult.textContent = "The cash difference exceeds the supported range.";
        return;
    }

    if (differenceCents === 0) {
        cashCheckResult.textContent =
            `Cash matches: counted and expected amounts are both ` +
            `${formatMoney(expectedCents)}.`;
    } else if (differenceCents < 0) {
        cashCheckResult.textContent =
            `Shortage: ${formatMoney(Math.abs(differenceCents))}. ` +
            `Expected ${formatMoney(expectedCents)}, ` +
            `but counted ${formatMoney(countedCents)}.`;
    } else {
        cashCheckResult.textContent =
            `Surplus: ${formatMoney(differenceCents)}. ` +
            `Expected ${formatMoney(expectedCents)}, ` +
            `but counted ${formatMoney(countedCents)}.`;
    }
});


const voidForm = document.getElementById("void-form");
const voidReason = document.getElementById("void-reason");
const voidMessage = document.getElementById("void-message");
let voidTransactionId = null;

function openVoidForm(id) {
    if (!storageReady || saving) return;
    const record = transactions.find(record => record.id === id);
    if (!record || record.voidedAt !== null) return;
    if (voidTransactionId !== id) voidReason.value = "";
    voidTransactionId = id;
    document.getElementById("void-details").textContent =
        `${record.date} — ${record.description} — ${formatMoney(record.amountCents)}`;
    voidMessage.textContent = "";
    voidForm.hidden = false;
    voidReason.focus();
}

function closeVoidForm() {
    voidForm.hidden = true;
    voidTransactionId = null;
    voidForm.reset();
    voidMessage.textContent = "";
}

document.getElementById("cancel-void").addEventListener("click", () => {
    if (!saving) closeVoidForm();
});

voidForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!storageReady || saving) return;
    const record = transactions.find(record => record.id === voidTransactionId);
    if (!record || record.voidedAt !== null) {
        voidMessage.textContent = "This transaction is no longer available to void.";
        return;
    }
    const reason = voidReason.value.trim();
    if (!reason || reason.length > 200) {
        voidMessage.textContent = "Enter a reason of 1–200 characters.";
        return;
    }
    const updated = transactions.map(entry => entry.id === record.id ?
        { ...entry, voidedAt: new Date().toISOString(), voidReason: reason } : entry);
    const saved = await persistCashbook(openingBalanceCents, openingDate, updated);
    if (!saved) {
        voidMessage.textContent = "Not saved. Your reason is retained; check the save error before retrying.";
        return;
    }
    transactions.length = 0;
    for (const entry of updated) transactions.push(entry);
    closeVoidForm();
    updateSummary();
    renderTransactions();
});

initialiseStorage();
