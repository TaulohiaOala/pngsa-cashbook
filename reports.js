// Reports are read-only. They use the latest committed snapshot, not history filters.
const financialReportForm = document.getElementById("financial-report-form");
const reportStartInput = document.getElementById("report-start");
const reportEndInput = document.getElementById("report-end");
const financialReport = document.getElementById("financial-report");
const financialReportMessage = document.getElementById("financial-report-message");
const printReportButton = document.getElementById("print-report");
let reportRequest = 0;

function invalidateFinancialReport() {
    reportRequest++;
    financialReport.hidden = true;
    financialReport.replaceChildren();
    document.getElementById("report-print-placeholder").hidden = false;
    financialReportMessage.textContent = "Preview the report after changing dates or records.";
}

function calculatePeriodReport(data, start, end) {
    validateCashbook(data);
    if (!isValidDate(start) || !isValidDate(end) || start > end) {
        throw new Error("Choose valid From and To dates, with From on or before To.");
    }
    if (start < data.openingDate) {
        throw new Error(`The report must start on or after the cashbook opening date (${data.openingDate}).`);
    }
    let opening = BigInt(data.openingBalanceCents);
    let income = 0n;
    let expenses = 0n;
    const active = [];
    const voided = [];
    for (const record of data.transactions) {
        if (record.date > end) continue;
        if (record.voidedAt !== null) {
            if (record.date >= start) voided.push(record);
            continue;
        }
        const amount = BigInt(record.amountCents);
        if (record.date < start) opening += record.type === "income" ? amount : -amount;
        else {
            active.push(record);
            if (record.type === "income") income += amount;
            else expenses += amount;
        }
    }
    const totals = [opening, income, expenses, opening + income - expenses];
    if (totals.some(value => value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER))) {
        throw new Error("The report amounts exceed the supported range.");
    }
    // Sort copies; the saved entry order is never changed.
    const byDate = (a, b) => a.date.localeCompare(b.date);
    return { opening: Number(opening), income: Number(income), expenses: Number(expenses),
        closing: Number(totals[3]), active: active.sort(byDate), voided: voided.sort(byDate) };
}

function reportElement(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
}

function reportTransactionTable(records, isVoided) {
    const wrapper = document.createElement("div");
    wrapper.className = "report-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", isVoided ? "Voided records table" : "Active transactions table");
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headings = document.createElement("tr");
    for (const label of (isVoided ? ["Date", "Transaction details", "Original amount (FJD)", "Void details"] :
        ["Date", "Transaction details", "Income (FJD)", "Expense (FJD)"])) {
        const th = reportElement("th", label); th.scope = "col"; headings.append(th);
    }
    head.append(headings); table.append(head);
    const body = document.createElement("tbody");
    for (const record of records) {
        const row = document.createElement("tr");
        row.append(reportElement("td", record.date));
        const details = document.createElement("td");
        details.append(reportElement("strong", record.description),
            reportElement("p", `${record.type === "income" ? "Received from" : "Paid to"}: ${record.person}`),
            reportElement("p", `Category: ${record.category} · Reference: ${record.reference || "Not provided"}`));
        row.append(details);
        if (isVoided) {
            row.append(reportElement("td", `${record.type === "income" ? "Income" : "Expense"}: ${centsToDecimal(record.amountCents)}`));
            const voidDetails = document.createElement("td");
            voidDetails.append(reportElement("p", record.voidReason), reportElement("p", `Voided at (UTC): ${record.voidedAt}`));
            row.append(voidDetails);
        } else {
            row.append(reportElement("td", record.type === "income" ? centsToDecimal(record.amountCents) : "—"),
                reportElement("td", record.type === "expense" ? centsToDecimal(record.amountCents) : "—"));
        }
        body.append(row);
    }
    table.append(body); wrapper.append(table); return wrapper;
}

async function previewFinancialReport() {
    invalidateFinancialReport();
    const request = reportRequest;
    if (!storageReady || saving) {
        financialReportMessage.textContent = "Please wait for loading or saving to finish.";
        return false;
    }
    const start = reportStartInput.value;
    const end = reportEndInput.value;
    try {
        const data = await loadCashbook();
        if (request !== reportRequest) return false;
        if (!data) throw new Error("Set an opening balance before creating a report.");
        const report = calculatePeriodReport(data, start, end);
        financialReport.append(reportElement("h2", "PNGSA Cashbook — Financial report"),
            reportElement("p", `Period: ${start} to ${end} (inclusive)`),
            reportElement("p", `Physical cash · Currency: FJD · Generated at (UTC): ${new Date().toISOString()}`));
        const totals = document.createElement("dl");
        totals.className = "report-totals";
        for (const [label, value] of [["Opening cash", report.opening], ["Period income", report.income],
            ["Period expenses", report.expenses], ["Closing cash", report.closing]]) {
            totals.append(reportElement("dt", label), reportElement("dd", formatMoney(value)));
        }
        financialReport.append(totals,
            reportElement("p", "Opening cash includes active transactions before the period. Closing cash is the expected balance, not a physical cash count."),
            reportElement("p", "Uses current correction status: all voided records are excluded, even when voided after this period. Transactions on the cashbook opening date are activity after the opening cash count."),
            reportElement("h3", `Active transactions (${report.active.length})`));
        financialReport.append(report.active.length ? reportTransactionTable(report.active, false) : reportElement("p", "No active transactions in this period."));
        financialReport.append(reportElement("h3", `Voided records (${report.voided.length})`),
            reportElement("p", "Listed by original transaction date within the period; excluded from all totals. This local correction history is not tamper-proof."));
        financialReport.append(report.voided.length ? reportTransactionTable(report.voided, true) : reportElement("p", "No voided records dated within this period."));
        financialReport.hidden = false;
        document.getElementById("report-print-placeholder").hidden = true;
        financialReportMessage.textContent = "Report ready. Printing uses the latest saved records.";
        return true;
    } catch (error) {
        if (request === reportRequest) financialReportMessage.textContent = `Could not create report: ${error.message}`;
        return false;
    }
}

financialReportForm.addEventListener("submit", event => {
    event.preventDefault();
    previewFinancialReport();
});
printReportButton.addEventListener("click", async () => {
    if (!financialReportForm.reportValidity()) return;
    if (await previewFinancialReport()) window.print();
});
reportStartInput.addEventListener("input", invalidateFinancialReport);
reportEndInput.addEventListener("input", invalidateFinancialReport);
document.addEventListener("cashbook-updated", invalidateFinancialReport);
