// Firebase References
const transactionsRef = firebase.database().ref('transactions');
const studentsRef = firebase.database().ref('students');
const salesRef = firebase.database().ref('sales'); // Inventory Sales
const usersRef = firebase.database().ref('users');

// Cache Current User Name
let currentUserName = '';

// State Variables
let transactionsData = [];
let allStudentsData = {}; // Store raw student data for reports
// Pagination State
let currentPage = 1;
const itemsPerPage = 10;
let currentFilter = 'all'; // all, income, expense
const KHMER_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    setupEventListeners();
    fetchTransactions();

    // Define Khmer Locale for Flatpickr
    flatpickr.l10ns.km = {
        weekdays: {
            shorthand: ["អា", "ច", "អ", "ព", "ព្រ", "សុ", "ស"],
            longhand: [
                "អាទិត្យ",
                "ចន្ទ",
                "អង្គារ",
                "ពុធ",
                "ព្រហស្បតិ៍",
                "សុក្រ",
                "សៅរ៍",
            ],
        },
        months: {
            shorthand: ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"],
            longhand: ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"],
        },
        rangeSeparator: " ដល់ ",
    };

    // Initialize Flatpickr for Date Input with Khmer Locale
    const fp = flatpickr("#transDate", {
        locale: flatpickr.l10ns.km,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j F Y", // Example: 26 មករា 2026
        defaultDate: new Date(),
        allowInput: true
    });

    // Initialize Flatpickr for Student Payment (payDate)
    flatpickr("#payDate", {
        locale: flatpickr.l10ns.km,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j F Y",
        defaultDate: new Date(),
        allowInput: true
    });

    // Initialize Flatpickr for Next Payment Date (nextPayDateManual)
    flatpickr("#nextPayDateManual", {
        locale: flatpickr.l10ns.km,
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "j F Y",
        allowInput: true
    });

    // Set default date to today in Modal (Handled by defaultDate above, but keeping reference if needed)
    // document.getElementById('transDate').valueAsDate = new Date(); // Removed as Flatpickr handles it


    // Fetch Current User Details
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // Priority: 1. DB Display Name, 2. Auth Display Name, 3. Email Name
            usersRef.child(user.uid).once('value').then(snap => {
                const userData = snap.val();
                if (userData && (userData.name || userData.displayName || userData.username)) {
                    currentUserName = userData.name || userData.displayName || userData.username;
                } else if (user.displayName) {
                    currentUserName = user.displayName;
                } else {
                    // Extract name from email (e.g. 'long.mmo' from 'long.mmo@gmail.com')
                    currentUserName = user.email.split('@')[0];
                }
            });
        }
    });

    // Handle URL Parameters (e.g. ?pay=STUDENT_KEY)
    const urlParams = new URLSearchParams(window.location.search);
    const payKey = urlParams.get('pay');
    if (payKey) {
        // Wait for data to load before opening
        const checkData = setInterval(() => {
            if (Object.keys(allStudentsData).length > 0) {
                openStudentPaymentModal(payKey);
                clearInterval(checkData);
                // Clean up URL without refreshing
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }
        }, 500);
        // Timeout after 5 seconds to prevent infinite loop
        setTimeout(() => clearInterval(checkData), 5000);
    }
});

// ==========================================
// CORE FUNCTIONS
// ==========================================

function fetchTransactions() {
    showLoading(true);

    // Use .on() instead of .once() for real-time updates
    let transSnap = null;
    let studentsSnap = null;
    let salesSnap = null;

    const checkAllLoaded = () => {
        // Only process if all sources have returned at least once
        if (transSnap !== null && studentsSnap !== null && salesSnap !== null) {
            processAllData();
        }
    };

    const processAllData = () => {
        transactionsData = [];

        // 1. Process Manual Transactions
        const transData = transSnap ? transSnap.val() : null;
        const overrideIds = new Set(); // Track IDs that exist in manual transactions

        if (transData) {
            Object.keys(transData).forEach(key => {
                const item = transData[key];
                overrideIds.add(key); // Add to overrides

                let defaultPayer = item.payer;
                let defaultReceiver = item.receiver;

                // Smart Defaults for Legacy Data
                if (!defaultPayer) {
                    if (item.type === 'income') defaultPayer = 'សិស្ស/អាណាព្យាបាល (General)';
                    else defaultPayer = 'សាលា (School)';
                }
                if (!defaultReceiver) {
                    if (item.type === 'income') defaultReceiver = 'សាលា (School)';
                    else defaultReceiver = 'អ្នកលក់/បុគ្គលិក (Vendor/Staff)';
                }

                transactionsData.push({
                    id: key,
                    sourceType: 'manual',
                    ...item,
                    date: item.date || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                    amount: parseFloat(item.amount) || 0,
                    amountKH: parseFloat(item.amountKH) || 0,
                    payer: defaultPayer,
                    receiver: defaultReceiver
                });
            });
        }

        // 2. Process Student Income (Registration + Installments)
        const studentsData = studentsSnap ? studentsSnap.val() : null;
        if (studentsData) {
            Object.entries(studentsData).forEach(([studentKey, student]) => {
                const name = `${student.lastName || ''} ${student.firstName || ''}`;

                // A. Initial Payment (Registration)
                const regId = `reg_${studentKey}`;
                const initialPay = parseFloat(student.initialPayment) || 0;

                if (initialPay > 0 && !overrideIds.has(regId)) {
                    transactionsData.push({
                        id: regId,
                        type: 'income',
                        category: `ចុះឈ្មោះសិស្ស - ${name}`,
                        description: `សិស្ស៖ ${name} (${student.displayId || 'N/A'}) - បង់ដំបូង`,
                        amount: initialPay,
                        date: student.startDate || new Date().toISOString().split('T')[0],
                        sourceType: 'system',
                        payer: 'អាណាព្យាបាល',
                        receiver: student.receiver || 'Admin',
                        recorder: 'System',
                        studentKey: studentKey
                    });
                }

                // B. Installments/Additional Payments
                if (student.installments) {
                    const instObj = isArray(student.installments) ? student.installments : Object.values(student.installments);
                    instObj.forEach((inst, idx) => {
                        const instId = `inst_${studentKey}_${idx}`;
                        const amt = parseFloat(inst.amount) || 0;
                        if (amt > 0 && !overrideIds.has(instId)) {
                            transactionsData.push({
                                id: instId,
                                type: 'income',
                                category: `បង់ប្រាក់បន្ថែម - ${name}`,
                                description: `សិស្ស៖ ${name} - ដំណាក់កាល/Stage ${inst.stage || (idx + 1)}${inst.forMonth ? ' (' + inst.forMonth + ')' : ''}`,
                                amount: amt,
                                date: inst.date || new Date().toISOString().split('T')[0],
                                sourceType: 'system',
                                payer: 'អាណាព្យាបាល',
                                receiver: inst.receiver || 'Admin',
                                recorder: 'System',
                                studentKey: studentKey
                            });
                        }
                    });
                }
            });
        }

        // 3. Process Inventory Sales (Check overrides too just in case)
        const salesData = salesSnap ? salesSnap.val() : null;
        if (salesData) {
            Object.entries(salesData).forEach(([key, sale]) => {
                const saleId = `sale_${key}`;
                const amt = parseFloat(sale.totalPrice) || 0;
                if (amt > 0 && !overrideIds.has(saleId)) {
                    transactionsData.push({
                        id: saleId,
                        type: 'income',
                        category: 'Inventory Sale (លក់សម្ភារៈ)',
                        description: `${sale.itemName} (Qty: ${sale.quantity})`,
                        amount: amt,
                        date: sale.soldDate || (sale.soldAt ? sale.soldAt.split('T')[0] : new Date().toISOString().split('T')[0]),
                        sourceType: 'system',
                        payer: 'General/Customer',
                        receiver: sale.stockKeeper || 'Admin',
                        recorder: 'System'
                    });
                }
            });
        }

        // Sort by date descending (newest first)
        transactionsData.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;

            if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;

            if (a.id < b.id) return 1;
            if (a.id > b.id) return -1;
            return 0;
        });

        // --- Calculate Totals for Dashboard Cards ---
        let totalIncome = 0;
        let totalExpense = 0;
        const EXCHANGE_RATE = 4000; // 4000 KHR = 1 USD

        transactionsData.forEach(t => {
            let valUSD = parseFloat(t.amount);
            if (isNaN(valUSD)) valUSD = 0;

            let valKHR = parseFloat(t.amountKH);
            if (isNaN(valKHR)) valKHR = 0;

            // Convert KHR to USD
            if (valKHR > 0) {
                valUSD += (valKHR / EXCHANGE_RATE);
            }

            if (t.type === 'income') {
                totalIncome += valUSD;
            } else if (t.type === 'expense') {
                totalExpense += valUSD;
            }
        });

        const netBalance = totalIncome - totalExpense;

        // Update UI
        if (document.getElementById('totalIncomeDisplay')) {
            document.getElementById('totalIncomeDisplay').textContent = `$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (document.getElementById('totalExpenseDisplay')) {
            document.getElementById('totalExpenseDisplay').textContent = `$${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (document.getElementById('netBalanceDisplay')) {
            const nbEl = document.getElementById('netBalanceDisplay');
            nbEl.textContent = `$${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            // Optional: Color code balance
            if (netBalance < 0) nbEl.classList.add('text-warning'); // Warning if negative (though it's white text on card)
            else nbEl.classList.remove('text-warning');
        }

        // --- Calculate Student Payment Stats for Dashboard ---
        let cPaid = 0, cOverdue = 0, cToday = 0, cSoon = 0, cPostponed = 0, cUnpaid = 0;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const currentMonthName = KHMER_MONTHS[now.getMonth()];

        Object.values(allStudentsData).forEach(s => {
            if (s.enrollmentStatus === 'dropout') return;

            const paymentStatus = getPaymentStatus(s);
            const status = paymentStatus.status;

            if (status === 'overdue') cOverdue++;
            else if (status === 'today') cToday++;
            else if (status === 'warning') cSoon++;
            else if (status === 'installment') cPostponed++;
            else if (status === 'pending') cUnpaid++;
            else if (status === 'paid') cPaid++;
        });

        if (document.getElementById('reportOverdueStudents')) updateStatValue('reportOverdueStudents', cOverdue, false);
        if (document.getElementById('reportTodayStudents')) updateStatValue('reportTodayStudents', cToday, false);
        if (document.getElementById('reportSoonStudents')) updateStatValue('reportSoonStudents', cSoon, false);
        if (document.getElementById('reportPostponedStudents')) updateStatValue('reportPostponedStudents', cPostponed, false);
        if (document.getElementById('reportUnpaidStudents')) updateStatValue('reportUnpaidStudents', cUnpaid, false);

        // Update new Notification Button
        const btnToday = document.getElementById('btnTodayNotification');
        const badgeToday = document.getElementById('todayPaymentBadge');
        if (btnToday && badgeToday) {
            badgeToday.textContent = cToday;
            if (cToday > 0) {
                btnToday.style.display = 'block';
                btnToday.classList.add('pulse-today');
            } else {
                btnToday.style.display = 'none';
                btnToday.classList.remove('pulse-today');
            }
        }

        renderTable();
        showLoading(false);
    };

    // Set up real-time listeners
    transactionsRef.on('value', snapshot => {
        transSnap = snapshot;
        checkAllLoaded();
    });

    studentsRef.on('value', snapshot => {
        studentsSnap = snapshot;
        const data = snapshot.val() || {};
        allStudentsData = {};
        Object.keys(data).forEach(key => {
            allStudentsData[key] = { ...data[key], key: key };
        });
        checkAllLoaded();
    });

    salesRef.on('value', snapshot => {
        salesSnap = snapshot;
        checkAllLoaded();
    });
}
// Helper for Array check
function isArray(what) {
    return Object.prototype.toString.call(what) === '[object Array]';
}

function renderTable(resetPage = false) {
    const tableBody = document.getElementById('transactionsTableBody');
    // Get filter inputs
    const searchText = document.getElementById('searchDescription') ? document.getElementById('searchDescription').value.toLowerCase() : '';
    const filterType = document.getElementById('reportTypeSelector') ? document.getElementById('reportTypeSelector').value : 'all';

    if (resetPage) currentPage = 1;

    tableBody.innerHTML = '';

    // Apply Filters (Type + Search)
    let filteredData = transactionsData.filter(item => {
        // Filter 1: Type
        if (filterType !== 'all' && item.type !== filterType) {
            return false;
        }

        // Filter 2: Search Text
        if (searchText) {
            const searchStr = `${item.category || ''} ${item.description || ''} ${item.payer || ''} ${item.receiver || ''} ${item.recorder || ''}`.toLowerCase();
            if (!searchStr.includes(searchText)) return false;
        }

        return true;
    });

    // Update Counts (no change needed here)
    document.getElementById('displayCount').textContent = filteredData.length;
    document.getElementById('totalCount').textContent = transactionsData.length;

    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-5 text-muted">
                    <i class="fi fi-rr-inbox fa-3x mb-3 opacity-25"></i>
                    <p>មិនមានទិន្នន័យ (No Data Found)</p>
                </td>
            </tr>
        `;
        document.getElementById('paginationControls').innerHTML = ''; // Clear pagination
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    // Render Rows
    paginatedData.forEach((item, index) => {
        const trueIndex = startIndex + index;
        const row = document.createElement('tr');

        const typeBadge = item.type === 'income'
            ? '<span class="badge bg-success">ចំណូល</span>'
            : '<span class="badge bg-danger">ចំណាយ</span>';

        const amountClass = item.type === 'income' ? 'text-success' : 'text-danger';
        const amountPrefix = item.type === 'income' ? '+' : '-';

        // Format Amounts
        const usdAmount = `$${parseFloat(item.amount).toFixed(2)}`;
        const khrAmount = item.amountKH ? `៛${parseInt(item.amountKH).toLocaleString('en-US')}` : '';

        row.innerHTML = `
            <td class="text-center">${trueIndex + 1}</td>
            <td class="text-center fw-medium">${formatDate(item.date)}</td>
            <td class="text-center">${typeBadge}</td>
            <td>${item.category}</td>
            <td>${item.payer || '-'}</td>
            <td>${item.receiver || '-'}</td>
            <td><small>${item.description || '-'}</small></td>
            <td class="text-end fw-bold ${amountClass}">${amountPrefix}${usdAmount}</td>
            <td class="text-end fw-bold ${item.type === 'income' ? 'text-primary' : 'text-danger'}">${khrAmount}</td>
            <td class="text-center">
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editTransaction('${item.id}')"><i class="fi fi-rr-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction('${item.id}')"><i class="fi fi-rr-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    // Helper to create page item
    const createPageItem = (page, content, isActive = false, isDisabled = false) => {
        const li = document.createElement('li');
        li.className = `page-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;

        if (content === '...') {
            li.innerHTML = '<span class="page-link">...</span>';
            return li;
        }

        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = 'javascript:void(0)';
        a.innerHTML = content;

        if (!isDisabled && !isActive) {
            a.onclick = (e) => {
                e.preventDefault();
                changePage(page);
            };
        }

        li.appendChild(a);
        return li;
    };

    // Previous Button
    paginationContainer.appendChild(createPageItem(currentPage - 1, '<i class="fi fi-rr-angle-small-left"></i>', false, currentPage === 1));

    let range = 1;
    let startPage = Math.max(1, currentPage - range);
    let endPage = Math.min(totalPages, currentPage + range);

    if (startPage > 1) {
        paginationContainer.appendChild(createPageItem(1, '1'));
        if (startPage > 2) {
            paginationContainer.appendChild(createPageItem(null, '...'));
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationContainer.appendChild(createPageItem(i, i, i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationContainer.appendChild(createPageItem(null, '...'));
        }
        paginationContainer.appendChild(createPageItem(totalPages, totalPages));
    }

    // Next Button
    paginationContainer.appendChild(createPageItem(currentPage + 1, '<i class="fi fi-rr-angle-small-right"></i>', false, currentPage === totalPages));
}

function changePage(page) {
    if (page < 1) return;
    currentPage = page;
    renderTable(false); // Do not reset page, use the new one
}

// ==========================================
// EVENT HANDLERS
// ==========================================

function setupEventListeners() {
    // Modal Form Submit
    document.getElementById('transactionForm').addEventListener('submit', handleFormSubmit);

    // Type Toggle in Modal (Switch Categories)
    const typeRadios = document.getElementsByName('transType');
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleCategoryOptions(e.target.value);
        });
    });

    // Filter Button
    const btnFilter = document.getElementById('btnFilter');
    if (btnFilter) {
        btnFilter.addEventListener('click', renderTable);
    }

    // Search Input (Real-time filtering)
    const searchInput = document.getElementById('searchDescription');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderTable(true));
    }

    // Reset Modal on Open (if adding new)
    const modal = document.getElementById('transactionModal');
    modal.addEventListener('show.bs.modal', (event) => {
        // If relatedTarget is null/undefined, it might be an edit call triggered manually,
        // but usually the button triggers it.
        if (event.relatedTarget && event.relatedTarget.getAttribute('data-bs-target') === '#transactionModal') {
            // Reset Form
            document.getElementById('transactionForm').reset();
            document.getElementById('editTransactionId').value = '';
            document.getElementById('modalTitle').innerHTML = '<i class="fi fi-rr-plus-circle me-2"></i>បញ្ចូលចំណូល/ចំណាយថ្មី';

            // Reset Type to Income
            document.getElementById('typeIncome').checked = true;
            toggleCategoryOptions('income');

            // Set Date to Today
            const fp = document.getElementById('transDate')._flatpickr;
            if (fp) {
                fp.setDate(new Date());
            }


            // Auto-fill Receiver with current user
            // Auto-fill Receiver with current user
            if (currentUserName) {
                document.getElementById('transReceiver').value = currentUserName;
            } else if (firebase.auth().currentUser) {
                document.getElementById('transReceiver').value = firebase.auth().currentUser.email.split('@')[0];
            }
        }
    });
}

function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('editTransactionId').value;
    const type = document.querySelector('input[name="transType"]:checked').value;
    const date = document.getElementById('transDate').value;
    const amount = parseFloat(document.getElementById('transAmount').value) || 0;
    const amountKH = parseFloat(document.getElementById('transAmountKH').value) || 0;

    if (amount <= 0 && amountKH <= 0) {
        alert("សូមបញ្ចូលចំនួនទឹកប្រាក់ (USD ឬ KHR) (Please enter amount)");
        return;
    }

    // New Fields
    const payer = document.getElementById('transPayer').value;
    const receiver = document.getElementById('transReceiver').value || currentUserName || 'System/Admin';

    // Category/Description Logic
    let category = '';
    if (type === 'income') {
        category = document.getElementById('transIncomeSource').value.trim();
        if (!category) {
            alert("សូមបញ្ចូលប្រភពចំណូល (Please enter income source)");
            return;
        }
    } else {
        category = document.getElementById('transExpenseCategory').value;
        if (!category) {
            alert("សូមជ្រើសរើសប្រភេទចំណាយ (Please select expense category)");
            return;
        }
    }

    const description = document.getElementById('transDescription').value;

    const transactionData = {
        type,
        date,
        amount,
        amountKH,
        category,

        description,
        payer,
        receiver,
        recorder: currentUserName || 'System/Admin',
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    showLoading(true);

    if (id) {
        // Update
        transactionsRef.child(id).update(transactionData)
            .then(() => {
                closeModal();
                showLoading(false);
                // alert("កែប្រែបានជោគជ័យ (Updated successfully)");
            })
            .catch(err => {
                console.error(err);
                showLoading(false);
                alert("កំហុសក្នុងការកែប្រែ (Error updating)");
            });
    } else {
        // Create
        transactionData.createdAt = firebase.database.ServerValue.TIMESTAMP;
        transactionsRef.push(transactionData)
            .then(() => {
                closeModal();
                showLoading(false);
                // alert("រក្សាទុកបានជោគជ័យ (Saved successfully)");
            })
            .catch(err => {
                console.error(err);
                showLoading(false);
                alert("កំហុសក្នុងការរក្សាទុក (Error saving)");
            });
    }
}

function editTransaction(id) {
    const item = transactionsData.find(t => t.id === id);
    if (!item) return;

    // Set Values
    document.getElementById('editTransactionId').value = id;

    // Set Date using Flatpickr
    const fp = document.getElementById('transDate')._flatpickr;
    if (fp) {
        fp.setDate(item.date);
    } else {
        document.getElementById('transDate').value = item.date;
    }

    document.getElementById('transAmount').value = item.amount;
    document.getElementById('transAmountKH').value = item.amountKH || 0;
    document.getElementById('transDescription').value = item.description || '';

    // Set Payer and Receiver Fields
    document.getElementById('transPayer').value = item.payer || '';
    document.getElementById('transReceiver').value = item.receiver || '';

    // Set Type
    if (item.type === 'income') {
        document.getElementById('typeIncome').checked = true;
    } else {
        document.getElementById('typeExpense').checked = true;
    }
    toggleCategoryOptions(item.type);

    // Set Category (after toggling options)
    if (item.type === 'income') {
        document.getElementById('transIncomeSource').value = item.category || '';
    } else {
        document.getElementById('transExpenseCategory').value = item.category || '';
    }

    // Update Title
    document.getElementById('modalTitle').innerHTML = '<i class="fi fi-rr-edit me-2"></i>កែប្រែទិន្នន័យ (Edit)';

    // Open Modal
    const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
    modal.show();
}

function deleteTransaction(id) {
    if (!confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ? (Are you sure?)")) return;

    showLoading(true);

    // Check if it is a system-linked ID
    if (id.startsWith('reg_')) {
        // Registration Payment: reg_{key}
        const studentKey = id.replace('reg_', '');
        studentsRef.child(studentKey).update({ initialPayment: 0 })
            .then(() => {
                showLoading(false);
                alert("លុបការបង់ប្រាក់ចុះឈ្មោះជោគជ័យ (Registration payment cleared)");
            })
            .catch(err => {
                console.error(err);
                showLoading(false);
                alert("កំហុសក្នុងការលុប (Error deleting)");
            });

    } else if (id.startsWith('inst_')) {
        // Installment
        const parts = id.split('_');
        const idx = parseInt(parts.pop());
        parts.shift(); // remove 'inst'
        const studentKey = parts.join('_');

        studentsRef.child(studentKey).child('installments').once('value')
            .then(snapshot => {
                let installs = snapshot.val();
                if (!installs) {
                    showLoading(false);
                    return;
                }
                let instArray = isArray(installs) ? installs : Object.values(installs);

                if (idx >= 0 && idx < instArray.length) {
                    instArray.splice(idx, 1);
                    return studentsRef.child(studentKey).update({ installments: instArray });
                }
            })
            .then(() => {
                showLoading(false);
                alert("លុបប្រវត្តិបង់រំលស់ជោគជ័យ (Installment deleted)");
            })
            .catch(err => {
                console.error(err);
                showLoading(false);
                alert("កំហុសក្នុងការលុប (Error deleting)");
            });

    } else if (id.startsWith('sale_')) {
        alert("មិនអាចលុបការលក់ពីទីនេះបានទេ សូមទៅកាន់ស្តុក (Cannot delete sales from here, please use Inventory)");
        showLoading(false);
    } else {
        transactionsRef.child(id).remove()
            .then(() => {
                showLoading(false);
            })
            .catch(err => {
                console.error(err);
                showLoading(false);
                alert("កំហុសក្នុងការលុប (Error deleting)");
            });
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function toggleCategoryOptions(type) {
    const incomeContainer = document.getElementById('incomeSourceRow');
    const expenseContainer = document.getElementById('expenseCategoryRow');

    if (type === 'income') {
        incomeContainer.classList.remove('d-none');
        expenseContainer.classList.add('d-none');

        document.getElementById('transIncomeSource').setAttribute('required', 'required');
        document.getElementById('transExpenseCategory').removeAttribute('required');
    } else {
        incomeContainer.classList.add('d-none');
        expenseContainer.classList.remove('d-none');

        document.getElementById('transIncomeSource').removeAttribute('required');
        document.getElementById('transExpenseCategory').setAttribute('required', 'required');
    }
}

const khmerMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

function formatDate(dateString) {
    if (!dateString) return '';

    const khmerNumerals = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    const toKhmerNum = (num) => num.toString().split('').map(char => {
        const n = parseInt(char);
        return isNaN(n) ? char : khmerNumerals[n];
    }).join('');
    const khmerMonthsList = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

    let d;
    if (typeof dateString === 'string') {
        const parts = dateString.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                d = new Date(parts[2], parts[1] - 1, parts[0]);
            } else if (parts[0].length === 4) {
                d = new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
                d = new Date(dateString);
            }
        } else {
            d = new Date(dateString);
        }
    } else {
        d = new Date(dateString);
    }

    if (isNaN(d.getTime())) return dateString;

    const day = toKhmerNum(String(d.getDate()).padStart(2, '0'));
    const month = khmerMonthsList[d.getMonth()];
    const year = toKhmerNum(d.getFullYear());

    return `${day}-${month}-${year}`;
}

function showLoading(show) {
    const loader = document.getElementById('global-loader');
    if (!loader) return;

    if (show) {
        loader.style.display = 'flex';
        void loader.offsetWidth;
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
        setTimeout(() => {
            if (loader.classList.contains('hidden')) {
                loader.style.display = 'none';
            }
        }, 500);
    }
}

function closeModal() {
    // Remove focus from any focused element inside modal to prevent aria-hidden warning
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    const modalEl = document.getElementById('transactionModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
}

function updateStatValue(id, value, isCurrency = true) {
    const el = document.getElementById(id);
    if (!el) return;

    if (isCurrency) {
        el.textContent = '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        el.textContent = value.toLocaleString('en-US'); // Display as integer/number
    }

    if (id === 'netBalanceDisplay') {
        if (value >= 0) {
            el.className = 'fw-bold text-primary mb-0';
        } else {
            el.className = 'fw-bold text-danger mb-0';
        }
    }
}
// Helper to get payment status (Copied/Adapted from data-tracking-script.js for consistency)
// Helper to get payment status
function getPaymentStatus(student) {
    if (!student) return { text: 'N/A', badge: 'status-pending', status: 'pending', daysRemaining: 0 };

    const pm = parseInt(student.paymentMonths) || 0;
    if (pm === 48) {
        return { text: '✅ បង់ដាច់ 100%', badge: 'status-paid', status: 'paid', daysRemaining: 0 };
    }

    let daysDiff = 0;
    const nextPaymentDateStr = student.nextPaymentDate;

    // Check Date
    if (nextPaymentDateStr && !['មិនមាន', 'N/A', '', null].includes(nextPaymentDateStr)) {
        let dueDateFull = null;

        // Try parsing standard formats
        if (nextPaymentDateStr.includes('T')) {
            dueDateFull = new Date(nextPaymentDateStr);
        } else if (nextPaymentDateStr.includes('-')) {
            // Handle 2024-05-15 or 15-May-2024
            const parts = nextPaymentDateStr.split('-');
            if (parts[0].length === 4) { // YYYY-MM-DD
                dueDateFull = new Date(nextPaymentDateStr);
            } else {
                // DD-Month-YYYY or DD-MM-YYYY
                dueDateFull = new Date(nextPaymentDateStr);
            }
        } else {
            dueDateFull = new Date(nextPaymentDateStr);
        }

        if (!isNaN(dueDateFull.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(dueDateFull.getFullYear(), dueDateFull.getMonth(), dueDateFull.getDate());
            daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            if (daysDiff < 0) {
                return { text: `❌ ហួសកំណត់ (${Math.abs(daysDiff)} ថ្ងៃ)`, badge: 'status-overdue', status: 'overdue', daysRemaining: daysDiff };
            }
            if (daysDiff === 0) {
                return { text: '📅 ត្រូវបង់ថ្ងៃនេះ', badge: 'status-today', status: 'today', daysRemaining: 0 };
            }
            if (daysDiff > 0 && daysDiff <= 10) { // 10 days warning
                return { text: `⏳ ជិតដល់ថ្ងៃ (${daysDiff} ថ្ងៃ)`, badge: 'status-warning', status: 'warning', daysRemaining: daysDiff };
            }
        }
    }

    // Financial check
    const totalPaid = (parseFloat(student.initialPayment) || 0) + (student.installments ? Object.values(student.installments).reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0) : 0);
    const totalFee = (parseFloat(student.tuitionFee) || 0) + (parseFloat(student.materialFee) || 0) + (parseFloat(student.adminFee) || 0) - (parseFloat(student.discount) || 0);
    const remaining = Math.max(0, totalFee - totalPaid);

    if (remaining <= 0) return { text: '✅ បង់រួច', badge: 'status-paid', status: 'paid', daysRemaining: 0 };

    if (daysDiff < 0) { // Fallback overdue
        return { text: `❌ ហួសកំណត់ (${Math.abs(daysDiff)} ថ្ងៃ)`, badge: 'status-overdue', status: 'overdue', daysRemaining: daysDiff };
    }

    return { text: '❌ មិនទាន់បង់', badge: 'status-pending', status: 'pending', daysRemaining: daysDiff };
}

// Global Date Formatter for Khmer
function formatDateToKhmer(dateStr) {
    if (!dateStr || ['N/A', '', 'មិនមាន', 'null'].includes(dateStr)) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        const khmerMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
        const day = String(d.getDate()).padStart(2, '0');
        const month = khmerMonths[d.getMonth()];
        const year = d.getFullYear();

        // Requested format: ddd.mmm.yyy (interpreted as standard Khmer DD-Month-YYYY)
        return `${day}-${month}-${year}`;
    } catch (e) { return dateStr; }
}

function viewStatusDetails(targetStatus) {
    const reportData = {
        overdue: [],
        today: [],
        soon: [],
        postponed: [],
        unpaid: []
    };

    Object.values(allStudentsData).forEach(s => {
        if (s.enrollmentStatus === 'dropout') return;
        const ps = getPaymentStatus(s);
        if (ps.status === 'overdue') reportData.overdue.push(s);
        else if (ps.status === 'today') reportData.today.push(s);
        else if (ps.status === 'warning') reportData.soon.push(s);
        else if (ps.status === 'installment') reportData.postponed.push(s);
        else if (ps.status === 'pending') reportData.unpaid.push(s);
    });

    const students = reportData[targetStatus] || [];
    if (students.length === 0) {
        Swal.fire('មិនមានទិន្នន័យ', 'មិនមានសិស្សក្នុងចំណាត់ថ្នាក់នេះទេ', 'info');
        return;
    }

    const titles = {
        overdue: 'សិស្សហួសកំណត់បង់ប្រាក់',
        today: 'សិស្សត្រូវបង់ប្រាក់ថ្ងៃនេះ',
        soon: 'សិស្សជិតដល់ថ្ងៃបង់ប្រាក់',
        postponed: 'សិស្សពន្យាការបង់ (បង់រំលស់)',
        unpaid: 'សិស្សជំពាក់'
    };

    const html = `
        <div class="table-responsive shadow-sm" style="max-height: 500px; border-radius: 12px; border: 1px solid #eee;">
            <table class="table table-hover align-middle mb-0" style="font-size: 0.85rem;">
                <thead class="sticky-top bg-white border-bottom shadow-sm">
                    <tr>
                        <th class="py-3 text-center" style="width: 80px;">ID</th>
                        <th class="py-3">ឈ្មោះសិស្ស (Student Name)</th>
                        <th class="py-3 text-center">ថ្ងៃត្រូវបង់ (Due Date)</th>
                        <th class="py-3 text-center">ស្ថានភាព (Status)</th>
                        <th class="py-3 text-end">បំណុល (Debt)</th>
                        <th class="py-3 text-center">សកម្មភាព</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => {
        const ps = getPaymentStatus(s);
        let daysBadge = '';
        if (ps.status === 'overdue') {
            daysBadge = `<span class="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3">ហួស ${Math.abs(ps.daysRemaining)} ថ្ងៃ</span>`;
        } else if (ps.status === 'warning') {
            daysBadge = `<span class="badge rounded-pill bg-warning bg-opacity-10 text-dark border border-warning px-3">នៅសល់ ${ps.daysRemaining} ថ្ងៃ</span>`;
        } else if (ps.status === 'today') {
            daysBadge = `<span class="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary px-3">ត្រូវបង់ថ្ងៃនេះ</span>`;
        } else if (ps.status === 'installment') {
            daysBadge = `<span class="badge rounded-pill bg-info bg-opacity-10 text-info border border-info px-3">កំពុងបង់រំលស់</span>`;
        } else {
            daysBadge = `<span class="badge rounded-pill bg-secondary bg-opacity-10 text-secondary border border-secondary px-3">មិនទាន់បង់</span>`;
        }

        return `
                        <tr>
                            <td class="text-center"><span class="st-id">${s.displayId}</span></td>
                            <td>
                                <div class="fw-bold text-dark">${s.lastName} ${s.firstName}</div>
                                <div class="text-muted small">${s.studyLevel || '-'} | ${s.studyTime || '-'}</div>
                            </td>
                            <td class="text-center fw-medium">${toKhmerDate(s.nextPaymentDate || s.dueDate)}</td>
                            <td class="text-center">${daysBadge}</td>
                            <td class="text-end fw-bold text-danger">$${calculateRemainingAmount(s).toFixed(2)}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-pink rounded-pill px-3 shadow-sm" onclick="Swal.close(); openStudentPaymentModal('${s.key}');">
                                    <i class="fi fi-rr-hand-holding-usd me-1"></i> បង់ប្រាក់
                                </button>
                            </td>
                        </tr>`;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    Swal.fire({
        title: titles[targetStatus],
        html: html,
        width: '800px',
        showConfirmButton: false,
        showCloseButton: true,
        background: '#fff',
        customClass: {
            container: 'status-detail-modal'
        }
    });
}

function generateStudentStatusReport(selectedCategory = 'all') {
    // 1. Categorize Students
    const reportData = {
        overdue: [],
        today: [],
        soon: [],
        postponed: [],
        unpaid: []
    };

    Object.values(allStudentsData).forEach(s => {
        if (s.enrollmentStatus === 'dropout') return;

        const paymentStatus = getPaymentStatus(s);

        if (paymentStatus.status === 'overdue') reportData.overdue.push(s);
        else if (paymentStatus.status === 'today') reportData.today.push(s);
        else if (paymentStatus.status === 'warning') reportData.soon.push(s);
        else if (paymentStatus.status === 'installment') reportData.postponed.push(s);
        else if (paymentStatus.status === 'pending') reportData.unpaid.push(s);
    });

    const todayKhmer = formatDateToKhmer(new Date());

    // Calculate total debt for entire report
    const calculateDebt = (s) => {
        try {
            const initial = parseFloat(s.initialPayment) || 0;
            const extra = parseFloat(s.extraPayment) || 0;
            const installments = s.installments ? (Array.isArray(s.installments) ? s.installments : Object.values(s.installments)) : [];
            const installmentsTotal = installments.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

            const totalPaid = initial + extra + installmentsTotal;

            const tuition = parseFloat(s.tuitionFee) || 0;
            const material = parseFloat(s.materialFee) || 0;
            const admin = parseFloat(s.adminFee) || 0;
            const discount = parseFloat(s.discountAmount) || 0;

            const totalFee = (tuition + material + admin) - discount;
            return Math.max(0, totalFee - totalPaid);
        } catch (e) { return 0; }
    };

    // 2. Build HTML
    let html = `
    <!DOCTYPE html>
    <html lang="km">
    <head>
        <meta charset="UTF-8">
        <title>របាយការណ៍ស្ថានភាពការបង់ប្រាក់សិស្ស - ITK SCHOOL</title>
        <style>
             @font-face { font-family: 'Kantumruy-Light'; src: url('fonts/Kantumruy-Light.ttf') format('truetype'); }
             body { font-family: 'Kantumruy-Light', sans-serif; padding: 40px; color: #1a1a1a; background: #fff; line-height: 1.5; }
             
             /* Modern Header */
             .report-header {
                 display: flex;
                 justify-content: space-between;
                 align-items: center;
                 border-bottom: 2px solid #edeff2;
                 padding-bottom: 25px;
                 margin-bottom: 35px;
             }
             .school-brand { display: flex; align-items: center; gap: 20px; }
             .logo-img { width: 90px; height: 90px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
             .school-names h1 { font-size: 26px; margin: 0; color: #1f0637; letter-spacing: 0.5px; }
             .school-names h2 { font-size: 18px; margin: 2px 0; color: #666; font-weight: 500; font-family: Arial, sans-serif; }
             
             .report-meta { text-align: right; }
             .report-meta h3 { font-size: 20px; color: #1f0637; margin: 0 0 10px 0; text-transform: uppercase; }
             .meta-item { color: #666; font-size: 14px; margin: 2px 0; }
             .meta-item b { color: #1f0637; }

             /* Premium Summary Dashboard */
             .dashboard { display: grid; grid-template-columns: repeat(${selectedCategory === 'all' ? 5 : 1}, 1fr); gap: 15px; margin-bottom: 40px; }
             .dash-card { 
                 padding: 15px 10px; 
                 border-radius: 12px; 
                 color: white; 
                 position: relative;
                 overflow: hidden;
                 display: flex;
                 flex-direction: column;
                 justify-content: center;
                 box-shadow: 0 4px 8px rgba(0,0,0,0.05);
                 text-align: center;
             }
             .dash-card::after {
                 content: ''; position: absolute; right: -20px; top: -20px; 
                 width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.15);
             }
             .dash-card h4 { margin: 0; font-size: 11px; text-transform: uppercase; opacity: 0.9; font-weight: normal; }
             .dash-card h2 { margin: 5px 0 0 0; font-size: 24px; font-weight: 800; }
             
             .bg-overdue { background: linear-gradient(135deg, #e74c3c, #c0392b); }
             .bg-today { background: linear-gradient(135deg, #27ae60, #2ecc71); }
             .bg-soon { background: linear-gradient(135deg, #f39c12, #f1c40f); }
             .bg-postponed { background: linear-gradient(135deg, #3498db, #2980b9); }
             .bg-unpaid { background: linear-gradient(135deg, #7f8c8d, #95a5a6); }

             /* Grouped Sections */
             .status-section { margin-bottom: 50px; border-radius: 12px; overflow: hidden; border: 1px solid #edeff2; }
             .section-header { 
                 padding: 15px 25px; 
                 font-weight: bold; 
                 font-size: 17px; 
                 display: flex; 
                 justify-content: space-between;
                 align-items: center;
             }
             .section-header span { font-size: 14px; opacity: 0.8; font-weight: normal; }
             
             .header-overdue { background-color: #fcecea; color: #c0392b; border-bottom: 2px solid #e74c3c; }
             .header-today { background-color: #e8f5ed; color: #27ae60; border-bottom: 2px solid #2ecc71; }
             .header-soon { background-color: #fef5e6; color: #d35400; border-bottom: 2px solid #f39c12; }
             .header-postponed { background-color: #eaf2f8; color: #2980b9; border-bottom: 2px solid #3498db; }
             .header-unpaid { background-color: #f4f6f6; color: #515a5a; border-bottom: 2px solid #7f8c8d; }

             /* Refined Table */
             table { width: 100%; border-collapse: collapse; background: #fff; }
             th { text-align: left; padding: 14px 20px; font-size: 13px; background-color: #fafbfc; color: #5c6873; border-bottom: 1px solid #edeff2; }
             td { padding: 12px 20px; font-size: 13px; border-bottom: 1px solid #f2f4f7; vertical-align: middle; }
             tr:last-child td { border-bottom: none; }
             .st-id { font-family: monospace; font-weight: bold; color: #1f0637; background: #f0f2f5; padding: 2px 6px; border-radius: 4px; }
             .st-name { font-weight: 600; color: #1a1a1a; }
             .st-debt { font-weight: 800; color: #c0392b; }
             .st-teacher { font-size: 12px; color: #666; }

             /* Signature Area */
             .signature-container { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 40px; }
             .sign-box { text-align: center; width: 250px; }
             .sign-box p { margin: 5px 0; font-size: 14px; }
             .sign-line { margin-top: 60px; border-top: 1px solid #333; width: 100%; }

             @media print {
                 body { padding: 0; }
                 .dashboard { gap: 10px; margin-bottom: 25px; }
                 .dash-card { box-shadow: none; border: 1px solid #ddd; color: #000 !important; background: none !important; }
                 .dash-card::after { display: none; }
                 .dash-card h2, .dash-card h4 { color: #000 !important; }
                 thead { display: table-header-group; }
                 .status-section { break-inside: avoid; border: 1px solid #ddd; }
                 .section-header { background: #f8f9fa !important; border: 1px solid #ddd !important; -webkit-print-color-adjust: exact; }
             }
        </style>
    </head>
    <body>
        <div class="report-header">
             <div class="school-brand">
                 <img src="img/1.jpg" class="logo-img" alt="Logo">
                 <div class="school-names">
                     <h1>សាលារៀន អាយ ធី ឃេ</h1>
                     <h2>ITK INTERNATIONAL SCHOOL</h2>
                 </div>
             </div>
             <div class="report-meta">
                 <h3>របាយការណ៍បង់ប្រាក់សិស្ស</h3>
                 <p class="meta-item">កាលបរិច្ឆេទ៖ <b>${todayKhmer}</b></p>
                 <p class="meta-item">ភូមិត្រពាំងព្រីងខាងត្បូង, កំពត</p>
             </div>
        </div>

        <div class="dashboard">
             ${(selectedCategory === 'all' || selectedCategory === 'overdue') ? `<div class="dash-card bg-overdue"><h4>ហួសកំណត់ (Overdue)</h4><h2>${reportData.overdue.length} <small style="font-size:12px">នាក់</small></h2></div>` : ''}
             ${(selectedCategory === 'all' || selectedCategory === 'today') ? `<div class="dash-card bg-today"><h4>បង់ថ្ងៃនេះ (Today)</h4><h2>${reportData.today.length} <small style="font-size:12px">នាក់</small></h2></div>` : ''}
             ${(selectedCategory === 'all' || selectedCategory === 'soon') ? `<div class="dash-card bg-soon"><h4>ជិតដល់ថ្ងៃ (Soon)</h4><h2>${reportData.soon.length} <small style="font-size:12px">នាក់</small></h2></div>` : ''}
             ${(selectedCategory === 'all' || selectedCategory === 'postponed') ? `<div class="dash-card bg-postponed"><h4>ពន្យាការបង់</h4><h2>${reportData.postponed.length} <small style="font-size:12px">នាក់</small></h2></div>` : ''}
             ${(selectedCategory === 'all' || selectedCategory === 'unpaid') ? `<div class="dash-card bg-unpaid"><h4>សរុបជំពាក់</h4><h2>${reportData.unpaid.length} <small style="font-size:12px">នាក់</small></h2></div>` : ''}
        </div>
    `;

    const statusConfigs = [
        { key: 'overdue', label: 'បញ្ជីសិស្សហួសកំណត់បង់ប្រាក់', sub: 'Overdue Payments', headerClass: 'header-overdue' },
        { key: 'today', label: 'បញ្ជីសិស្សត្រូវបង់ប្រាក់នៅថ្ងៃនេះ', sub: 'Due Today', headerClass: 'header-today' },
        { key: 'soon', label: 'បញ្ជីសិស្សជិតដល់ថ្ងៃបង់ប្រាក់', sub: 'Coming Due (5-10 days)', headerClass: 'header-soon' },
        { key: 'postponed', label: 'បញ្ជីសិស្សពន្យាការបង់ប្រាក់ (បង់រំលស់)', sub: 'Postponed / Installments', headerClass: 'header-postponed' },
        { key: 'unpaid', label: 'បញ្ជីសិស្សជំពាក់មិនទាន់មានកាលកំណត់', sub: 'Other Debt / Pending', headerClass: 'header-unpaid' }
    ];

    const configsToRender = selectedCategory === 'all'
        ? statusConfigs
        : statusConfigs.filter(cfg => cfg.key === selectedCategory);

    configsToRender.forEach(cfg => {
        const students = reportData[cfg.key];
        if (students.length === 0) return;

        html += `
        <div class="status-section">
            <div class="section-header ${cfg.headerClass}">
                <div>${cfg.label}</div>
                <span>${cfg.sub} • ${students.length} នាក់</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="35">#</th>
                        <th width="80">ID</th>
                        <th width="200">ឈ្មោះសិស្ស</th>
                        <th width="50">ភេទ</th>
                        <th width="150">ព័ត៌មានសិក្សា (ថ្នាក់/ម៉ោង)</th>
                        <th width="120" style="text-align:center">ថ្ងៃត្រូវបង់</th>
                        <th width="100" style="text-align:center">ស្ថានភាព</th>
                        <th width="100" style="text-align:right">បំណុល ($)</th>
                    </tr>
                </thead>
                <tbody>`;

        students.forEach((s, idx) => {
            const name = `<div class="st-name">${s.lastName || ''} ${s.firstName || ''}</div>
                          <div style="font-size:11px; color:#777">${s.englishLastName || ''} ${s.englishFirstName || ''}</div>`;
            const gender = (s.gender === 'Male' || s.gender === 'ប្រុស') ? 'ប្រុស' : 'ស្រី';
            const ps = getPaymentStatus(s);
            const dateStr = formatDateToKhmer(s.nextPaymentDate || s.dueDate);
            const classInfo = `${s.studyLevel || '-'}<br><small>${s.studyTime || '-'}</small>`;
            const debt = calculateDebt(s);

            let statusText = '-';
            let statusColor = '#333';
            if (ps.status === 'overdue') {
                statusText = `ហួស ${Math.abs(ps.daysRemaining)} ថ្ងៃ`;
                statusColor = '#c0392b';
            } else if (ps.status === 'warning') {
                statusText = `នៅសល់ ${ps.daysRemaining} ថ្ងៃ`;
                statusColor = '#d35400';
            } else if (ps.status === 'today') {
                statusText = `ថ្ងៃនេះ`;
                statusColor = '#27ae60';
            }

            html += `
            <tr>
                <td style="text-align:center">${idx + 1}</td>
                <td><span class="st-id">${s.displayId || 'N/A'}</span></td>
                <td>${name}</td>
                <td style="text-align:center">${gender}</td>
                <td>${classInfo}</td>
                <td style="text-align:center; font-weight:bold">${dateStr}</td>
                <td style="text-align:center; color:${statusColor}; font-weight:bold;">${statusText}</td>
                <td style="text-align:right" class="st-debt">$${debt.toFixed(2)}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    });

    html += `
        <div class="signature-container">
            <div class="sign-box">
                <p>រៀបចំដោយ</p>
                <div class="sign-line"></div>
                <p>បេឡាករ / ជំនួយការ</p>
            </div>
            <div class="sign-box">
                <p>ថ្ងៃទី........ ខែ........ ឆ្នាំ២០២...</p>
                <p>ពិនិត្យ និងសម្រេចដោយ</p>
                <div class="sign-line"></div>
                <p>នាយកសាលា / ប្រធានផ្នែក</p>
            </div>
        </div>
    </body></html>`;

    if (typeof showReportPreview === 'function') {
        showReportPreview(html, 'របាយការណ៍ស្ថានភាពការបង់ប្រាក់សិស្ស');
    } else {
        alert("Report preview function not available!");
    }
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

function getFilteredExportData() {
    const searchText = document.getElementById('searchDescription') ? document.getElementById('searchDescription').value.toLowerCase() : '';
    const reportTypeSelector = document.getElementById('reportTypeSelector');
    const typeFilter = reportTypeSelector ? reportTypeSelector.value : 'all';

    return transactionsData.filter(item => {
        // Search Filter
        if (searchText) {
            const searchStr = `${item.category} ${item.description} ${item.payer} ${item.receiver} ${item.recorder}`.toLowerCase();
            if (!searchStr.includes(searchText)) return false;
        }
        // Type Filter (Income/Expense)
        if (typeFilter !== 'all') {
            if (item.type !== typeFilter) return false;
        }
        return true;
    });
}

function exportToExcel() {
    const dataToExport = getFilteredExportData();
    if (dataToExport.length === 0) {
        alert("មិនមានទិន្នន័យដើម្បីនាំចេញ (No data to export)");
        return;
    }

    // Format data for Excel
    const excelData = dataToExport.map((item, index) => ({
        "ល.រ (No.)": index + 1,
        "កាលបរិច្ឆេទ (Date)": formatDate(item.date),
        "ប្រភេទ (Type)": item.type === 'income' ? 'ចំណូល' : 'ចំណាយ',
        "ប្រភព/ចំណាយ (Category)": item.category,
        "អ្នកចំណាយ (Payer)": item.payer || '-',
        "អ្នកទទួល (Receiver)": item.receiver || '-',
        "ការបរិយាយ (Description)": item.description || '-',
        "ទឹកប្រាក់ (Amount $)": parseFloat(item.amount).toFixed(2),
        "ទឹកប្រាក់ (Amount ៛)": item.amountKH || 0
    }));

    // Create WorkSheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Income & Expense");

    // Download File
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Income_Expense_Report_${timestamp}.xlsx`);
}

function exportReport(type, startDate, endDate) {
    // Determine Report Type (All, Income, Expense)
    const reportTypeSelector = document.getElementById('reportTypeSelector');
    const reportType = reportTypeSelector ? reportTypeSelector.value : 'all';

    let titleRaw = "របាយការណ៍";
    let title = "";
    let filteredData = [];
    let periodText = "";

    // Determine Base Title based on Type
    if (reportType === 'income') titleRaw = "របាយការណ៍ចំណូល (Income Report)";
    else if (reportType === 'expense') titleRaw = "របាយការណ៍ចំណាយ (Expense Report)";
    else titleRaw = "របាយការណ៍ចំណូលចំណាយ (Income & Expense Report)";

    if (type === 'daily') {
        const today = new Date().toISOString().split('T')[0];
        title = `${titleRaw} ប្រចាំថ្ងៃ (Daily)`;
        periodText = `ប្រចាំថ្ងៃទី: ${formatDate(today)} `;
        filteredData = transactionsData.filter(item => item.date === today);
    } else if (type === 'monthly') {
        const currentYear = new Date().getFullYear();
        const promptMonth = prompt("សូមបញ្ចូលខែ (1-12) សម្រាប់របាយការណ៍:", new Date().getMonth() + 1);
        if (!promptMonth) return;

        const month = parseInt(promptMonth);
        if (isNaN(month) || month < 1 || month > 12) {
            alert("ខែមិនត្រឹមត្រូវ (Invalid Month)");
            return;
        }

        const promptYear = prompt("សូមបញ្ចូលឆ្នាំ:", currentYear);
        const year = parseInt(promptYear) || currentYear;

        const khmerMonthName = (khmerMonths && khmerMonths[month - 1]) ? khmerMonths[month - 1] : month;
        title = `${titleRaw} ប្រចាំខែ ${khmerMonthName} ឆ្នាំ ${year}`;
        periodText = `ប្រចាំខែ: ${khmerMonthName} ឆ្នាំ ${year}`;

        filteredData = transactionsData.filter(item => {
            const d = new Date(item.date);
            return (d.getMonth() + 1) === month && d.getFullYear() === year;
        });
    } else if (type === 'yearly') {
        const currentYear = new Date().getFullYear();
        const promptYear = prompt("សូមបញ្ចូលឆ្នាំ (Year):", currentYear);
        if (!promptYear) return;
        const year = parseInt(promptYear);
        if (isNaN(year)) {
            alert("ឆ្នាំមិនត្រឹមត្រូវ (Invalid Year)");
            return;
        }

        title = `${titleRaw} ប្រចាំឆ្នាំ ${year}`;
        periodText = `ប្រចាំឆ្នាំ: ${year}`;

        filteredData = transactionsData.filter(item => {
            const d = new Date(item.date);
            return d.getFullYear() === year;
        });
    } else if (type === 'current') {
        title = `${titleRaw} (Filtered View)`;
        periodText = "តាមការស្វែងរកបច្ចុប្បន្ន";
        filteredData = getFilteredExportData();
    } else if (type === 'range') {
        title = `${titleRaw} (ចន្លោះថ្ងៃ)`;
        periodText = `ចាប់ពីថ្ងៃទី: ${formatDate(startDate)} ដល់ថ្ងៃទី: ${formatDate(endDate)}`;
        filteredData = transactionsData.filter(item => {
            return item.date >= startDate && item.date <= endDate;
        });
    } else if (type === 'amount') {
        const min = parseFloat(startDate) || 0;
        const max = parseFloat(endDate) || 999999;
        title = `${titleRaw} (ចន្លោះទឹកប្រាក់)`;
        periodText = `ចន្លោះទឹកប្រាក់ចាប់ពី: $${min.toLocaleString()} ដល់ $${max.toLocaleString()}`;
        filteredData = transactionsData.filter(item => {
            const amt = parseFloat(item.amount) || 0;
            return amt >= min && amt <= max;
        });
    }

    // Secondary filtering by type (if not already handled in 'current')
    if (type !== 'current') {
        if (reportType === 'income') {
            filteredData = filteredData.filter(item => item.type === 'income');
        } else if (reportType === 'expense') {
            filteredData = filteredData.filter(item => item.type === 'expense');
        }
    }

    if (filteredData.length === 0) {
        alert("គ្មានទិន្នន័យសម្រាប់ period នេះទេ (No data found)");
        return;
    }

    // Sort by date/time
    filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Separate Data for Sectioning
    const incomeData = filteredData.filter(item => item.type === 'income');
    const expenseData = filteredData.filter(item => item.type === 'expense');

    let totalIncome = 0;
    let totalExpense = 0;

    const generateTableRows = (data, startIdx = 0) => {
        return data.map((item, index) => {
            const amt = parseFloat(item.amount);
            if (item.type === 'income') totalIncome += amt;
            else totalExpense += amt;

            const typeColor = item.type === 'income' ? 'text-success' : 'text-danger';
            const amountPrefix = item.type === 'income' ? '+' : '-';

            return `
                <tr>
                    <td class="text-center">${startIdx + index + 1}</td>
                    <td>${formatDate(item.date)}</td>
                    <td>${item.category}</td>
                    <td class="text-start fw-bold text-secondary">${item.payer || '-'}</td>
                    <td class="text-start fw-bold text-secondary">${item.receiver || '-'}</td>
                    <td>${item.description || '-'}</td>
                    <td class="text-end fw-bold ${typeColor}">${amountPrefix}$${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        }).join('');
    };

    let reportContentHtml = "";

    // 1. Income Section
    if (incomeData.length > 0 && reportType !== 'expense') {
        const subtotal = incomeData.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        reportContentHtml += `
            <div class="section-title">
                <i class="fas fa-arrow-circle-up text-success"></i> ១. ផ្នែកចំណូល (Income Section)
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">ល.រ</th>
                        <th style="width: 90px;">កាលបរិច្ឆេទ</th>
                        <th>ប្រភពចំណូល</th>
                        <th>អ្នកបង់/អ្នកចំណាយ</th>
                        <th>អ្នកទទួល</th>
                        <th>ការបរិយាយ</th>
                        <th style="width: 100px;">ទឹកប្រាក់ ($)</th>
                    </tr>
                </thead>
                <tbody>${generateTableRows(incomeData)}</tbody>
                <tfoot>
                    <tr style="background:#f0fff0; font-weight:bold;">
                        <td colspan="6" class="text-end">សរុបផ្នែកចំណូល (Income Subtotal):</td>
                        <td class="text-end text-success">+$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    // 2. Expense Section
    if (expenseData.length > 0 && reportType !== 'income') {
        const subtotal = expenseData.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        reportContentHtml += `
            <div class="section-title" style="margin-top:30px;">
                <i class="fas fa-arrow-circle-down text-danger"></i> ២. ផ្នែកចំណាយ (Expense Section)
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">ល.រ</th>
                        <th style="width: 90px;">កាលបរិច្ឆេទ</th>
                        <th>ចំណាយទៅលើ</th>
                        <th>អ្នកចំណាយ</th>
                        <th>អ្នកទទួល</th>
                        <th>ការបរិយាយ</th>
                        <th style="width: 100px;">ទឹកប្រាក់ ($)</th>
                    </tr>
                </thead>
                <tbody>${generateTableRows(expenseData, incomeData.length)}</tbody>
                <tfoot>
                    <tr style="background:#fffafa; font-weight:bold;">
                        <td colspan="6" class="text-end">សរុបផ្នែកចំណាយ (Expense Subtotal):</td>
                        <td class="text-end text-danger">-$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    const netBalance = totalIncome - totalExpense;
    const balanceClass = netBalance >= 0 ? 'text-primary' : 'text-danger';
    const currentUserNameDisp = currentUserName || (firebase.auth().currentUser ? firebase.auth().currentUser.displayName : 'Admin');

    let win = window.open('', '_blank');
    if (!win) {
        alert("Please allow popups for this website to generate reports.");
        return;
    }
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + "/";

    let html = `<html><head><title>${title}</title>
         <base href="${baseUrl}">
         <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
             @font-face { font-family: 'Kantumruy-Light'; src: url('fonts/Kantumruy-Light.ttf') format('truetype'); }
             body { font-family: 'Kantumruy-Light', sans-serif !important; padding: 20px; color: #333; }
             @page { size: A4 landscape; margin: 15mm; }
             .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid rgb(31, 6, 55); padding-bottom: 15px; margin-bottom: 20px; }
             .header-logo img { height: 90px; }
             .header-text { flex: 1; text-align: center; }
             .section-title { font-size: 16px; font-weight: bold; color: rgb(31, 6, 55); padding: 5px 10px; border-left: 5px solid rgb(31, 6, 55); background: #f8f9fa; margin-bottom: 10px; }
             table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
             th, td { border: 1px solid #999; padding: 6px; }
             th { background-color: rgb(31, 6, 55); color: white; font-weight: bold; }
             .text-center { text-align: center; }
             .text-end { text-align: right; }
             .text-success { color: #198754; }
             .text-danger { color: #dc3545; }
             .summary-section { margin-top: 25px; display: flex; justify-content: flex-end; }
             .summary-card { border: 2px solid rgb(31, 6, 55); padding: 15px; border-radius: 12px; width: 320px; background: #fff; }
             .footer-signature { margin-top: 50px; display: flex; justify-content: space-between; padding: 0 40px; }
             .signature-block { text-align: center; }
             .signature-line { margin-top: 50px; border-top: 1px solid #000; width: 160px; margin: 0 auto; }
        </style>
    </head>
    <body>
        <div class="header-container">
            <div class="header-logo"><img src="img/logo.jpg" onerror="this.src='img/1.jpg'" alt="Logo"></div>
            <div class="header-text">
                <p>អាសយដ្ឋាន៖ ភូមិត្រពាំងព្រីងខាងត្បូង ឃុំត្រពាំងព្រីង ស្រុកទឹកឈូ ខេត្តកំពត</p>
                <p>លេខទូរស័ព្ទ៖ 097 75 33 473</p>
                <h3 style="text-decoration: underline; margin:10px 0;">${title}</h3>
                <p style="font-size:12px;">Generated on: ${new Date().toLocaleString('en-GB')} | Prepared by: ${currentUserNameDisp}</p>
            </div>
            <div style="width:120px;"></div>
        </div>
        
        ${reportContentHtml}

        <div class="summary-section">
            <div class="summary-card">
                 <h5 style="margin:0 0 10px 0; border-bottom:1px solid #eee; padding-bottom:5px;">សេចក្តីសង្ខេប (Summary)</h5>
                 ${reportType !== 'expense' ? `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>ចំណូលសរុប:</span><span class="text-success fw-bold">+$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
                 ${reportType !== 'income' ? `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>ចំណាយសរុប:</span><span class="text-danger fw-bold">-$${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
                 ${reportType === 'all' ? `<hr><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px;"><span>ទឹកប្រាក់នៅសល់:</span><span class="${balanceClass}">$${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>` : ''}
            </div>
        </div>
        <div class="footer-signature">
            <div class="signature-block"><p>អ្នករៀបចំ</p><div class="signature-line"></div><p style="margin-top:10px; font-weight:bold;">${currentUserNameDisp}</p></div>
            <div class="signature-block"><p>អ្នកត្រួតពិនិត្យ</p><div class="signature-line"></div></div>
            <div class="signature-block"><p>អ្នកអនុម័ត</p><div class="signature-line"></div></div>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); }</script>
    </body></html>`;

    win.document.write(html);
    win.document.close();
}

// Global Exports
window.exportReport = exportReport;
window.exportToExcel = exportToExcel;
window.getFilteredExportData = getFilteredExportData;

// ==========================================
// OVERDUE REPORT FUNCTIONS (Ported)
// ==========================================

function calculateTotalAmount(student) {
    if (!student) return 0;
    const tuitionFee = parseFloat(student.tuitionFee) || 0;
    const materialFee = parseFloat(student.materialFee) || 0;
    const adminFee = parseFloat(student.adminFee) || 0;

    // Handle both discountAmount (new) and discount (legacy)
    const discountAmount = parseFloat(student.discountAmount || student.discount) || 0;
    const discountPercent = parseFloat(student.discountPercent) || 0;

    const totalDiscount = discountAmount + (tuitionFee * discountPercent / 100);
    const total = (tuitionFee + materialFee + adminFee) - totalDiscount;
    return total > 0 ? total : 0;
}

function calculateTotalPaid(student) {
    if (!student) return 0;
    // Include both initial and extra payments from registration
    let totalPaid = (parseFloat(student.initialPayment) || 0) + (parseFloat(student.extraPayment) || 0);

    if (student.installments) {
        const installments = Array.isArray(student.installments) ? student.installments : Object.values(student.installments);
        installments.forEach(inst => {
            // Count any installment amount (they are only added if valid)
            totalPaid += (parseFloat(inst.amount || inst.paidAmount) || 0);
        });
    }
    return totalPaid;
}

function calculateRemainingAmount(student) {
    if (!student) return 0;
    // Special case: 48 months (4 years) is considered "Full Paid/Scholarship" behavior
    const months = parseInt(student.paymentMonths || student.studyDuration) || 0;
    if (months === 48) return 0;

    const balance = calculateTotalAmount(student) - calculateTotalPaid(student);
    return Math.max(0, balance);
}

function convertToEnglishDate(khmerDateStr) {
    if (!khmerDateStr || ['មិនមាន', '', 'N/A'].includes(khmerDateStr)) return null;
    try {
        const match = khmerDateStr.match(/ថ្ងៃទី\s*(\d+)\/(\d+)\/(\d+)/);
        if (match) return `${parseInt(match[2])}/${parseInt(match[1])}/${match[3]}`;

        if (khmerDateStr.includes('/') && !khmerDateStr.includes('ថ្ងៃទី')) {
            const p = khmerDateStr.split('/');
            if (p.length === 3) return `${parseInt(p[1])}/${parseInt(p[0])}/${p[2]}`;
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(khmerDateStr)) {
            const [y, m, d] = khmerDateStr.split('-');
            return `${parseInt(m)}/${parseInt(d)}/${y}`;
        }

        if (khmerDateStr.includes(' / ')) {
            const p = khmerDateStr.split(' / ');
            if (p.length === 3) {
                const mIndex = KHMER_MONTHS.indexOf(p[1].trim());
                if (mIndex !== -1) {
                    const month = mIndex + 1;
                    const toEngNum = (s) => s.replace(/[០-៩]/g, d => "០១២៣៤៥៦៧៨៩".indexOf(d)).trim();
                    const day = toEngNum(p[0]);
                    const year = toEngNum(p[2]);
                    return `${month}/${day}/${year}`;
                }
            }
        }

        if (khmerDateStr.includes('-')) {
            const p = khmerDateStr.split('-');
            if (p.length === 3) {
                const mIndex = KHMER_MONTHS.indexOf(p[1]);
                if (mIndex !== -1) {
                    const month = mIndex + 1;
                    const toEngNum = (s) => s.replace(/[០-៩]/g, d => "០១២៣៤៥៦៧៨៩".indexOf(d));
                    const day = toEngNum(p[0]);
                    const year = toEngNum(p[2]);
                    return `${month}/${day}/${year}`;
                }
                const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
                const mStr = p[1].toLowerCase();
                if (months[mStr]) return `${months[mStr]}/${parseInt(p[0])}/${p[2]}`;
                return `${parseInt(p[1])}/${parseInt(p[2])}/${p[0]}`;
            }
        }
        return khmerDateStr;
    } catch (e) { return null; }
}


function getPaymentStatus(student) {
    if (!student) return { text: 'N/A', badge: 'status-pending', status: 'pending', daysRemaining: 0 };

    const pm = parseInt(student.paymentMonths) || 0;
    if (pm === 48) {
        return { text: '✅ បង់ដាច់ 100%', badge: 'status-paid', status: 'paid', daysRemaining: 0 };
    }

    let daysDiff = 0;
    const nextPaymentDateStr = student.nextPaymentDate;
    if (nextPaymentDateStr && !['មិនមាន', 'N/A', ''].includes(nextPaymentDateStr)) {
        let nextDueDate = null;
        const engDate = convertToEnglishDate(nextPaymentDateStr);

        if (engDate) {
            nextDueDate = new Date(engDate);
        } else {
            // Fallback attempt
            nextDueDate = new Date(nextPaymentDateStr);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (nextDueDate && !isNaN(nextDueDate.getTime())) {
            daysDiff = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24));

            if (daysDiff < 0) return { text: `❌ ហួសកំណត់ (${Math.abs(daysDiff)} ថ្ងៃ)`, badge: 'status-overdue', status: 'overdue', daysRemaining: daysDiff };
            if (daysDiff === 0) return { text: '📅 ត្រូវបង់ថ្ងៃនេះ', badge: 'status-today', status: 'today', daysRemaining: 0 };
            if (daysDiff > 0 && daysDiff <= 10) return { text: `⏳ ជិតដល់ថ្ងៃ (${daysDiff} ថ្ងៃ)`, badge: 'status-warning', status: 'warning', daysRemaining: daysDiff };
        }
    }

    const remainingAmount = calculateRemainingAmount(student);
    if (remainingAmount <= 0) return { text: '✅ បង់រួច', badge: 'status-paid', status: 'paid', daysRemaining: daysDiff };

    if (daysDiff < 0) return { text: `❌ ហួសកំណត់ (${Math.abs(daysDiff)} ថ្ងៃ)`, badge: 'status-overdue', status: 'overdue', daysRemaining: daysDiff };

    const dbStatus = student.paymentStatus || 'Pending';
    if (['Paid', 'បង់រួច'].includes(dbStatus)) return { text: '✅ បង់រួច', badge: 'status-paid', status: 'paid', daysRemaining: daysDiff };
    if (['Installment', 'Partial', 'នៅជំណាក់'].includes(dbStatus)) return { text: '⏳ នៅជំណាក់', badge: 'status-installment', status: 'installment', daysRemaining: daysDiff };

    return { text: '❌ មិនទាន់បង់', badge: 'status-pending', status: 'pending', daysRemaining: daysDiff };
}

function exportOverdueReport() {
    // 1. Group Data
    const categories = {
        'Chinese Fulltime': { title: 'ភាសាចិនពេញម៉ោង', groups: { today: [], overdue: [], warning: [], unpaid: [] }, totalDebt: 0 },
        'Chinese Parttime': { title: 'ភាសាចិនក្រៅម៉ោង', groups: { today: [], overdue: [], warning: [], unpaid: [] }, totalDebt: 0 },
        '1 Language': { title: 'ភាសា (១ភាសា)', groups: { today: [], overdue: [], warning: [], unpaid: [] }, totalDebt: 0 },
        '2 Languages': { title: 'ភាសា (២ភាសា)', groups: { today: [], overdue: [], warning: [], unpaid: [] }, totalDebt: 0 },
        '3 Languages': { title: 'ភាសា (៣ភាសា)', groups: { today: [], overdue: [], warning: [], unpaid: [] }, totalDebt: 0 },
        'Other': { title: 'ផ្សេងៗ', groups: { today: [], overdue: [], warning: [], unpaid: [] }, totalDebt: 0 }
    };

    // Global Stats for Dashboard
    const stats = {
        today: { count: 0, amount: 0 },
        overdue: { count: 0, amount: 0 },
        warning: { count: 0, amount: 0 },
        unpaid: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 }
    };

    const students = Object.values(allStudentsData).filter(s => {
        if (s.enrollmentStatus === 'dropout') return false;

        const debt = calculateRemainingAmount(s);
        const status = getPaymentStatus(s);
        const isTimeCritical = ['overdue', 'today', 'warning'].includes(status.status);

        if (debt > 0 || isTimeCritical) return true;
        return false;
    });

    if (students.length === 0) {
        alert('ល្អណាស់! មិនមានសិស្សជំពាក់ប្រាក់ហួសកំណត់ទេ');
        return;
    }

    students.sort((a, b) => (a.displayId || '').localeCompare(b.displayId || ''));

    students.forEach(s => {
        const type = (s.studyType || '').toLowerCase();
        const prog = (s.studyProgram || '').toLowerCase();
        let catKey = 'Other';

        if (prog.includes('3_languages') || prog.includes('៣ ភាសា')) catKey = '3 Languages';
        else if (prog.includes('2_languages') || prog.includes('២ ភាសា')) catKey = '2 Languages';
        else if (prog.includes('1_language') || prog.includes('១ ភាសា')) catKey = '1 Language';
        else if (type.includes('fulltime') || type.includes('ពេញម៉ោង')) catKey = 'Chinese Fulltime';
        else if (type.includes('parttime') || type.includes('ក្រៅម៉ោង')) catKey = 'Chinese Parttime';

        const statusObj = getPaymentStatus(s);
        const days = statusObj.daysRemaining;
        const debt = calculateRemainingAmount(s);

        const hasDate = s.nextPaymentDate && !['N/A', 'មិនមាន', ''].includes(s.nextPaymentDate);
        let groupKey = 'unpaid';

        if (hasDate) {
            if (days < 0) groupKey = 'overdue';
            else if (days === 0) groupKey = 'today';
            else if (days > 0 && days <= 10) groupKey = 'warning';
        }

        categories[catKey].groups[groupKey].push(s);
        categories[catKey].totalDebt += debt;

        stats[groupKey].count++;
        stats[groupKey].amount += debt;
        stats.total.count++;
        stats.total.amount += debt;
    });

    let win = window.open('', 'OverdueReport', 'width=1200,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
    if (!win) { alert('Please allow popups for this website'); return; }

    // Minimal HTML for the popup report (re-using the logic from data-tracking)
    let html = `<html><head><title>របាយការណ៍បំណុលសិស្ស</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
        <style>
             @page { margin: 20mm; size: auto; }
            body { font-family: 'Battambang', sans-serif !important; background: #eaecf1; color: #333; font-size: 14px; margin: 0; padding: 20px; }
            .header-container { background: white; padding: 20px 40px; border-bottom: 4px solid #8a0e5b; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
            .header-info h1 { font-family: 'Moul', serif; color: #8a0e5b; font-size: 24px; margin: 0; }
            .stat-card { background: white; padding: 15px; border-radius: 12px; text-align: center; border: 1px solid #eee; display: flex; flex-direction: column; align-items: center; }
            .dashboard-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
            .category-section { background: white; margin-bottom: 30px; border-radius: 15px; overflow: hidden; border: 1px solid #ddd; }
            .section-header { padding: 12px 20px; font-weight: bold; background: #f9fafb; border-bottom: 1px solid #eee; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { padding: 10px; border: 1px solid #eee; text-align: center; }
            th { background: #f0f2f5; }
            .text-danger { color: #dc3545; }
            .text-warning { color: #fd7e14; }
            .text-success { color: #198754; }
            
            /* Action Bar */
            .action-bar { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 10px 20px; border-radius: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); display: flex; gap: 10px; z-index: 1000; }
            .btn { padding: 8px 20px; border-radius: 20px; border: none; cursor: pointer; color: white; font-weight: bold; }
            .btn-print { background: #0d6efd; }
            .btn-close { background: #6c757d; }
            @media print { .action-bar { display: none; } body { padding: 0; background: white; } }
        </style>
    </head><body>
        <div class="action-bar">
            <button class="btn btn-print" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
            <button class="btn btn-close" onclick="window.close()"><i class="fas fa-times"></i> Close</button>
        </div>

        <div class="header-container">
            <div class="header-info">
                <h1>សាលារៀន អាយ ធី ឃេ</h1>
                <h2>ITK SCHOOL - OVERDUE REPORT</h2>
            </div>
            <div style="text-align: right;">
                 <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="stat-card" style="border-top: 4px solid #dc3545;">
                <div style="font-family: Moul; font-size: 12px; color: #666;">ហួសកំណត់ (Overdue)</div>
                <div style="font-size: 20px; font-weight: bold; color: #dc3545;">${stats.overdue.count} នាក់</div>
                <div style="font-weight: bold; background: #ffe6e6; color: #dc3545; padding: 2px 10px; border-radius: 10px;">$${stats.overdue.amount.toFixed(2)}</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #fd7e14;">
                <div style="font-family: Moul; font-size: 12px; color: #666;">ជិតដល់ថ្ងៃ (Warning)</div>
                <div style="font-size: 20px; font-weight: bold; color: #fd7e14;">${stats.warning.count} នាក់</div>
                <div style="font-weight: bold; background: #fff3cd; color: #fd7e14; padding: 2px 10px; border-radius: 10px;">$${stats.warning.amount.toFixed(2)}</div>
            </div>
             <div class="stat-card" style="border-top: 4px solid #0d6efd;">
                <div style="font-family: Moul; font-size: 12px; color: #666;">ត្រូវបង់ថ្ងៃនេះ (Today)</div>
                <div style="font-size: 20px; font-weight: bold; color: #0d6efd;">${stats.today.count} នាក់</div>
                <div style="font-weight: bold; background: #e7f1ff; color: #0d6efd; padding: 2px 10px; border-radius: 10px;">$${stats.today.amount.toFixed(2)}</div>
            </div>
            <div class="stat-card" style="border-top: 4px solid #6c757d;">
                <div style="font-family: Moul; font-size: 12px; color: #666;">សរុបបំណុល (Total Debt)</div>
                <div style="font-size: 20px; font-weight: bold; color: #333;">${stats.total.count} នាក់</div>
                <div style="font-weight: bold; background: #e2e3e5; color: #333; padding: 2px 10px; border-radius: 10px;">$${stats.total.amount.toFixed(2)}</div>
            </div>
        </div>
    `;

    // Render Categories
    Object.keys(categories).forEach(catKey => {
        const cat = categories[catKey];
        const allInCat = [...cat.groups.overdue, ...cat.groups.warning, ...cat.groups.today, ...cat.groups.unpaid];
        if (allInCat.length === 0) return;

        html += `<div class="category-section">
            <div class="section-header" style="display:flex; justify-content:space-between;">
                <span>${cat.title}</span>
                <span>Total Debt: $${cat.totalDebt.toFixed(2)}</span>
            </div>
            <div style="padding: 15px;">`;

        // Function to render table
        const renderGroupTable = (title, list, colorClass) => {
            if (list.length === 0) return '';
            let tRows = list.map((s, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td><b>${s.displayId}</b></td>
                    <td style="text-align:left; padding-left:10px;">${s.lastName} ${s.firstName}</td>
                    <td>${s.personalPhone || '-'}</td>
                    <td>${s.nextPaymentDate || '-'}</td>
                    <td class="${colorClass}" style="font-weight:bold;">$${calculateRemainingAmount(s).toFixed(2)}</td>
                </tr>
            `).join('');

            return `<h4 style="margin: 10px 0 5px; color: #555; border-bottom: 2px solid #eee; display:inline-block;">${title} (${list.length})</h4>
                    <table>
                        <thead><tr><th width="50">No</th><th width="100">ID</th><th>Name</th><th width="120">Phone</th><th width="120">Due Date</th><th width="100">Debt</th></tr></thead>
                        <tbody>${tRows}</tbody>
                    </table>`;
        };

        html += renderGroupTable('Overdue (ហួសកំណត់)', cat.groups.overdue, 'text-danger');
        html += renderGroupTable('Warning (ជិតដល់ថ្ងៃ)', cat.groups.warning, 'text-warning');
        html += renderGroupTable('Today (ថ្ងៃនេះ)', cat.groups.today, 'text-primary');
        html += renderGroupTable('Unpaid (ជំពាក់)', cat.groups.unpaid, 'text-danger');


        html += `</div></div>`;
    });

    html += `</body></html>`;
    win.document.write(html);
    win.document.close();
}

function exportDueTodayReport() {
    // 1. Group Data
    const categories = {
        'Chinese Fulltime': { title: 'ភាសាចិនពេញម៉ោង', groups: { today: [] }, totalDebt: 0 },
        'Chinese Parttime': { title: 'ភាសាចិនក្រៅម៉ោង', groups: { today: [] }, totalDebt: 0 },
        '1 Language': { title: 'ភាសា (១ភាសា)', groups: { today: [] }, totalDebt: 0 },
        '2 Languages': { title: 'ភាសា (២ភាសា)', groups: { today: [] }, totalDebt: 0 },
        '3 Languages': { title: 'ភាសា (៣ភាសា)', groups: { today: [] }, totalDebt: 0 },
        'Other': { title: 'ផ្សេងៗ', groups: { today: [] }, totalDebt: 0 }
    };

    const stats = {
        today: { count: 0, amount: 0 }
    };

    const students = Object.values(allStudentsData).filter(s => {
        if (s.enrollmentStatus === 'dropout') return false;
        const status = getPaymentStatus(s);
        return status.status === 'today';
    });

    if (students.length === 0) {
        alert('មិនមានសិស្សត្រូវបង់ប្រាក់ថ្ងៃនេះទេ');
        return;
    }

    students.sort((a, b) => (a.displayId || '').localeCompare(b.displayId || ''));

    students.forEach(s => {
        const type = (s.studyType || '').toLowerCase();
        const prog = (s.studyProgram || '').toLowerCase();
        let catKey = 'Other';

        if (prog.includes('3_languages') || prog.includes('៣ ភាសា')) catKey = '3 Languages';
        else if (prog.includes('2_languages') || prog.includes('២ ភាសា')) catKey = '2 Languages';
        else if (prog.includes('1_language') || prog.includes('១ ភាសា')) catKey = '1 Language';
        else if (type.includes('fulltime') || type.includes('ពេញម៉ោង')) catKey = 'Chinese Fulltime';
        else if (type.includes('parttime') || type.includes('ក្រៅម៉ោង')) catKey = 'Chinese Parttime';

        const debt = calculateRemainingAmount(s);
        categories[catKey].groups.today.push(s);
        categories[catKey].totalDebt += debt;

        stats.today.count++;
        stats.today.amount += debt;
    });

    let win = window.open('', 'DueTodayReport', 'width=1200,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
    if (!win) { alert('Please allow popups for this website'); return; }

    let html = `<html><head><title>របាយការណ៍បង់ប្រាក់ថ្ងៃនេះ</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
        <style>
            @page { margin: 20mm; size: auto; }
            body { font-family: 'Battambang', sans-serif !important; background: #f0f7ff; color: #333; font-size: 14px; margin: 0; padding: 20px; }
            .header-info h1 { font-family: 'Moul', serif; color: #0d6efd; font-size: 24px; margin: 0; }
            .header-container { background: white; padding: 20px 40px; border-bottom: 4px solid #0d6efd; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            @media print { .action-bar { display: none; } body { padding: 0; background: white; } }
            /* Reuse styles */
            .action-bar { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 10px 20px; border-radius: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); display: flex; gap: 10px; z-index: 1000; }
            .btn { padding: 8px 20px; border-radius: 20px; border: none; cursor: pointer; color: white; font-weight: bold; }
            .btn-print { background: #0d6efd; }
            .btn-close { background: #6c757d; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { padding: 10px; border: 1px solid #eee; text-align: center; }
            th { background: #e7f1ff; color: #0d6efd; font-weight: bold; }
            h4 { font-family: 'Moul', serif; color: #0d6efd; margin: 20px 0 10px; border-bottom: 2px dashed #0d6efd; display: inline-block; padding-bottom: 5px; }
        </style>
    </head><body>
         <div class="action-bar">
            <button class="btn btn-print" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
            <button class="btn btn-close" onclick="window.close()"><i class="fas fa-times"></i> Close</button>
        </div>

        <div class="header-container">
            <div class="header-info">
                <h1>សាលារៀន អាយ ធី ឃេ</h1>
                <h2>របាយការណ៍សិស្សត្រូវបង់ប្រាក់ថ្ងៃនេះ (TODAY)</h2>
            </div>
             <div style="text-align: right;">
                 <p>Date: ${new Date().toLocaleDateString()}</p>
                 <h3 style="color: #0d6efd; margin: 0;">Total: ${stats.today.count} នាក់ ($${stats.today.amount.toFixed(2)})</h3>
            </div>
        </div>
    `;

    Object.keys(categories).forEach(catKey => {
        const cat = categories[catKey];
        if (cat.groups.today.length === 0) return;

        html += `<div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #cce5ff;">
            <h4>${cat.title}</h4>
            <table>
                <thead><tr><th>No</th><th>ID</th><th>Name</th><th>Phone</th><th>Level/Time</th><th>Debt</th></tr></thead>
                <tbody>
        `;

        cat.groups.today.forEach((s, idx) => {
            html += `<tr>
                <td>${idx + 1}</td>
                <td><b>${s.displayId}</b></td>
                <td style="text-align:left;">${s.lastName} ${s.firstName}</td>
                <td>${s.personalPhone || '-'}</td>
                <td>${s.studyLevel || ''} - ${s.studyTime || ''}</td>
                <td style="color: #0d6efd; font-weight: bold;">$${calculateRemainingAmount(s).toFixed(2)}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    });

    html += `</body></html>`;
    win.document.write(html);
    win.document.close();
}



// ==========================================
// DATE RANGE REPORT FUNCTIONS
// ==========================================

let dateRangeModal = null;

function openDateRangeModal() {
    if (!dateRangeModal) {
        dateRangeModal = new bootstrap.Modal(document.getElementById('dateRangeModal'));
    }

    // Default to Today if empty
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('rangeStartDate');
    const endInput = document.getElementById('rangeEndDate');

    if (startInput && !startInput.value) startInput.value = today;
    if (endInput && !endInput.value) endInput.value = today;

    dateRangeModal.show();
}

function handleRangeReport() {
    const start = document.getElementById('rangeStartDate').value;
    const end = document.getElementById('rangeEndDate').value;

    if (!start || !end) {
        alert("សូមជ្រើសរើសថ្ងៃចាប់ផ្តើម និងថ្ងៃបញ្ចប់ (Please select both Start and End Date)");
        return;
    }

    if (start > end) {
        alert("ថ្ងៃចាប់ផ្តើមមិនអាចធំជាងថ្ងៃបញ្ចប់បានទេ (Start Date cannot be greater than End Date)");
        return;
    }

    // Hide modal
    if (dateRangeModal) dateRangeModal.hide();

    // Call export function
    exportReport('range', start, end);
}

// Amount Range Modal Logic
let amountRangeModal = null;
function openAmountRangeModal() {
    if (!amountRangeModal) {
        amountRangeModal = new bootstrap.Modal(document.getElementById('amountRangeModal'));
    }
    amountRangeModal.show();
}

function handleAmountRangeReport() {
    const min = document.getElementById('minAmountRange').value;
    const max = document.getElementById('maxAmountRange').value;

    if (min === '' || max === '') {
        alert("សូមបញ្ចូលចំនួនទឹកប្រាក់ (Please enter both Min and Max Amount)");
        return;
    }

    if (parseFloat(min) > parseFloat(max)) {
        alert("តម្លៃចាប់ផ្តើមមិនអាចធំជាងតម្លៃបញ្ចប់បានទេ (Min amount cannot be greater than Max amount)");
        return;
    }

    if (amountRangeModal) amountRangeModal.hide();
    exportReport('amount', min, max);
}


// ==========================================
// STUDENT PAYMENT MODAL LOGIC (Ported from Data Tracking)
// ==========================================

let studentPaymentModal = null;
let selectedStudentForPayment = null;

function openStudentPaymentModal(studentKey = null) {
    if (!studentPaymentModal) {
        studentPaymentModal = new bootstrap.Modal(document.getElementById('studentPaymentModal'));
        setupStudentSearch();
    }

    if (studentKey) {
        // If student key provided, show modal and select student
        studentPaymentModal.show();
        setTimeout(() => selectStudentForPayment(studentKey), 100);
    } else {
        // Reset Modal for fresh search
        document.getElementById('studentSearchInput').value = '';
        document.getElementById('studentSearchResults').style.display = 'none';
        document.getElementById('studentPaymentContent').style.display = 'none';
        document.getElementById('studentPaymentEmpty').style.display = 'block';
        studentPaymentModal.show();
    }
}

function setupStudentSearch() {
    const input = document.getElementById('studentSearchInput');
    const results = document.getElementById('studentSearchResults');

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            results.style.display = 'none';
            return;
        }

        const students = Object.values(allStudentsData).filter(s => {
            if (s.enrollmentStatus === 'dropout') return false;
            const searchStr = `${s.lastName} ${s.firstName} ${s.englishLastName || ''} ${s.englishFirstName || ''} ${s.displayId}`.toLowerCase();
            return searchStr.includes(term);
        }).slice(0, 10); // Show top 10 results

        if (students.length > 0) {
            results.innerHTML = students.map(s => `
                <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 border-0 border-bottom" onclick="selectStudentForPayment('${s.key}')">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary bg-opacity-10 text-primary rounded-circle p-2 me-3" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                            <i class="fi fi-rr-user"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark">${s.lastName} ${s.firstName}</div>
                            <div class="small text-muted" style="font-size: 0.75rem;">${s.englishLastName || ''} ${s.englishFirstName || ''}</div>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-light text-primary rounded-pill px-3 border border-primary border-opacity-25">${s.displayId}</span>
                    </div>
                </button>
            `).join('');
            results.style.display = 'block';
        } else {
            results.innerHTML = '<div class="list-group-item text-muted small py-3 text-center">មិនឃើញទិន្នន័យសិស្ស (No student found)</div>';
            results.style.display = 'block';
        }
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });
}

function selectStudentForPayment(studentKey) {
    const s = allStudentsData[studentKey];
    if (!s) return;

    selectedStudentForPayment = s;
    document.getElementById('studentSearchResults').style.display = 'none';
    document.getElementById('studentSearchInput').value = `${s.lastName} ${s.firstName} (${s.displayId})`;

    renderStudentPaymentDetails(s);
}

function renderStudentPaymentDetails(s) {
    const content = document.getElementById('studentPaymentContent');
    const empty = document.getElementById('studentPaymentEmpty');

    content.style.display = 'block';
    empty.style.display = 'none';

    // Header Info
    document.getElementById('stuNameDisplay').textContent = `${s.lastName} ${s.firstName}`;
    document.getElementById('stuIdDisplay').textContent = `ID: ${s.displayId}`;
    document.getElementById('stuLevelDisplay').textContent = s.studyLevel || 'N/A';
    document.getElementById('stuTimeDisplay').textContent = s.studyTime || 'N/A';
    document.getElementById('stuDueDateDisplay').textContent = toKhmerDate(s.nextPaymentDate) || 'មិនកំណត់';

    // Financial calculations
    const totalPaid = calculateTotalPaid(s);
    const balance = calculateRemainingAmount(s);

    const paidEl = document.getElementById('stuTotalPaidDisplay');
    const balanceEl = document.getElementById('stuBalanceDisplay');

    if (paidEl) paidEl.textContent = `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (balanceEl) {
        balanceEl.textContent = `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }

    // Installment History
    renderInstallmentHistoryList(s);

    // Reset Form
    hideAddInstallmentForm();
}

function renderInstallmentHistoryList(s) {
    const list = document.getElementById('stuInstallmentHistory');
    const countEl = document.getElementById('installmentCount');

    let historyItems = [];

    // 1. Add Registration Payment (Initial + Extra)
    const initial = parseFloat(s.initialPayment) || 0;
    const extra = parseFloat(s.extraPayment) || 0;
    const totalReg = initial + extra;

    if (totalReg > 0) {
        historyItems.push({
            type: 'registration',
            date: s.paymentDate || s.startDate || '',
            amount: totalReg,
            months: s.studyDuration || 1,
            receiver: s.receiver || 'Admin',
            note: 'បង់ប្រាក់ចុះឈ្មោះចូលរៀនដំបូង',
            isRegistration: true
        });
    }

    // 2. Add Monthly Installments
    if (s.installments) {
        const insts = Array.isArray(s.installments) ? s.installments : Object.values(s.installments);
        insts.forEach((inst, idx) => {
            historyItems.push({
                type: 'installment',
                date: inst.date,
                amount: inst.amount,
                months: inst.months || 1,
                receiver: inst.receiver || '-',
                forMonth: inst.forMonth,
                note: inst.note || (inst.forMonth ? `បង់សម្រាប់ខែ ${inst.forMonth}` : 'បង់ប្រាក់តាមខែ'),
                originalIndex: idx,
                isRegistration: false
            });
        });
    }

    // Assign Chronological Stages (Oldest = Stage 1)
    historyItems.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    historyItems.forEach((item, idx) => {
        item.stageDisplay = `ដំណាក់កាលទី ${idx + 1}`;
    });

    countEl.textContent = `${historyItems.length} ដង`;

    if (historyItems.length === 0) {
        list.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted small">មិនទាន់មានប្រវត្តិបង់ប្រាក់</td></tr>';
        return;
    }

    // Display order: Newest at top, Registration at bottom
    const displayItems = [...historyItems].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    list.innerHTML = displayItems.map(item => `
        <tr class="align-middle" style="border-bottom: 1px solid #f0f0f0;">
            <td class="ps-4 border-0 py-3">
                <div class="d-flex align-items-center">
                    <div class="rounded-circle d-flex align-items-center justify-content-center me-3 ${item.isRegistration ? 'bg-primary bg-opacity-10 text-primary' : 'bg-info bg-opacity-10 text-info'}" style="width: 38px; height: 38px; min-width: 38px;">
                        <i class="fi ${item.isRegistration ? 'fi-rr-user-add' : 'fi-rr-calendar-check'}"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 0.85rem;">${item.stageDisplay}</div>
                        <div class="text-muted" style="font-size: 0.7rem;">${item.isRegistration ? 'ចុះឈ្មោះ (Register)' : 'បង់ប្រចាំខែ (Monthly)'}</div>
                    </div>
                </div>
            </td>
            <td class="border-0 py-3">
                <div class="fw-bold text-dark" style="font-size: 0.9rem;">${typeof toKhmerDate === 'function' ? toKhmerDate(item.date) : formatDate(item.date)}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${item.receiver || 'Admin'}</div>
            </td>
            <td class="border-0 py-3">
                <div class="fw-bold text-success fs-6">$${(parseFloat(item.amount) || 0).toFixed(2)}</div>
            </td>
            <td class="text-center border-0 py-3">
                <span class="badge bg-light text-dark border px-3 py-2 rounded-pill">${item.months} ខែ</span>
            </td>
            <td class="border-0 py-3">
                 <div class="text-muted small text-truncate" style="max-width: 140px;" title="${item.note || ''}">${item.note || '-'}</div>
            </td>
            <td class="text-end pe-4 border-0 py-3">
                <div class="d-flex justify-content-end gap-1">
                    ${!item.isRegistration ? `
                        <button class="btn btn-sm btn-light text-primary rounded-circle shadow-sm" style="width: 32px; height: 32px;" onclick="printStudentReceipt('${s.key}', ${item.originalIndex})" title="Print"><i class="fi fi-rr-print"></i></button>
                        <button class="btn btn-sm btn-light text-info rounded-circle shadow-sm" style="width: 32px; height: 32px;" onclick="editStudentInstallment('${s.key}', ${item.originalIndex})" title="Edit"><i class="fi fi-rr-edit"></i></button>
                        <button class="btn btn-sm btn-light text-danger rounded-circle shadow-sm" style="width: 32px; height: 32px;" onclick="deleteStudentInstallment('${s.key}', ${item.originalIndex})" title="Delete"><i class="fi fi-rr-trash"></i></button>
                    ` : `
                        <button class="btn btn-sm btn-light text-muted opacity-50 rounded-circle border-0" disabled><i class="fi fi-rr-lock"></i></button>
                    `}
                </div>
            </td>
        </tr>
    `).join('');
}

function showAddInstallmentForm() {
    const container = document.getElementById('addInstallmentContainer');
    const history = document.getElementById('historyTableContainer');
    const form = document.getElementById('newInstallmentForm');

    container.style.display = 'block';
    history.style.display = 'none';

    // Initialize form
    form.reset();
    delete form.dataset.editIndex;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fi fi-rr-disk me-2"></i>រក្សាទុក';

    // form.payDate.valueAsDate = new Date(); // Old Native Way
    if (document.getElementById('payDate')._flatpickr) {
        document.getElementById('payDate')._flatpickr.setDate(new Date());
    } else {
        form.payDate.valueAsDate = new Date();
    }

    form.payReceiver.value = currentUserName || (firebase.auth().currentUser ? firebase.auth().currentUser.email.split('@')[0] : 'Admin');
    form.selectedStudentKey.value = selectedStudentForPayment.key;

    // Smart default for amount based on last installment or tuition fee
    let lastAmt = parseFloat(selectedStudentForPayment.initialPayment) || 0;
    if (selectedStudentForPayment.installments) {
        const insts = Array.isArray(selectedStudentForPayment.installments) ? selectedStudentForPayment.installments : Object.values(selectedStudentForPayment.installments);
        if (insts.length > 0) {
            lastAmt = parseFloat(insts[insts.length - 1].amount) || 0;
        }
    }
    if (lastAmt === 0) lastAmt = parseFloat(selectedStudentForPayment.tuitionFee) || 0;
    form.payAmount.value = lastAmt > 0 ? lastAmt : '';

    // Set current month as default forMonth
    const currentMonth = KHMER_MONTHS[new Date().getMonth()];
    if (form.forMonth) form.forMonth.value = currentMonth;

    // Reset manual date
    // form.nextPayDateManual.value = ''; // Old Native Way
    if (document.getElementById('nextPayDateManual')._flatpickr) {
        document.getElementById('nextPayDateManual')._flatpickr.clear();
    } else {
        form.nextPayDateManual.value = '';
    }
}

function hideAddInstallmentForm() {
    document.getElementById('addInstallmentContainer').style.display = 'none';
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) searchInput.value = ''; // Reset search input
    document.getElementById('historyTableContainer').style.display = 'block';
}

// Handle Form Submission
document.getElementById('newInstallmentForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const s = selectedStudentForPayment;
    if (!s) return;

    const formData = new FormData(this);
    const amount = parseFloat(formData.get('payAmount'));
    const date = formData.get('payDate');
    const months = parseInt(formData.get('payMonths')) || 1;
    const receiver = formData.get('payReceiver');
    const note = formData.get('payNote');
    const forMonth = formData.get('forMonth');
    const manualNextDate = formData.get('nextPayDateManual');

    if (amount <= 0 || !date) return alert('សូមបញ្ជាក់ចំនួនទឹកប្រាក់ និងកាលបរិច្ឆេទ (Amount and Date are required)');

    showLoading(true);

    // 1. Prepare New Installment
    const newInst = {
        amount,
        date,
        months,
        receiver,
        note,
        forMonth,
        paymentMethod: 'Cash', // Default for now
        paid: true,
        status: 'paid',
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    let installments = [];
    if (s.installments) {
        installments = Array.isArray(s.installments) ? [...s.installments] : Object.values(s.installments);
    }

    // Check if Edit Mode
    const editIndex = this.dataset.editIndex;
    if (editIndex !== undefined) {
        installments[editIndex] = { ...installments[editIndex], ...newInst };
    } else {
        installments.push(newInst);
    }

    // 2. Calculate New Next Payment Date based on current nextPaymentDate
    let nextDateStr = s.nextPaymentDate;
    let newNextDateStr = nextDateStr;

    try {
        if (manualNextDate) {
            // Use manual date: YYYY-MM-DD -> DD-Month-YYYY
            const d = new Date(manualNextDate);
            if (!isNaN(d.getTime())) {
                newNextDateStr = `${d.getDate().toString().padStart(2, '0')} / ${KHMER_MONTHS[d.getMonth()]} / ${d.getFullYear()}`;
            }
        } else {
            // Auto calculate
            let baseDate = null;
            const engDate = convertToEnglishDate(nextDateStr);
            if (engDate) {
                baseDate = new Date(engDate);
            } else if (s.startDate) {
                baseDate = new Date(s.startDate);
            }

            if (baseDate && !isNaN(baseDate.getTime())) {
                baseDate.setMonth(baseDate.getMonth() + months);
                newNextDateStr = `${baseDate.getDate().toString().padStart(2, '0')} / ${KHMER_MONTHS[baseDate.getMonth()]} / ${baseDate.getFullYear()}`;
            }
        }
    } catch (err) { console.error('Date calc error:', err); }

    // 3. Update Student Record
    studentsRef.child(s.key).update({
        installments: installments,
        nextPaymentDate: newNextDateStr,
        paymentStatus: 'Installment',
        updatedAt: new Date().toISOString()
    }).then(() => {
        // 4. Record Transaction in global list
        return transactionsRef.push({
            type: 'income',
            amount,
            date,
            category: `បង់ប្រាក់សិស្ស: ${s.lastName} ${s.firstName}`,
            description: `សិស្ស៖ ${s.lastName} ${s.firstName} - ${forMonth || (months + ' ខែ')}`,
            payer: 'អាណាព្យាបាល',
            receiver: receiver,
            recorder: receiver,
            sourceType: 'system_linked',
            studentKey: s.key,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    }).then(() => {
        alert('បង់ប្រាក់បានជោគជ័យ (Payment successful)');
        hideAddInstallmentForm();
        // The real-time listener will update allStudentsData and re-render
        // But for immediate feedback, we update our local copy
        s.installments = installments;
        s.nextPaymentDate = newNextDateStr;
        renderStudentPaymentDetails(s);
    }).catch(err => {
        console.error(err);
        alert('កំហុសក្នុងការរក្សាទុក (Error saving payment)');
    }).finally(() => showLoading(false));
});

function editStudentInstallment(studentKey, index) {
    const s = allStudentsData[studentKey];
    if (!s || !s.installments) return;

    const installments = Array.isArray(s.installments) ? s.installments : Object.values(s.installments);
    const inst = installments[index];
    if (!inst) return;

    // Populate form with existing data
    showAddInstallmentForm();
    const form = document.getElementById('newInstallmentForm');
    form.querySelector('[name="payDate"]').value = inst.date || '';
    form.querySelector('[name="payAmount"]').value = inst.amount || 0;
    form.querySelector('[name="forMonth"]').value = inst.forMonth || '';
    form.querySelector('[name="payMonths"]').value = inst.months || 1;
    form.querySelector('[name="payReceiver"]').value = inst.receiver || '';
    form.querySelector('[name="payNote"]').value = inst.note || '';

    // Add a temporary flag to handle update instead of push
    form.dataset.editIndex = index;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '<i class="fi fi-rr-disk me-2"></i>ធ្វើបច្ចុប្បន្នភាព';
}

function printFullStudentStatement() {
    const s = selectedStudentForPayment;
    if (!s) return alert('សូមជ្រើសរើសសិស្សជាមុនសិន!');

    const totalPaid = calculateTotalPaid(s);
    const balance = calculateRemainingAmount(s);
    const totalFee = calculateTotalAmount(s);

    let combinedItems = [];
    const initial = parseFloat(s.initialPayment) || 0;
    const extra = parseFloat(s.extraPayment) || 0;

    if (initial + extra > 0) {
        combinedItems.push({
            stage: 'ចុះឈ្មោះចូលរៀន',
            date: s.paymentDate || s.startDate,
            amount: initial + extra,
            months: s.studyDuration || 1,
            receiver: s.receiver || 'Admin'
        });
    }

    if (s.installments) {
        const insts = Array.isArray(s.installments) ? s.installments : Object.values(s.installments);
        insts.forEach((inst, idx) => {
            combinedItems.push({
                stage: `បង់ប្រាក់តាមខែ (${inst.forMonth || (idx + 1)})`,
                date: inst.date,
                amount: inst.amount,
                months: inst.months || 1,
                receiver: inst.receiver || '-',
                note: inst.forMonth
            });
        });
    }

    // Sort chronologically for the statement
    combinedItems.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const rows = combinedItems.map((item, idx) => `
        <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td style="text-align:left"><b>${item.stage}</b></td>
            <td style="text-align:center">${convertToKhmerDate(item.date)}</td>
            <td style="text-align:center">${item.months} ខែ</td>
            <td>$${parseFloat(item.amount).toFixed(2)}</td>
        </tr>
    `).join('');

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) {
        alert("Please allow popups for this website to print statements.");
        return;
    }
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Statement - ${s.displayId}</title>
            <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
                body { margin: 0; padding: 20px; background: #555; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; font-family: 'Battambang', sans-serif; }
                .pos-receipt-paper { width: 210mm; height: 148mm; background: white; padding: 12mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; }
                @media print {
                    body { background: white; margin: 0; padding: 0; display: block; }
                    .pos-receipt-paper { width: 100%; height: 100%; box-shadow: none; margin: 0; padding: 10mm; }
                    .no-print { display: none !important; }
                    @page { size: A5 landscape; margin: 0; }
                }
                .header-row { display: flex; border-bottom: 3px double #1f0637; padding-bottom: 8px; margin-bottom: 12px; }
                .logo-col { flex: 0 0 30mm; }
                .text-col { flex: 1; text-align: center; }
                .meta-col { flex: 0 0 50mm; text-align: right; }
                .school-kh { font-family: 'Moul', serif; font-size: 14pt; color: #1f0637; line-height: 1.2; }
                .school-en { font-size: 9pt; font-weight: bold; color: #333; letter-spacing: 0.5px; }
                .receipt-badge { background: #1f0637; color: white; padding: 5px 15px; border-radius: 4px; display: inline-block; text-align: center; }
                .receipt-title { font-size: 11pt; font-weight: bold; }
                
                .student-info { display: flex; justify-content: space-between; margin-bottom: 10px; background: #f8f9fa; padding: 8px 12px; border-radius: 6px; font-size: 9pt; }
                
                table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                th { background: #1f0637; color: white; padding: 6px; text-align: right; border: 1px solid #1f0637; }
                td { padding: 5px; text-align: right; border: 1px solid #eee; }
                .total-section { display: flex; justify-content: flex-end; margin-top: 10px; }
                .summary-table { width: 60mm; }
                .summary-table td { border: none; padding: 3px 0; }
                .summary-label { text-align: left; color: #666; }
                .summary-val { font-weight: bold; font-size: 11pt; }
                .text-danger { color: #dc3545; }
                .text-success { color: #198754; }
                
                .footer-row { display: flex; justify-content: space-between; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; }
                .sig-box { text-align: center; width: 40%; font-size: 8.5pt; }
                .sig-line { border-top: 1px solid #333; margin-top: 30px; margin-bottom: 5px; }
                .print-fab { position: fixed; bottom: 20px; right: 20px; background: #1f0637; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; }
            </style>
        </head>
        <body>
            <button class="print-fab no-print" onclick="window.print()"><i class="fa fa-print"></i></button>
            <div class="pos-receipt-paper">
                <div class="header-row">
                    <div class="logo-col"><img src="img/logo.jpg" style="width:100%;"></div>
                    <div class="text-col">
                        <div class="school-kh">សាលាអន្តរជាតិ អាយធី ឃេ</div>
                        <div class="school-en">ITK INTERNATIONAL SCHOOL</div>
                        <div style="font-size: 7.5pt; color: #666;">ក្រុងកំពត, ខេត្តកំពត | Tel: 093 83 56 78</div>
                    </div>
                    <div class="meta-col">
                        <div class="receipt-badge">
                            <div class="receipt-title">ប្រវត្តិបង់ប្រាក់សរុប</div>
                            <div style="font-size: 6pt;">STATEMENT OF ACCOUNT</div>
                        </div>
                    </div>
                </div>

                <div class="student-info">
                    <div>អត្តលេខ៖ <b>${s.displayId}</b></div>
                    <div>ឈ្មោះសិស្ស៖ <b>${s.lastName} ${s.firstName}</b></div>
                    <div>កម្រិតសិក្សា៖ <b>${s.studyLevel || '-'}</b></div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align:center">#</th>
                            <th style="text-align:left">បរិយាយ / ដំណាក់កាល</th>
                            <th style="text-align:center">កាលបរិច្ឆេទ</th>
                            <th style="text-align:center">រយៈពេល</th>
                            <th>ទឹកប្រាក់បង់</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="total-section">
                    <table class="summary-table">
                        <tr>
                            <td class="summary-label">សរុបថ្លៃសិក្សា</td>
                            <td class="summary-val">$${totalFee.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td class="summary-label text-success">ទឹកប្រាក់បានបង់</td>
                            <td class="summary-val text-success">$${totalPaid.toFixed(2)}</td>
                        </tr>
                        <tr style="border-top: 1px solid #333;">
                            <td class="summary-label text-danger" style="padding-top: 5px;">នៅជំពាក់សរុប</td>
                            <td class="summary-val text-danger" style="padding-top: 5px;">$${balance.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>

                <div class="footer-row">
                    <div class="sig-box">
                        <div>អាណាព្យាបាលសិស្ស</div>
                        <div class="sig-line"></div>
                        <div style="font-size: 7pt;">បោះពុម្ពថ្ងៃទី៖ ${new Date().toLocaleDateString('km-KH')}</div>
                    </div>
                    <div class="sig-box">
                        <div>អ្នកទទួលប្រាក់ / បេឡា</div>
                        <div class="sig-line"></div>
                        <div>(ហត្ថលេខា និងឈ្មោះ)</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    win.document.close();
}

function deleteStudentInstallment(studentKey, index) {
    if (!confirm('តើអ្នកពិតជាចង់លុបប្រវត្តិនេះមែនទេ? (Are you sure you want to delete this installment?)')) return;

    const s = allStudentsData[studentKey];
    if (!s || !s.installments) return;

    let insts = Array.isArray(s.installments) ? [...s.installments] : Object.values(s.installments);
    if (index >= 0 && index < insts.length) {
        insts.splice(index, 1);

        showLoading(true);
        studentsRef.child(studentKey).update({
            installments: insts,
            updatedAt: new Date().toISOString()
        }).then(() => {
            alert('លុបជោគជ័យ (Deleted successfully)');
            s.installments = insts;
            renderStudentPaymentDetails(s);
        }).catch(err => {
            console.error(err);
            alert('កំហុសក្នុងការលុប');
        }).finally(() => showLoading(false));
    }
}

// Utility: Date formatter
const convertToKhmerDate = (dateStr) => {
    if (!dateStr || ['N/A', '', 'មិនមាន', 'null', 'undefined'].includes(dateStr)) return '';
    if (/[\u1780-\u17FF]/.test(dateStr)) return dateStr;

    const khmerNumerals = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    const toKhmerNum = (num) => num.toString().split('').map(char => {
        const n = parseInt(char);
        return isNaN(n) ? char : khmerNumerals[n];
    }).join('');

    try {
        let d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        const day = String(d.getDate()).padStart(2, '0');
        const month = KHMER_MONTHS[d.getMonth()];
        const year = d.getFullYear();

        return `${day} / ${month} / ${year}`;
    } catch (e) { return dateStr; }
};

function printStudentReceipt(key, index) {
    const s = allStudentsData[key];
    if (!s) return;

    let installments = [];
    if (s.installments) {
        installments = Array.isArray(s.installments) ? s.installments : Object.values(s.installments);
    }

    const inst = installments[index];
    if (!inst) return alert('រកមិនឃើញទិន្នន័យបង់ប្រាក់');

    const amount = parseFloat(inst.amount) || 0;
    const win = window.open('', '_blank', 'width=900,height=700,status=no,toolbar=no,menubar=no,location=no');
    if (!win) {
        alert("Please allow popups for this website to print receipts.");
        return;
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Receipt - ${s.displayId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            body { margin: 0; padding: 20px; background: #555; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; font-family: 'Battambang', sans-serif; }
            .pos-receipt-paper { width: 210mm; height: 148mm; background: white; padding: 15mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; }
            @media print {
                body { background: white; margin: 0; padding: 0; display: block; }
                .pos-receipt-paper { width: 100%; height: 100%; box-shadow: none; margin: 0; padding: 15mm; }
                .no-print { display: none !important; }
                @page { size: A5 landscape; margin: 0; }
            }
            .header-row { display: flex; border-bottom: 3px double #6a11cb; padding-bottom: 10px; margin-bottom: 15px; }
            .logo-col { flex: 0 0 35mm; }
            .text-col { flex: 1; text-align: center; }
            .meta-col { flex: 0 0 40mm; text-align: right; }
            .school-kh { font-family: 'Moul', serif; font-size: 16pt; color: #6a11cb; line-height: 1.2; }
            .school-en { font-size: 10pt; font-weight: bold; color: #2575fc; letter-spacing: 0.5px; margin-top: 5px; }
            .contact { font-size: 8pt; color: #444; margin-top: 5px; line-height: 1.3; }
            .receipt-badge { background: #6a11cb; color: white; padding: 5px 10px; border-radius: 4px; display: inline-block; text-align: center; min-width: 25mm; }
            .receipt-title-kh { font-size: 11pt; font-weight: bold; }
            .receipt-title-en { font-size: 6pt; letter-spacing: 1px; }
            .content-grid { display: flex; gap: 15px; align-items: flex-start; height: 65mm; }
            .left-panel { flex: 1; border: 1px dashed #ccc; padding: 10px; border-radius: 8px; height: 100%; }
            .right-panel { flex: 1.4; height: 100%; }
            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 3px 2px; vertical-align: middle; }
            .info-label { font-size: 9pt; color: #666; }
            .info-val { font-size: 9.5pt; font-weight: bold; color: #000; text-align: right; }
            .invoice-table th { background: #f8f9fa; border-bottom: 2px solid #444; font-size: 9pt; text-align: right; padding: 5px; }
            .invoice-table th:first-child { text-align: left; }
            .invoice-table td { border-bottom: 1px solid #eee; font-size: 9pt; padding: 4px 5px; text-align: right; }
            .invoice-table td:first-child { text-align: left; }
            .total-row td { border-top: 2px solid #333; background: #fffadd; font-weight: bold; font-size: 10pt; padding: 6px 5px; color: black !important; }
            .footer-row { display: flex; margin-top: 10px; border-top: 2px solid #eee; padding-top: 10px; }
            .footer-note { flex: 1.5; font-size: 7.5pt; color: #444; line-height: 1.4; }
            .footer-sig { flex: 1; display: flex; justify-content: space-between; padding-left: 20px; }
            .sig-box { text-align: center; width: 45%; }
            .sig-line { border-top: 1px solid #333; margin-top: 35px; }
            .sig-label { font-size: 8pt; font-weight: bold; }
            .print-fab { position: fixed; bottom: 20px; right: 20px; background: #2575fc; color: white; border: none; border-radius: 50%; width: 60px; height: 60px; font-size: 24px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        </style>
    </head>
    <body>
        <button class="print-fab no-print" onclick="window.print()"><i class="fa fa-print"></i></button>
        <div class="pos-receipt-paper">
            <div class="header-row">
                <div class="logo-col"><img src="img/logo.jpg" style="width:100%;"></div>
                <div class="text-col">
                    <div class="school-kh">សាលាអន្តរជាតិ អាយធី ឃេ</div>
                    <div class="school-en">ITK INTERNATIONAL SCHOOL</div>
                    <div class="contact">ក្រុងកំពត ខេត្តកំពត<br>Tel: 093 83 56 78</div>
                </div>
                <div class="meta-col">
                    <div class="receipt-badge">
                        <div class="receipt-title-kh">វិក្កយបត្រ</div>
                        <div class="receipt-title-en">RECEIPT</div>
                    </div>
                    <div style="font-size:9pt; font-weight:bold; margin-top:8px;">No: ${s.displayId}-${index + 1}</div>
                </div>
            </div>
            <div class="content-grid">
                <div class="left-panel">
                    <div style="font-weight:bold; font-size:10pt; color:#6a11cb; border-bottom:1px solid #eee; margin-bottom:5px;">ព័ត៌មានសិស្ស</div>
                    <table>
                        <tr><td class="info-label">ឈ្មោះ / Name:</td><td class="info-val">${s.lastName} ${s.firstName}</td></tr>
                        <tr><td class="info-label">ភេទ / Gender:</td><td class="info-val">${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td></tr>
                        <tr><td class="info-label">កម្រិត / Level:</td><td class="info-val">${s.studyLevel || '-'}</td></tr>
                        <tr><td class="info-label">ម៉ោង / Time:</td><td class="info-val">${s.studyTime || '-'}</td></tr>
                        <tr><td class="info-label">ថ្ងៃបង់ / Date:</td><td class="info-val">${convertToKhmerDate(inst.date)}</td></tr>
                    </table>
                </div>
                <div class="right-panel">
                    <table class="invoice-table">
                        <thead><tr><th>បរិយាយ (Description)</th><th width="30%">តម្លៃ (Price)</th></tr></thead>
                        <tbody>
                            <tr><td>ថ្លៃសិក្សា (Tuition Fee) - ${inst.forMonth || (inst.months + ' ខែ')}</td><td>$${amount.toFixed(2)}</td></tr>
                            ${inst.note ? `<tr><td style="font-style:italic; font-size:8pt; color:#666;">* ${inst.note}</td><td></td></tr>` : ''}
                        </tbody>
                        <tfoot>
                            <tr class="total-row"><td>សរុបបង់ / TOTAL PAID:</td><td>$${amount.toFixed(2)}</td></tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <div class="footer-row">
                <div class="footer-note">
                    <div style="font-weight:bold; text-decoration:underline;">ចំណាំ / Note:</div>
                    <div>1. ប្រាក់បង់រួច មិនអាចដកវិញបានទេ (Non-refundable)</div>
                    <div>2. សូមពិនិត្យបង្កាន់ដៃមុនចាកចេញ (Check before leaving)</div>
                    <div style="margin-top:5px; font-size:7pt;">Printed: ${new Date().toLocaleString()}</div>
                </div>
                <div class="footer-sig">
                    <div class="sig-box"><div class="sig-label">អ្នកបង់ប្រាក់</div><div class="sig-line"></div></div>
                    <div class="sig-box"><div class="sig-label">អ្នកទទួល (${inst.receiver || '-'})</div><div class="sig-line"></div></div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
    win.document.write(html);
    win.document.close();
}
// Monthly Payment Tracking logic
function openMonthlyTrackingModal() {
    const monthSelectorHtml = `
        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <div class="d-flex align-items-center gap-3 bg-white p-3 rounded-4 shadow-sm border">
                    <label class="fw-bold text-muted mb-0"><i class="fi fi-rr-calendar-lines me-2"></i>ខែ:</label>
                    <select id="trackingMonth" class="form-select border-0 bg-light rounded-pill px-4" onchange="renderMonthlyTracking()">
                        ${KHMER_MONTHS.map(m => `<option value="${m}" ${KHMER_MONTHS[new Date().getMonth()] === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                    <select id="trackingYear" class="form-select border-0 bg-light rounded-pill px-4" onchange="renderMonthlyTracking()">
                        ${[2024, 2025, 2026].map(y => `<option value="${y}" ${new Date().getFullYear() === y ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="col-md-6">
                <div class="d-flex align-items-center gap-2 h-100">
                    <div class="flex-grow-1 bg-white p-3 rounded-4 shadow-sm border d-flex justify-content-around text-center">
                        <div>
                            <div class="text-success fw-bold" id="countPaid">0</div>
                            <small class="text-muted" style="font-size: 0.65rem;">បង់រួច</small>
                        </div>
                        <div class="border-start"></div>
                        <div>
                            <div class="text-danger fw-bold" id="countOverdue">0</div>
                            <small class="text-muted" style="font-size: 0.65rem;">ហួសកំណត់</small>
                        </div>
                        <div class="border-start"></div>
                        <div>
                            <div class="text-primary fw-bold" id="countToday">0</div>
                            <small class="text-muted" style="font-size: 0.65rem;">បង់ថ្ងៃនេះ</small>
                        </div>
                        <div class="border-start"></div>
                        <div>
                            <div class="text-warning fw-bold" id="countSoon">0</div>
                            <small class="text-muted" style="font-size: 0.65rem;">ជិតដល់ថ្ងៃ</small>
                        </div>
                        <div class="border-start"></div>
                        <div>
                            <div class="text-secondary fw-bold" id="countUnpaid">0</div>
                            <small class="text-muted" style="font-size: 0.65rem;">មិនទាន់បង់</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="monthlyTrackingResults" class="row g-3 overflow-auto" style="max-height: 60vh;">
            <!-- Results filled by JS -->
        </div>
    `;

    Swal.fire({
        title: 'តាមដានការបង់ប្រាក់សិស្សប្រចាំខែ',
        html: monthSelectorHtml,
        width: '90%',
        showConfirmButton: false,
        showCloseButton: true,
        background: '#f8f9fa',
        didOpen: () => {
            renderMonthlyTracking();
        }
    });
}

function renderMonthlyTracking() {
    const month = document.getElementById('trackingMonth').value;
    const year = document.getElementById('trackingYear').value;
    const results = document.getElementById('monthlyTrackingResults');
    if (!results) return;

    const students = Object.values(allStudentsData).filter(s => s.enrollmentStatus !== 'dropout');
    students.sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName, 'km'));

    const now = new Date();
    // Reset time for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let cPaid = 0, cOverdue = 0, cSoon = 0, cUnpaid = 0, cToday = 0;

    results.innerHTML = students.map(s => {
        let isPaid = false;
        if (s.installments) {
            const insts = Array.isArray(s.installments) ? s.installments : Object.values(s.installments);
            isPaid = insts.some(i => i.forMonth && i.forMonth.includes(month));
        }

        let statusKh = isPaid ? 'បង់រួច' : 'មិនទាន់បង់';
        let statusClass = isPaid ? 'bg-success' : 'bg-secondary';
        let borderClass = isPaid ? 'border-success' : 'border-light';
        let daysText = '';

        if (!isPaid) {
            const ps = getPaymentStatus(s);
            if (ps.status === 'overdue') {
                statusKh = 'ហួសកំណត់';
                statusClass = 'bg-danger pulse-urgent';
                borderClass = 'border-danger';
                daysText = `<span class="text-danger fw-bold">(ហួស ${Math.abs(ps.daysRemaining)} ថ្ងៃ)</span>`;
                cOverdue++;
            } else if (ps.status === 'today') {
                statusKh = 'ត្រូវបង់ថ្ងៃនេះ';
                statusClass = 'bg-primary';
                borderClass = 'border-primary';
                cToday++;
            } else if (ps.status === 'warning') {
                statusKh = 'ជិតដល់ថ្ងៃ';
                statusClass = 'bg-warning text-dark';
                borderClass = 'border-warning';
                daysText = `<span class="text-warning fw-bold">(នៅសល់ ${ps.daysRemaining} ថ្ងៃ)</span>`;
                cSoon++;
            } else {
                cUnpaid++;
            }
        } else {
            cPaid++;
        }

        return `
            <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 border-start border-4 tracking-card ${borderClass}" style="border-radius: 12px; transition: transform 0.2s;" onclick="selectStudentForPayment('${s.key}'); Swal.close();">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-center">
                                <div class="bg-light text-primary rounded-circle p-2 me-2" style="width: 35px; height: 35px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fi fi-rr-user"></i>
                                </div>
                                <div style="max-width: 120px;">
                                    <div class="fw-bold small text-dark text-truncate">${s.lastName} ${s.firstName}</div>
                                    <div class="text-muted" style="font-size: 0.61rem;">ID: ${s.displayId} | ${s.studyTime || '-'}</div>
                                </div>
                            </div>
                            <span class="badge ${statusClass} rounded-pill shadow-sm" style="font-size: 0.6rem; padding: 4px 8px;">
                                ${statusKh}
                            </span>
                        </div>
                        <div class="mt-2 d-flex justify-content-between align-items-center" style="font-size: 0.65rem;">
                            <div class="text-muted"><i class="fi fi-rr-calendar-clock me-1"></i>${convertToKhmerDate(s.nextPaymentDate) || 'មិនមាន'}</div>
                            ${daysText}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('countPaid').textContent = cPaid;
    document.getElementById('countOverdue').textContent = cOverdue;
    document.getElementById('countToday').textContent = cToday;
    document.getElementById('countSoon').textContent = cSoon;
    document.getElementById('countUnpaid').textContent = cUnpaid;
}
