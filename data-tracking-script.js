/**
 * data-tracking-script.js
 * Script for managing student data display from Firebase Realtime Database
 * Features: View details, Edit (real-time update), Delete, Mark as Paid, Search (DataTables), Reports
 */

// Global Variables
let studentDataTable;
let allStudentsData = {};
const studentsRef = firebase.database().ref('students');
let studentDetailsModal = null;

// Custom Khmer Locale for Flatpickr
const KhmerLocaleFlatpickr = {
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


// Statistics
let statistics = {


    total: 0,
    paid: 0,
    pending: 0,
    installment: 0,
    warning: 0,
    overdue: 0
};

// Alert notifications
let notifications = {
    overdue: [],
    warning: []
};

// Current filters state
let currentFilters = {
    searchName: '',
    status: 'all',
    filterTime: 'all',
    filterLevel: 'all',
    gender: 'all',
    startDate: '',
    endDate: ''
};

// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------

const getDateObject = (dateStr) => {
    if (!dateStr || ['មិនមាន', 'N/A', ''].includes(dateStr)) return null;
    const engDate = convertToEnglishDate(dateStr);
    if (!engDate) return null;
    const parts = engDate.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[0] - 1, parts[1]);
    }
    return null;
};

const filterStudents = (studentsArray) => {
    return studentsArray.filter(s => {
        // 1. Name Search (Moved to Top Priority)
        if (currentFilters.searchName) {
            const rawTerm = currentFilters.searchName.toLowerCase().trim();
            if (rawTerm) {
                // Tokenize search term
                const tokens = rawTerm.split(/\s+/);

                const searchableText = [
                    s.lastName || '',
                    s.firstName || '',
                    s.chineseLastName || '',
                    s.chineseFirstName || '',
                    s.englishLastName || '',
                    s.englishFirstName || '',
                    s.englishName || '',
                    s.displayId || '',
                    `${s.lastName || ''}${s.firstName || ''}`, // Combined no space
                    `${s.englishLastName || ''}${s.englishFirstName || ''}`
                ].join(' ').toLowerCase();

                // Check if ALL tokens are present in the searchable text
                const matchesAll = tokens.every(token => searchableText.includes(token));

                if (!matchesAll) return false;

                // If search matches, show student regardless of other selected filters (Get all of them)
                return true;
            }
        }

        // 0. Enrollment Status Filter (Global Flag)
        const isDropout = s.enrollmentStatus === 'dropout';
        const isGraduated = s.status === 'graduated';

        if (window.SHOW_DROPOUTS) {
            if (!isDropout) return false;
        } else {
            if (isDropout || isGraduated) return false;
        }

        // 2. Status Filter
        if (currentFilters.status !== 'all') {
            const statusObj = getPaymentStatus(s);
            if (statusObj.status !== currentFilters.status) return false;
        }

        // 3. Time Filter
        if (currentFilters.filterTime !== 'all') {
            const sTime = (s.studyTime || '').trim();
            if (sTime !== currentFilters.filterTime) return false;
        }

        // 4. Level Filter
        if (currentFilters.filterLevel !== 'all') {
            const sLevel = (s.studyLevel || '').trim();
            if (sLevel !== currentFilters.filterLevel) return false;
        }

        // 5. Gender Filter
        if (currentFilters.gender !== 'all') {
            if (s.gender !== currentFilters.gender) return false;
        }

        // 6. Date Range Filter
        if (currentFilters.startDate || currentFilters.endDate) {
            const studentDate = getDateObject(s.startDate);
            if (!studentDate) return false;

            // Reset hours to compare only dates
            studentDate.setHours(0, 0, 0, 0);

            if (currentFilters.startDate) {
                const [y, m, d] = currentFilters.startDate.split('-').map(Number);
                const start = new Date(y, m - 1, d); // Local Midnight
                start.setHours(0, 0, 0, 0);
                if (studentDate < start) return false;
            }

            if (currentFilters.endDate) {
                const [y, m, d] = currentFilters.endDate.split('-').map(Number);
                const end = new Date(y, m - 1, d); // Local Midnight
                end.setHours(23, 59, 59, 999);
                if (studentDate > end) return false;
            }
        }

        return true;
    });
};

const showAlert = (message, type = 'success', duration = 5000) => {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const wrapper = document.createElement('div');
    const iconMap = {
        'success': 'check-circle',
        'danger': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };

    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible fade show" role="alert" style="min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 12px; border: none; margin-bottom: 10px;">`,
        ` <div class="d-flex align-items-center"><i class="fi fi-rr-${iconMap[type] || 'info-circle'} me-3 fa-lg"></i><div>${message}</div></div>`,
        ' <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
        '</div>'
    ].join('');

    const existingAlerts = alertContainer.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    alertContainer.append(wrapper);

    setTimeout(() => {
        if (wrapper.parentNode) {
            $(wrapper).fadeOut(500, function () { $(this).remove(); });
        }
    }, duration);
};

const showLoading = (isLoading) => {
    const loader = document.getElementById('global-loader');
    if (!loader) return;

    if (isLoading) {
        loader.style.display = 'flex';
        // Force reflow to ensure valid transition
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
};

/*
 * Payment Calculation Functions moved to report-functions.js to be shared with Income/Expense page
 *
 * calculateTotalAmount
 * calculateTotalPaid
 * calculateRemainingAmount
 * getPaymentStatus
 */


// ----------------------------------------------------
// Date Conversion Functions
// ----------------------------------------------------

const KHMER_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];

const formatKhmerMonthDate = (dateStr) => {
    if (!dateStr || ['N/A', '', 'មិនមាន'].includes(dateStr)) return '';
    try {
        let d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                d = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        if (isNaN(d.getTime())) return dateStr;
        const day = d.getDate().toString().padStart(2, '0');
        const monthName = KHMER_MONTHS[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${monthName}-${year}`;
    } catch (e) { return dateStr; }
};

const parseKhmerMonthDate = (khmerStr) => {
    try {
        if (!khmerStr) return new Date().toISOString();
        const parts = khmerStr.split('-');
        if (parts.length !== 3) return khmerStr; // Return original if not matching format

        const day = parseInt(parts[0]);
        const monthIndex = KHMER_MONTHS.indexOf(parts[1]);
        const year = parseInt(parts[2]);

        if (monthIndex === -1) return new Date().toISOString();

        const d = new Date(year, monthIndex, day);
        d.setHours(12, 0, 0, 0);
        return d.toISOString();
    } catch (e) { return new Date().toISOString(); }
};

const getLastPaidAmount = (s) => {
    let lastAmount = parseFloat(s.initialPayment) || 0;

    // If installments exist, take amount of last one
    if (s.installments) {
        let installs = [];
        if (Array.isArray(s.installments)) {
            installs = s.installments;
        } else {
            // Object: ensure we sort by key or date to find the "last" one
            // Firebase keys are chronological if pushed, but if manual keys (0, 1, 2) it works too.
            // Let's sort by keys to be safe.
            const keys = Object.keys(s.installments).sort((a, b) => {
                // Try numeric sort
                if (!isNaN(a) && !isNaN(b)) return Number(a) - Number(b);
                return a.localeCompare(b);
            });
            installs = keys.map(k => s.installments[k]);
        }

        // Iterate and keep the last one that has a real value
        installs.forEach(inst => {
            const amt = parseFloat(inst.amount) || 0;
            if (amt > 0) {
                lastAmount = amt;
            }
        });
    }
    return lastAmount;
};

const getPaidSummaryHtml = (s) => {
    let yearSummary = {};
    let grandTotal = 0;

    const installs = s.installments ? (Array.isArray(s.installments) ? s.installments : Object.values(s.installments)) : [];

    // Check initial payment
    if (s.initialPayment > 0) {
        let d = new Date(s.startDate);
        if (!isNaN(d.getTime())) {
            let year = d.getFullYear();
            if (!yearSummary[year]) yearSummary[year] = { total: 0, list: [] };
            const initialItem = {
                date: s.startDate,
                amount: s.initialPayment,
                stage: 'ដំបូង',
                months: s.paymentMonths || '1',
                receiver: s.receiver || 'Admin'
            };
            yearSummary[year].list.push(initialItem);
            yearSummary[year].total += parseFloat(s.initialPayment);
            grandTotal += parseFloat(s.initialPayment);
        }
    }

    installs.forEach(inst => {
        if (!inst.date) return;
        let d = new Date(inst.date);
        if (isNaN(d.getTime())) return;

        let year = d.getFullYear();
        let amt = (parseFloat(inst.amount) || 0);

        if (!yearSummary[year]) yearSummary[year] = { total: 0, list: [] };

        yearSummary[year].list.push(inst);
        yearSummary[year].total += amt;
        grandTotal += amt;
    });

    if (Object.keys(yearSummary).length === 0 && grandTotal === 0) {
        return `<div class="text-center py-4 text-muted"><i class="fi fi-rr-info fs-3 mb-2"></i><br>មិនទាន់មានប្រវត្តិបង់ប្រាក់នៅឡើយទេ</div>`;
    }

    let html = `<div class="payment-history-container">
        <h6 class="fw-bold small text-muted mb-3"><i class="fi fi-rr-time-forward me-2"></i>ប្រវត្តិបង់ប្រាក់សរុប (Payment Timeline)</h6>
        <div class="accordion accordion-flush bg-light rounded-4 overflow-hidden border border-light-subtle" id="paymentSummaryAccordion">`;

    // Sort years descending
    Object.keys(yearSummary).sort().reverse().forEach((year, idx) => {
        const yData = yearSummary[year];
        const isExpanded = idx === 0 ? 'show' : '';
        const collapsed = idx === 0 ? '' : 'collapsed';

        // Sort items by date descending
        yData.list.sort((a, b) => new Date(b.date) - new Date(a.date));

        html += `
            <div class="accordion-item border-0 bg-transparent">
                <h2 class="accordion-header">
                    <button class="accordion-button ${collapsed} py-3 bg-white bg-opacity-50 small fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseYear${year}">
                        <div class="d-flex w-100 justify-content-between align-items-center me-3">
                            <span class="text-dark"><i class="fi fi-rr-calendar-lines me-2 text-primary"></i>ឆ្នាំ ${year}</span>
                            <span class="bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill">$${yData.total.toFixed(2)}</span>
                        </div>
                    </button>
                </h2>
                <div id="collapseYear${year}" class="accordion-collapse collapse ${isExpanded}" data-bs-parent="#paymentSummaryAccordion">
                    <div class="accordion-body p-0">
                        <div class="table-responsive">
                            <table class="table table-sm table-hover mb-0" style="font-size: 0.85rem;">
                                <thead class="bg-light text-muted">
                                    <tr>
                                        <th class="ps-4">កាលបរិច្ឆេទ</th>
                                        <th>ទឹកប្រាក់</th>
                                        <th class="text-center">លើកទី</th>
                                        <th class="text-center">ចំនួនខែ</th>
                                        <th class="pe-4">អ្នកទទួល</th>
                                    </tr>
                                </thead>
                                <tbody>`;

        yData.list.forEach(item => {
            html += `
                                    <tr class="align-middle border-bottom border-light">
                                        <td class="ps-4 py-2">${toKhmerDate(item.date)}</td>
                                        <td class="fw-bold text-success">$${(parseFloat(item.amount) || 0).toFixed(2)}</td>
                                        <td class="text-center"><span class="badge bg-light text-dark border fw-normal">${item.stage || '-'}</span></td>
                                        <td class="text-center">${item.months || 1} ខែ</td>
                                        <td class="pe-4 text-secondary small">${item.receiver || '-'}</td>
                                    </tr>`;
        });

        html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    html += `</div>
        <div class="row g-2 mt-3">
            <div class="col-6">
                <div class="p-3 bg-success bg-opacity-10 rounded-4 border border-success border-opacity-25 h-100">
                    <div class="text-success small fw-bold mb-1">បង់សរុប (Total Paid)</div>
                    <div class="h5 mb-0 fw-bold text-success">$${grandTotal.toFixed(2)}</div>
                </div>
            </div>
            <div class="col-6">
                <div class="p-3 bg-danger bg-opacity-10 rounded-4 border border-danger border-opacity-25 h-100">
                    <div class="text-danger small fw-bold mb-1">នៅខ្វះ (Outstanding)</div>
                    <div class="h5 mb-0 fw-bold text-danger">$${calculateRemainingAmount(s).toFixed(2)}</div>
                </div>
            </div>
        </div>
    </div>`;
    return html;
};
const KhmerLocale = {
    weekdays: {
        shorthand: ["អា", "ច", "អង្គ", "ពុ", "ព្រ", "សុ", "ស"],
        longhand: ["អាទិត្យ", "ច័ន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"],
    },
    months: {
        shorthand: ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"],
        longhand: ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"],
    }
};

/*
 * Date Helper Functions moved to report-functions.js
 *
 * toKhmerDate
 * convertToEnglishDate
 * convertKhmerNum
 */




const safeDateValue = (dateStr) => {
    if (!dateStr) return '';
    // If it's already YYYY-MM-DD, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Try converting from English US format MM/DD/YYYY
    const engDate = convertToEnglishDate(dateStr);
    if (engDate) {
        const d = new Date(engDate);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }
    return ''; // Return empty if invalid so flatpickr doesn't crash
};

const formatDueDateWithColor = (student) => {
    if (!student) return '<span class="text-muted">មិនមាន</span>';

    // Check both possible date fields
    const dateStr = student.dueDate || student.nextPaymentDate || '';

    if (['មិនមាន', 'N/A', '', null, undefined].includes(dateStr)) {
        return '<span class="text-muted">មិនមាន</span>';
    }

    const khDate = toKhmerDate(dateStr);
    const status = getPaymentStatus(student);

    if (status.status === 'overdue') {
        return `<span class="overdue text-danger fw-bold">${khDate} (ហួស ${Math.abs(status.daysRemaining)} ថ្ងៃ)</span>`;
    }
    if (status.status === 'today') {
        return `<span class="text-primary fw-bold" style="color:#0d6efd !important;">${khDate} (ថ្ងៃនេះ)</span>`;
    }
    if (status.status === 'warning') {
        return `<span class="due-soon text-warning fw-bold">${khDate} (${status.daysRemaining} ថ្ងៃ)</span>`;
    }

    return `<span class="normal-due">${khDate}</span>`;
};

const formatStudyType = (student) => {
    if (!student) return 'មិនមាន';
    const types = { 'cFullTime': 'ចិនពេញម៉ោង', 'cPartTime': 'ចិនក្រៅម៉ោង', 'eFullTime': 'អង់គ្លេសពេញម៉ោង', 'ePartTime': 'អង់គ្លេសក្រៅម៉ោង' };
    return types[student.studyType] || student.studyType || 'មិនមាន';
};

const populateDynamicFilters = (students) => {
    // Helper to populate a select element
    const populateSelect = (elementId, attribute, defaultText, customSort) => {
        const select = document.getElementById(elementId);
        if (!select) return;

        // Get unique values
        const values = new Set();
        students.forEach(s => {
            if (s[attribute]) {
                const val = s[attribute].trim();
                // Avoid empty or N/A values if desired, or keep them
                if (val && !['N/A', 'មិនមាន', ''].includes(val)) {
                    values.add(val);
                }
            }
        });

        const sortedValues = Array.from(values).sort(customSort || ((a, b) => a.localeCompare(b)));
        const currentValue = select.value; // Store current selection

        // Rebuild options but keep the first 'All' option or any option with value="all"
        let allOption = select.querySelector('option[value="all"]');
        if (!allOption) allOption = new Option(defaultText, "all");

        select.innerHTML = '';
        select.appendChild(allOption);

        sortedValues.forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val;
            select.appendChild(option);
        });

        // Restore selection if it still exists, otherwise default to all
        if (sortedValues.includes(currentValue)) {
            select.value = currentValue;
        } else {
            select.value = 'all';
            // Update filter state if the selected option disappeared (optional, but safer)
            if (attribute === 'studyTime') currentFilters.filterTime = 'all';
            if (attribute === 'studyLevel') currentFilters.filterLevel = 'all';
        }
    };

    // Custom sort for times (simple string sort might be enough, but time sort is better)
    const timeSort = (a, b) => {
        // Simple heuristic: compare start hour
        const getStartHour = (t) => parseInt(t.split(':')[0]) || 0;
        return getStartHour(a) - getStartHour(b);
    };

    // Custom sort for levels (try to sort by level number)
    const levelSort = (a, b) => {
        const getLevelNum = (l) => {
            if (l.includes('មូលដ្ឋាន')) return 0;
            const match = l.match(/(\d+)/);
            return match ? parseInt(match[1]) : 99;
        };
        return getLevelNum(a) - getLevelNum(b);
    };

    populateSelect('filterTime', 'studyTime', '🔍 ទាំងអស់ (ម៉ោង)', timeSort);
    populateSelect('filterLevel', 'studyLevel', '🎓 ទាំងអស់ (កម្រិត)', levelSort);
};

// ----------------------------------------------------
// Core Functions: Loading & Rendering
// ----------------------------------------------------

let rawStudentsArray = [];

const renderFilteredTable = () => {
    const filteredArray = filterStudents(rawStudentsArray);

    if (window.SHOW_OVERDUE_REPORT) {
        renderOverdueReport(filteredArray);
    } else {
        renderTableData(filteredArray);
    }
    updateStatistics(rawStudentsArray); // Stats usually show based on all data
};

const loadStudentData = () => {
    showLoading(true);
    studentsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        allStudentsData = {};
        rawStudentsArray = [];

        if (data) {
            Object.keys(data).forEach(key => {
                const s = data[key];
                if (s && (s.displayId || s.lastName)) {
                    s.key = key;
                    allStudentsData[key] = s;
                    rawStudentsArray.push(s);
                }
            });

            rawStudentsArray.sort((a, b) => {
                const idA = (a.displayId || '').toString();
                const idB = (b.displayId || '').toString();
                return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        populateDynamicFilters(rawStudentsArray);
        if (typeof populateReportPickers === 'function') populateReportPickers(rawStudentsArray);
        // setupSearchListener(); // Removed to prevent duplicate binding. Listener is set once in $(document).ready
        renderFilteredTable();
        if (!window.SHOW_DROPOUTS) {
            checkPaymentAlerts(allStudentsData);

            if (typeof isFirstLoad === 'undefined') window.isFirstLoad = true;
            if (window.isFirstLoad) {
                checkAllPayments();
                window.isFirstLoad = false;
            }
        }

        showLoading(false);
    }, (error) => {
        console.error("Firebase Error:", error);
        showAlert(`Error: ${error.message}`, 'danger');
        showLoading(false);
    });
};

function updateStatistics(students) {
    const stats = { total: 0, paid: 0, pending: 0, installment: 0, warning: 0, overdue: 0 };
    let totalIncome = 0;
    let totalOutstanding = 0;

    students.forEach(s => {
        stats.total++;
        const status = getPaymentStatus(s).status;
        if (stats.hasOwnProperty(status)) stats[status]++;
        else if (status === 'warning') stats.warning++;
        else if (status === 'overdue') stats.overdue++;

        // Financials
        totalIncome += calculateTotalPaid(s);
        totalOutstanding += calculateRemainingAmount(s);
    });

    statistics = stats;

    // Update UI Cards
    const statTotalStudents = document.getElementById('statTotalStudents');
    const statTotalIncome = document.getElementById('statTotalIncome');
    const statTotalOutstanding = document.getElementById('statTotalOutstanding');

    if (statTotalStudents) statTotalStudents.innerText = `${stats.total} នាក់`;
    if (statTotalIncome) statTotalIncome.innerText = `$${totalIncome.toFixed(2)}`;
    if (statTotalOutstanding) statTotalOutstanding.innerText = `$${totalOutstanding.toFixed(2)}`;

    // Update Dropout Page Statistics if present
    if (window.SHOW_DROPOUTS) {
        const statTotalDropout = document.getElementById('statTotalDropout');
        const statDropoutMale = document.getElementById('statDropoutMale');
        const statDropoutFemale = document.getElementById('statDropoutFemale');
        const statDropoutDebt = document.getElementById('statDropoutDebt');
        const statDropoutMonth = document.getElementById('statDropoutMonth');

        if (statTotalDropout) {
            const maleCount = students.filter(s => s.gender === 'ប្រុស' || s.gender === 'Male').length;
            const femaleCount = students.filter(s => s.gender === 'ស្រី' || s.gender === 'Female').length;

            statTotalDropout.innerText = `${students.length} នាក់`;
            if (statDropoutMale) statDropoutMale.innerText = maleCount;
            if (statDropoutFemale) statDropoutFemale.innerText = femaleCount;
        }

        if (statDropoutDebt) {
            statDropoutDebt.innerText = `$${totalOutstanding.toFixed(2)}`;
        }

        if (statDropoutMonth) {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const thisMonthCount = students.filter(s => {
                // Check dropoutDate first, if not convert lastUpdated
                const dStr = s.dropoutDate || s.lastUpdated;
                if (!dStr) return false;
                const d = new Date(dStr);
                return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            }).length;
            statDropoutMonth.innerText = `${thisMonthCount} នាក់`;
        }
    }
}

function renderTableData(studentsArray) {
    const tableId = '#studentTable';
    const tbody = document.querySelector(tableId + ' tbody');
    if (!tbody) return;

    // Helper to build row HTML content
    const buildRowContent = (s, i) => {
        const total = calculateTotalAmount(s);
        const remaining = calculateRemainingAmount(s);
        const status = getPaymentStatus(s);

        // Hidden search terms
        const searchTerms = `${s.lastName || ''}${s.firstName || ''} ${s.chineseLastName || ''} ${s.chineseFirstName || ''} ${s.displayId || ''}`.toLowerCase();

        // 1. DROPOUT STUDENTS TABLE LAYOUT
        if (window.SHOW_DROPOUTS) {
            return `
                <td class="fw-bold text-secondary">${i + 1}</td>
                <td><span class="badge bg-light text-dark border shadow-sm">${s.displayId}</span></td>
                <td class="text-start align-middle" onclick="viewStudentDetails('${s.key}')" style="cursor: pointer;">
                    <div class="fw-bold text-dark text-nowrap">${s.lastName || ''} ${s.firstName || ''}</div>
                    <div class="small text-muted">${s.englishName || ''}</div>
                    <span class="d-none">${searchTerms}</span>
                </td>
                <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                <td>${s.studyLevel || '-'}</td>
                <td>${formatStudyType(s)}</td> <!-- Subject/Type -->
                <td>${s.studyTime || '-'}</td>
                <td class="text-start">${s.teacherName || '-'}</td>
                <td>${s.fatherPhone || s.motherPhone || s.personalPhone || '-'}</td>
                <td><span class="badge bg-danger">បោះបង់</span></td>
                <td>
                    <div class="d-flex gap-1 justify-content-center">
                        <button type="button" class="btn btn-success btn-sm shadow-sm" onclick="restoreStudent('${s.key}')" title="ចូលរៀនវិញ" style="padding: 4px 10px;">
                            <i class="fi fi-rr-user-add"></i> ចូលរៀនវិញ
                        </button>
                    </div>
                </td>`;
        }

        // 2. STANDARD DATA TRACKING TABLE LAYOUT
        else {
            return `
                <td class="fw-bold text-secondary">${i + 1}</td>
                <td><span class="badge bg-light text-dark border shadow-sm">${s.displayId}</span></td>
                <td class="text-start align-middle" onclick="viewStudentDetails('${s.key}')" style="cursor: pointer;">
                    <div class="fw-bold text-dark text-nowrap">${s.lastName || ''} ${s.firstName || ''}</div>
                    <div class="small text-muted">${s.englishName || ''}</div>
                    <span class="d-none">${searchTerms}</span>
                </td>
                <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                <td>${s.studyLevel || '-'}</td>
                <td class="text-start">${s.teacherName || '-'}</td>
                <td>${toKhmerDate(s.startDate)}</td>
                <td>${formatDueDateWithColor(s)}</td>
                <td><i class="fi fi-rr-calendar-check me-1 text-secondary small"></i>${s.paymentMonths || 1} ខែ</td>
                <td class="fw-bold text-dark">$${total.toFixed(2)}</td>
                <td class="fw-bold text-primary">$${calculateTotalPaid(s).toFixed(2)}</td>
                <td class="fw-bold ${remaining > 0 ? 'text-danger' : 'text-success'}">
                    $${remaining.toFixed(2)}
                </td>
                <td>
                    <span class="payment-status-badge ${status.badge} shadow-sm">
                        ${status.text}
                    </span>
                </td>
                <td>
                    <div class="d-flex gap-1 justify-content-center">
                        <button type="button" class="btn btn-warning btn-sm edit-btn shadow-sm" data-key="${s.key}" title="កែប្រែ" style="padding: 4px 10px;">
                            <i class="fi fi-rr-edit"></i>
                        </button>
                        ${remaining > 0 ? `<a href="income-expense.html?studentKey=${s.key}" class="btn btn-success btn-sm shadow-sm" title="បង់ប្រាក់" style="padding: 4px 10px;">
                            <i class="fi fi-rr-receipt"></i>
                        </a>` : ''}
                    </div>
                </td>`;
        }
    };

    // 4. Add Rows (as Nodes) to avoid Destroy/Rebuild (Fixes fnGetData error)
    // Initialize if not exists
    if (!$.fn.DataTable.isDataTable(tableId)) {
        initializeDataTable();
    }

    const table = $(tableId).DataTable();
    const currentPage = table.page();

    table.clear();

    if (studentsArray.length > 0) {
        const tempDiv = document.createElement('tbody');
        let html = '';
        studentsArray.forEach((s, i) => {
            html += `<tr class="align-middle text-center animate__animated animate__fadeIn" style="font-size: 10px;">${buildRowContent(s, i)}</tr>`;
        });
        tempDiv.innerHTML = html;
        table.rows.add(Array.from(tempDiv.children));
    }

    table.draw(false);

    // Restore Page
    if (currentPage > 0 && currentPage < table.page.info().pages) {
        table.page(currentPage).draw(false);
    }

    updateDashboardCounts(studentsArray);
}

function updateDashboardCounts(studentsArray) {
    // Update Display Counts
    const count = studentsArray.length;
    if (document.getElementById('displayCount')) document.getElementById('displayCount').textContent = count;
    if (document.getElementById('totalDisplayCount')) document.getElementById('totalDisplayCount').textContent = count;

    // Calculate Gender Counts
    const maleCount = studentsArray.filter(s => s.gender === 'ប្រុស' || s.gender === 'Male').length;
    const femaleCount = studentsArray.filter(s => s.gender === 'ស្រី' || s.gender === 'Female').length;

    // Update Gender Display Elements
    const totalStudentCountEl = document.getElementById('totalStudentCount');
    const maleStudentCountEl = document.getElementById('maleStudentCount');
    const femaleStudentCountEl = document.getElementById('femaleStudentCount');

    if (totalStudentCountEl) totalStudentCountEl.textContent = count;
    if (maleStudentCountEl) maleStudentCountEl.textContent = maleCount;
    if (femaleStudentCountEl) femaleStudentCountEl.textContent = femaleCount;
}

function initializeDataTable() {
    if (!$.fn.DataTable.isDataTable('#studentTable')) {
        studentDataTable = $('#studentTable').DataTable({
            pagingType: 'full_numbers',
            dom: '<"row mb-3"<"col-md-12"l>>rt<"row mt-3 align-items-center"<"col-md-6"i><"col-md-6 d-flex justify-content-end"p>><"clear">',
            columnDefs: [{ orderable: false, targets: [13] }],
            order: [[1, 'asc']], // Order by Student ID
            language: {
                "sProcessing": "កំពុងដំណើរការ...",
                "sLengthMenu": "បង្ហាញ _MENU_ ទិន្នន័យ",
                "sZeroRecords": "មិនមានទិន្នន័យនៅក្នុងតារាងនេះទេ",
                "sEmptyTable": "មិនមានទិន្នន័យនៅក្នុងតារាងនេះទេ",
                "sInfo": "បង្ហាញ _START_ ទៅ _END_ នៃ _TOTAL_ ទិន្នន័យ",
                "sInfoEmpty": "បង្ហាញ 0 ទៅ 0 នៃ 0 ទិន្នន័យ",
                "sInfoFiltered": "(បានច្រោះចេញពីទិន្នន័យសរុប _MAX_)",
                "sInfoPostFix": "",
                "sSearch": "ស្វែងរក:",
                "sUrl": "",
                "sInfoThousands": ",",
                "sLoadingRecords": "កំពុងដំណើរការ...",
                "oPaginate": {
                    "sFirst": "ដំបូង",
                    "sLast": "ចុងក្រោយ",
                    "sNext": "បន្ទាប់",
                    "sPrevious": "ថយក្រោយ"
                },
                "oAria": {
                    "sSortAscending": ": ធ្វើឱ្យសកម្មដើម្បីរៀបចំជួរឈរតាមលំដាប់ឡើង",
                    "sSortDescending": ": ធ្វើឱ្យសកម្មដើម្បីរៀបចំជួរឈរតាមលំដាប់ចុះ"
                }
            }
        });
    }
}


// ==========================================
// OVERDUE REPORT GENERATION
// ==========================================
function renderOverdueReport(studentsArray) {
    const container = document.getElementById('overdueReportContainer');
    if (!container) return;

    container.innerHTML = '';

    // 1. Filter relevant students (Overdue, Warning, Pending/Unpaid)
    // We want students who owe money or are late
    const reportData = studentsArray.filter(s => {
        const paymentStatus = getPaymentStatus(s);
        const debt = calculateRemainingAmount(s);
        const isDebt = debt > 0;

        // Include if Overdue OR Warning OR Today OR (Unpaid AND Debt > 0)
        return paymentStatus.status === 'overdue' || paymentStatus.status === 'warning' || paymentStatus.status === 'today' || (paymentStatus.status === 'pending' && isDebt) || (paymentStatus.status === 'installment' && isDebt);
    });

    if (reportData.length === 0) {
        container.innerHTML = '<div class="alert alert-success text-center p-5 shadow-sm rounded-3"><i class="fi fi-rr-check-circle fa-2x mb-3"></i><h4>ល្អណាស់! មិនមានសិស្សហួសកំណត់បង់ប្រាក់ទេ។</h4></div>';
        return;
    }

    // 2. Group by Section (Study Type)
    const sections = {
        'cFullTime': { title: 'ថ្នាក់ភាសាចិនពេញម៉ោង (Full-time Chinese)', data: [] },
        'cPartTime': { title: 'ថ្នាក់ភាសាចិនក្រៅម៉ោង (Part-time Chinese)', data: [] },
        'one-language': { title: 'ថ្នាក់ភាសា (១ភាសា / 1 Language)', data: [] },
        'two-languages': { title: 'ថ្នាក់ភាសា (២ភាសា / 2 Languages)', data: [] },
        'three-languages': { title: 'ថ្នាក់ភាសា (៣ភាសា / 3 Languages)', data: [] },
        'other': { title: 'ផ្សេងៗ (Other)', data: [] }
    };

    reportData.forEach(s => {
        // Map study types
        let key = 'other';
        const type = s.studyType || s.courseType; // Handle both keys if possible

        if (type === 'cFullTime' || type === 'chinese-fulltime') key = 'cFullTime';
        else if (type === 'cPartTime' || type === 'chinese-parttime') key = 'cPartTime';
        else if (type === 'one-language' || type === 'ePartTime' || type === 'eFullTime') key = 'one-language'; // Assuming ePart/Full are 1 language matches
        else if (type === 'two-languages') key = 'two-languages';
        else if (type === 'three-languages') key = 'three-languages';

        if (sections[key]) sections[key].data.push(s);
        else sections['other'].data.push(s);
    });

    // 3. Render Each Section
    Object.keys(sections).forEach(key => {
        const section = sections[key];
        if (section.data.length === 0) return;

        // Sort by Due Date (Overdue first)
        section.data.sort((a, b) => {
            const dateA = a.nextPaymentDate ? convertToEnglishDate(a.nextPaymentDate) : '9999-99-99';
            const dateB = b.nextPaymentDate ? convertToEnglishDate(b.nextPaymentDate) : '9999-99-99';
            return new Date(dateA) - new Date(dateB);
        });

        const sectionHtml = buildReportSection(section.title, section.data);
        container.innerHTML += sectionHtml;
    });
}

function buildReportSection(title, data) {
    let totalAmount = 0;
    data.forEach(s => totalAmount += calculateRemainingAmount(s));

    let rows = '';
    data.forEach((s, idx) => {
        const status = getPaymentStatus(s);
        const remaining = calculateRemainingAmount(s);

        rows += `
            <tr class="align-middle border-bottom">
                <td class="text-center text-secondary">${idx + 1}</td>
                <td class="text-center fw-bold text-dark">${s.displayId}</td>
                <td>
                    <div class="fw-bold text-primary">${s.lastName} ${s.firstName}</div>
                    <div class="small text-muted">${s.chineseLastName || ''}${s.chineseFirstName || ''}</div>
                </td>
                <td class="text-center">${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                <td class="text-center">${s.homeroomTeacher || '-'}</td>
                <td class="text-center">${s.studyTime || '-'}</td>
                 <td class="text-center">${formatDueDateWithColor(s)}</td>
                 <td class="text-center fw-bold text-danger">$${remaining.toFixed(2)}</td>
                 <td class="text-center">
                    <div class="d-flex align-items-center justify-content-center gap-1">
                        <span class="payment-status-badge ${status.badge} shadow-sm" style="font-size: 0.8rem;">
                            ${status.text}
                        </span>
                        <a href="income-expense.html?pay=${s.key}" class="btn btn-sm btn-pink rounded-pill px-2 py-1 shadow-sm" title="បង់ប្រាក់">
                            <i class="fi fi-rr-hand-holding-usd text-white"></i>
                        </a>
                    </div>
                 </td>
            </tr>
        `;
    });

    return `
        <div class="card shadow-sm border-0 mb-4 animate__animated animate__fadeInUp">
            <div class="card-header bg-white border-bottom border-light py-3 px-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 class="fw-bold text-pink-primary mb-0"><i class="fi fi-rr-folder me-2"></i>${title}</h5>
                <div class="d-flex gap-3 text-secondary small fw-bold">
                    <span class="bg-light px-3 py-1 rounded-pill"><i class="fi fi-rr-users-alt me-1"></i>ចំនួន: ${data.length} នាក់</span>
                    <span class="bg-danger-subtle text-danger px-3 py-1 rounded-pill"><i class="fi fi-rr-money-bill-wave me-1"></i>សរុប: $${totalAmount.toFixed(2)}</span>
                </div>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover mb-0" style="font-size: 0.95rem;">
                        <thead class="bg-light text-secondary">
                            <tr>
                                <th class="text-center py-3" width="50">L.R</th>
                                <th class="text-center py-3" width="100">ID</th>
                                <th class="py-3">ឈ្មោះសិស្ស</th>
                                <th class="text-center py-3" width="80">ភេទ</th>
                                <th class="text-center py-3">គ្រូបន្ទុកថ្នាក់</th>
                                <th class="text-center py-3">ម៉ោងសិក្សា</th>
                                <th class="text-center py-3">ថ្ងៃផុតកំណត់</th>
                                <th class="text-center py-3">ចំនួនប្រាក់</th>
                                <th class="text-center py-3">ស្ថានភាព</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// Details Modal
// ----------------------------------------------------



function viewStudentDetails(studentKey) {
    const s = allStudentsData[studentKey];
    if (!s) return showAlert('រកមិនឃើញទិន្នន័យ!', 'danger');

    showLoading(true);

    // Status config
    const status = s.enrollmentStatus || 'active';
    const statusConfig = {
        'active': { text: 'កំពុងសិក្សា', class: 'bg-success text-white', icon: 'fi-rr-check-circle' },
        'dropout': { text: 'បោះបង់', class: 'bg-danger text-white', icon: 'fi-rr-user-xmark' },
        'completed': { text: 'បញ្ចប់ការសិក្សា', class: 'bg-info text-dark', icon: 'fi-rr-graduation-cap' }
    };
    const currentStatus = statusConfig[status] || statusConfig['active'];

    // Helper for tenure
    const calculateTenure = (startDate) => {
        if (!startDate || ['N/A', 'មិនមាន', ''].includes(startDate)) return 'N/A';
        const start = new Date(startDate);
        if (isNaN(start.getTime())) return 'N/A';
        const today = new Date();
        const diffTime = Math.abs(today - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 30) return `${diffDays} ថ្ងៃ`;
        const diffMonths = Math.floor(diffDays / 30);
        if (diffMonths < 12) return `${diffMonths} ខែ`;
        return `${Math.floor(diffMonths / 12)} ឆ្នាំ ${diffMonths % 12 > 0 ? (diffMonths % 12) + ' ខែ' : ''}`;
    };

    const bodyContent = `
        <div class="student-details-view font-khmer animate__animated animate__fadeIn">
            <!-- 1. Profile Header Section -->
            <div class="card border-0 shadow-lg mb-4 overflow-hidden" style="border-radius: 20px; background: linear-gradient(135deg, #1f0637 0%, #3a0d63 100%);">
                <div class="card-body p-4 p-md-5">
                    <div class="row align-items-center g-4">
                        <div class="col-auto">
                            <div class="position-relative">
                                ${s.imageUrl ?
            `<img src="${s.imageUrl}" class="rounded-circle border border-4 border-white shadow-lg" style="width: 130px; height: 130px; object-fit: cover;">` :
            `<div class="rounded-circle bg-white d-flex align-items-center justify-content-center text-secondary border border-4 border-white shadow-lg" style="width: 130px; height: 130px; font-size: 3.5rem;">
                                        <i class="fi fi-rr-user"></i>
                                    </div>`
        }
                                <div class="position-absolute bottom-0 end-0 p-1 ${status === 'active' ? 'bg-success' : 'bg-danger'} border border-3 border-white rounded-circle shadow-sm" style="width: 20px; height: 20px;"></div>
                            </div>
                        </div>
                        <div class="col text-center text-md-start text-white">
                            <div class="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-2 mb-2">
                                <span class="badge ${currentStatus.class} px-3 py-1 rounded-pill fw-bold shadow-sm" style="font-size: 0.75rem;">
                                    <i class="fi ${currentStatus.icon} me-1"></i> ${currentStatus.text}
                                </span>
                                <span class="badge bg-white bg-opacity-20 text-white px-3 py-1 rounded-pill fw-bold border border-white border-opacity-25" style="font-size: 0.75rem;">
                                    <i class="fi fi-rr-id-badge me-1"></i> ID: ${s.displayId}
                                </span>
                            </div>
                            <h2 class="fw-bold mb-0" style="font-size: 2rem;">${s.lastName || ''} ${s.firstName || ''}</h2>
                            <h5 class="text-white-50 fw-bold text-uppercase mb-3" style="letter-spacing: 1px;">${s.englishLastName || ''} ${s.englishFirstName || ''}</h5>
                            
                            <div class="d-flex flex-wrap justify-content-center justify-content-md-start gap-4 text-white-80 small">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="fi fi-rr-book-alt text-warning"></i> <span>មុខវិជ្ជា: <b>${s.subject || 'N/A'}</b></span>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <i class="fi fi-rr-layers text-info"></i> <span>ជំនាន់: <b>${s.generation || 'N/A'}</b></span>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <i class="fi fi-rr-calendar-clock text-success"></i> <span>អតីតភាព: <b>${calculateTenure(s.startDate)}</b></span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-auto d-flex flex-column gap-2">
                            <button class="btn btn-warning rounded-pill px-4 fw-bold shadow-sm hover-up" onclick="showEditModal('${s.key}')">
                                <i class="fi fi-rr-edit me-2"></i> កែប្រែព័ត៌មាន
                            </button>
                             <button class="btn btn-outline-light rounded-pill px-4 fw-bold shadow-sm" onclick="showRenewModal('${s.key}')">
                                <i class="fi fi-rr-refresh me-2"></i> ប្តូរថ្នាក់
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <!-- Left Column (Personal & Academic) -->
                <div class="col-lg-7">
                    <!-- 2. Academic Information Group -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 20px; border-top: 4px solid #198754 !important;">
                        <div class="card-header bg-white border-0 pt-4 px-4">
                            <h5 class="fw-bold text-dark d-flex align-items-center mb-0">
                                <span class="p-2 bg-success bg-opacity-10 rounded-3 me-3 text-success"><i class="fi fi-rr-graduation-cap"></i></span>
                                ព័ត៌មានសិក្សា (Academic Records)
                            </h5>
                        </div>
                        <div class="card-body p-4">
                            <div class="row g-3">
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">កម្រិតសិក្សា (Level)</label>
                                    <div class="fw-bold text-dark">${s.studyLevel || 'N/A'}</div>
                                </div>
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">ម៉ោងសិក្សា (Study Time)</label>
                                    <div class="fw-bold text-dark">${s.studyTime || 'N/A'}</div>
                                </div>
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">គ្រូបង្រៀន (Teacher)</label>
                                    <div class="fw-bold text-dark">${s.teacherName || 'N/A'}</div>
                                </div>
                                <div class="col-sm-6 p-3 bg-light rounded-3 mt-3">
                                    <label class="text-muted small fw-bold mb-1">ថ្ងៃចូលរៀន (Start Date)</label>
                                    <div class="fw-bold text-primary">${toKhmerDate(s.startDate)}</div>
                                </div>
                                <div class="col-sm-6 p-3 bg-light rounded-3 mt-3">
                                    <label class="text-muted small fw-bold mb-1">ថ្ងៃបង់ប្រាក់ (Payment Date)</label>
                                    <div class="fw-bold text-info">${toKhmerDate(s.paymentDate)}</div>
                                </div>
                                <div class="col-sm-6 p-3 bg-danger bg-opacity-10 rounded-3 mt-2">
                                    <label class="text-danger small fw-bold mb-1">ថ្ងៃកំណត់បង់ (Due Date)</label>
                                    <div class="fw-bold text-danger">${toKhmerDate(s.dueDate || s.nextPaymentDate)}</div>
                                </div>
                                <div class="col-sm-6 p-3 bg-dark bg-opacity-10 rounded-3 mt-2">
                                    <label class="text-muted small fw-bold mb-1">ថ្ងៃបញ្ចប់ការសិក្សា (End Date)</label>
                                    <div class="fw-bold text-dark">${s.endDate ? toKhmerDate(s.endDate) : 'មិនទាន់កំណត់'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Personal Information Group -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 20px; border-top: 4px solid #0d6efd !important;">
                        <div class="card-header bg-white border-0 pt-4 px-4">
                            <h5 class="fw-bold text-dark d-flex align-items-center mb-0">
                                <span class="p-2 bg-primary bg-opacity-10 rounded-3 me-3 text-primary"><i class="fi fi-rr-user"></i></span>
                                ព័ត៌មានផ្ទាល់ខ្លួន (Personal Details)
                            </h5>
                        </div>
                        <div class="card-body p-4">
                            <div class="row g-3">
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">ភេទ (Gender)</label>
                                    <div class="fw-bold">${s.gender === 'Male' ? 'ប្រុស (Male)' : 'ស្រី (Female)'}</div>
                                </div>
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">ថ្ងៃខែឆ្នាំកំណើត (DOB)</label>
                                    <div class="fw-bold">${toKhmerDate(s.dob)}</div>
                                </div>
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">សញ្ជាតិ (Nationality)</label>
                                    <div class="fw-bold">${s.nationality || 'ខ្មែរ'}</div>
                                </div>
                                <div class="col-sm-6 p-2 border-bottom border-light">
                                    <label class="text-muted small fw-bold mb-1">លេខទូរស័ព្ទ (Phone)</label>
                                    <div class="fw-bold text-primary font-monospace">${s.personalPhone || 'N/A'}</div>
                                </div>
                                <div class="col-12 p-3 bg-light rounded-4 mt-3 border border-light-subtle shadow-sm">
                                    <label class="text-muted small fw-bold mb-1"><i class="fi fi-rr-marker me-1 text-danger"></i>អាសយដ្ឋានបច្ចុប្បន្ន (Current Address)</label>
                                    <div class="fw-bold text-dark">${s.address || s.studentAddress || 'មិនទាន់មានទិន្នន័យ'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column (Guardian & Notes) -->
                <div class="col-lg-5">
                    <!-- 4. Guardian Information Group -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 20px; border-top: 4px solid #ffc107 !important;">
                        <div class="card-header bg-white border-0 pt-4 px-4">
                            <h5 class="fw-bold text-dark d-flex align-items-center mb-0">
                                <span class="p-2 bg-warning bg-opacity-10 rounded-3 me-3 text-warning"><i class="fi fi-rr-users"></i></span>
                                ព័ត៌មានអាណាព្យាបាល
                            </h5>
                        </div>
                        <div class="card-body p-4">
                            <!-- Father Info -->
                            <div class="guardian-box p-3 bg-primary bg-opacity-10 rounded-4 border border-primary border-opacity-10 mb-3">
                                <h6 class="fw-bold text-primary border-bottom border-primary border-opacity-25 pb-2 mb-2">
                                    <i class="fi fi-rr-man-head me-2"></i>ឪពុក (Father)
                                </h6>
                                <div class="row g-2 small">
                                    <div class="col-6 text-muted">ឈ្មោះ: <b class="text-dark">${s.fatherName || 'N/A'}</b></div>
                                    <div class="col-6 text-muted">លេខទូរស័ព្ទ: <b class="text-dark">${s.fatherPhone || 'N/A'}</b></div>
                                    <div class="col-12 text-muted">មុខរបរ: <b class="text-dark">${s.fatherJob || 'N/A'}</b></div>
                                    <div class="col-12 text-muted mt-1">អាសយដ្ឋាន: <span class="text-dark">${s.fatherAddress || 'N/A'}</span></div>
                                </div>
                            </div>

                            <!-- Mother Info -->
                            <div class="guardian-box p-3 bg-danger bg-opacity-10 rounded-4 border border-danger border-opacity-10 mb-2">
                                <h6 class="fw-bold text-danger border-bottom border-danger border-opacity-25 pb-2 mb-2">
                                    <i class="fi fi-rr-woman-head me-2"></i>ម្តាយ (Mother)
                                </h6>
                                <div class="row g-2 small">
                                    <div class="col-6 text-muted">ឈ្មោះ: <b class="text-dark">${s.motherName || 'N/A'}</b></div>
                                    <div class="col-6 text-muted">លេខទូរស័ព្ទ: <b class="text-dark">${s.motherPhone || 'N/A'}</b></div>
                                    <div class="col-12 text-muted">មុខរបរ: <b class="text-dark">${s.motherJob || 'N/A'}</b></div>
                                    <div class="col-12 text-muted mt-1">អាសយដ្ឋាន: <span class="text-dark">${s.motherAddress || 'N/A'}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 5. Additional Notes Group -->
                    <div class="card border-0 shadow-sm mb-4" style="border-radius: 20px; background: #fdfdfd;">
                        <div class="card-body p-4">
                            <h6 class="fw-bold text-dark mb-3"><i class="fi fi-rr-memo-circle-check text-warning me-2"></i>កំណត់ចំណាំបន្ថែម (Notes)</h6>
                            <div class="p-3 bg-white border border-light-subtle rounded-4 mb-4 small" style="min-height: 100px; color: #555;">
                                ${s.notes || 'មិនមានកំណត់ចំណាំបន្ថែមសម្រាប់សិស្សនេះទេ។'}
                            </div>
                            
                            <!-- Action Buttons -->
                            <div class="d-grid gap-2">
                                ${status === 'dropout' ?
            `<button class="btn btn-success btn-lg rounded-pill fw-bold shadow-sm" onclick="restoreStudent('${s.key}')">
                                        <i class="fi fi-rr-undo me-2"></i> ដាក់ឱ្យចូលរៀនវិញ
                                    </button>` :
            `<button class="btn btn-outline-danger btn-lg rounded-pill fw-bold" onclick="markAsDropout('${s.key}')">
                                        <i class="fi fi-rr-user-xmark me-2"></i> កំណត់ជាសិស្សបោះបង់
                                    </button>`
        }
                                <button class="btn btn-danger btn-lg rounded-pill fw-bold shadow-sm" onclick="deleteStudent('${s.key}', '${s.displayId}')">
                                    <i class="fi fi-rr-trash me-2"></i> លុបសិស្សចេញពីប្រព័ន្ធ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalContent = document.getElementById('modalBodyContent');
    if (modalContent) {
        modalContent.innerHTML = bodyContent;
        if (!studentDetailsModal) {
            studentDetailsModal = new bootstrap.Modal(document.getElementById('studentDetailsModal'));
        }
        studentDetailsModal.show();
    }

    showLoading(false);
}

// ----------------------------------------------------
// Edit Logic
// ----------------------------------------------------

function showEditModal(key) {
    const student = allStudentsData[key];
    if (student) createEditModal(student);
}


/**
 * Helper to generate Receiver Select HTML
 */
function getReceiverSelectHtml(selected = '', name = '', className = 'form-select') {
    const receivers = ['Admin', 'Manager', 'Receptionist', 'Teacher'];
    if (selected && !receivers.includes(selected)) receivers.push(selected);

    let options = receivers.map(r => `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`).join('');
    if (!selected) options = `<option value="" selected>Select Receiver</option>` + options;

    return `<select ${name ? `name="${name}"` : ''} class="${className}">${options}</select>`;
}

/**
 * Helper to generate Payment Method Select HTML
 */
function getPaymentMethodSelectHtml(selected = '', name = '', className = 'form-select', id = '') {
    const methods = ['Cash', 'ABA', 'Acleda', 'Wing', 'Other'];
    if (selected && !methods.includes(selected)) methods.push(selected);

    let options = methods.map(m => `<option value="${m}" ${m === selected ? 'selected' : ''}>${m}</option>`).join('');
    return `<select ${name ? `name="${name}"` : ''} ${id ? `id="${id}"` : ''} class="${className}">${options}</select>`;
}



function createEditModal(student) {
    const existing = document.getElementById('editStudentModal');
    if (existing) existing.remove();

    const tabsHtml = `
        <ul class="nav nav-pills mb-3 nav-justified" id="editStudentTabs" role="tablist" style="background: #f1f5f9; padding: 10px; border-radius: 12px;">
            <li class="nav-item" role="presentation">
                <button class="nav-link active fw-bold" id="pills-personal-tab" data-bs-toggle="pill" data-bs-target="#pills-personal" type="button" role="tab">
                    <i class="fi fi-rr-user me-2"></i>ផ្ទាល់ខ្លួន (Personal)
                </button>
            </li>
             <li class="nav-item" role="presentation">
                <button class="nav-link fw-bold" id="pills-academic-tab" data-bs-toggle="pill" data-bs-target="#pills-academic" type="button" role="tab">
                    <i class="fi fi-rr-graduation-cap me-2"></i>ការសិក្សា (Academic)
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link fw-bold" id="pills-guardian-tab" data-bs-toggle="pill" data-bs-target="#pills-guardian" type="button" role="tab">
                    <i class="fi fi-rr-users me-2"></i>អាណាព្យាបាល (Family)
                </button>
            </li>
        </ul>
    `;

    const html = `
        <div class="modal fade" id="editStudentModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 20px; overflow: hidden;">
                    <div class="modal-header text-white border-0 shadow-sm" style="background: rgb(31, 6, 55); padding: 20px;">
                        <h5 class="modal-title fw-bold">
                            <i class="fi fi-rr-edit me-2"></i>កែប្រែព័ត៌មានលម្អិតសិស្ស <span class="badge bg-light text-dark ms-2 shadow-sm">${student.displayId}</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4 bg-white">
                        <form id="editStudentForm">
                            <input type="hidden" name="key" value="${student.key}">
                            
                            ${tabsHtml}

                            <div class="tab-content" id="editStudentTabsContent">
                                
                                <!-- 1. Personal Info -->
                                <div class="tab-pane fade show active" id="pills-personal" role="tabpanel">
                                    <div class="row g-3 p-3">
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">អត្តលេខ (Student ID)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-id-badge text-primary"></i></span>
                                                <input type="text" class="form-control fw-bold" name="displayId" value="${student.displayId || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">ឈ្មោះសិស្ស (Khmer Name)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-user text-primary"></i></span>
                                                <input type="text" class="form-control fw-bold" name="lastName" value="${((student.lastName || '') + ' ' + (student.firstName || '')).trim()}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">FullName in English</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-text text-primary"></i></span>
                                                <input type="text" class="form-control fw-bold text-uppercase" name="englishLastName" value="${((student.englishLastName || '') + ' ' + (student.englishFirstName || '')).trim()}">
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">ភេទ (Gender)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-intersex text-primary"></i></span>
                                                <select class="form-select" name="gender">
                                                    <option value="Male" ${student.gender === 'Male' ? 'selected' : ''}>ប្រុស (Male)</option>
                                                    <option value="Female" ${student.gender === 'Female' ? 'selected' : ''}>ស្រី (Female)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">ថ្ងៃខែឆ្នាំកំណើត (DOB)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-cake-birthday text-warning"></i></span>
                                                <input type="text" class="form-control date-picker-edit" name="dob" value="${safeDateValue(student.dob || '')}" placeholder="YYYY-MM-DD">
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">សញ្ជាតិ (Nationality)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-flag text-danger"></i></span>
                                                <input type="text" class="form-control" name="nationality" value="${student.nationality || 'ខ្មែរ'}">
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">លេខទូរស័ព្ទ (Phone)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-phone-call text-success"></i></span>
                                                <input type="text" class="form-control fw-bold text-primary font-monospace" name="personalPhone" value="${student.personalPhone || ''}">
                                            </div>
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label small fw-bold">អាសយដ្ឋានបច្ចុប្បន្ន (Current Address)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-marker text-danger"></i></span>
                                                <textarea class="form-control fw-bold" name="studentAddress" rows="2" placeholder="បំពេញអាសយដ្ឋានលម្អិត...">${student.studentAddress || student.address || ''}</textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 2. Academic Info (Renumbered as Address tab is removed) -->
                                <div class="tab-pane fade" id="pills-academic" role="tabpanel">
                                    <div class="row g-3 p-3">
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">មុខវិជ្ជា (Subject)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-book-alt text-success"></i></span>
                                                <input type="text" class="form-control" name="subject" value="${student.subject || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">កម្រិតសិក្សា (Level)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-chart-line-up text-info"></i></span>
                                                <input type="text" class="form-control" name="studyLevel" value="${student.studyLevel || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-2">
                                            <label class="form-label small fw-bold">ជំនាន់ (Gen)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-layers text-warning"></i></span>
                                                <input type="text" class="form-control" name="generation" value="${student.generation || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">គ្រូបង្រៀន (Teacher)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-chalkboard-user text-primary"></i></span>
                                                <input type="text" class="form-control" name="teacherName" value="${student.teacherName || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">ម៉ោងសិក្សា (Study Time)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-clock text-info"></i></span>
                                                <input type="text" class="form-control" name="studyTime" value="${student.studyTime || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">ស្ថានភាព (Enrollment Status)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-user-tag text-success"></i></span>
                                                <select class="form-select" name="enrollmentStatus">
                                                    <option value="active" ${(!student.enrollmentStatus || student.enrollmentStatus === 'active') ? 'selected' : ''}>កំពុងសិក្សា (Active)</option>
                                                    <option value="dropout" ${student.enrollmentStatus === 'dropout' ? 'selected' : ''}>បោះបង់ (Dropout)</option>
                                                    <option value="completed" ${student.enrollmentStatus === 'completed' ? 'selected' : ''}>បញ្ចប់ការសិក្សា (Completed)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold text-success">ថ្ងៃចូលរៀន (Start Date)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-calendar-plus text-success"></i></span>
                                                <input type="text" class="form-control date-picker-edit" name="startDate" value="${safeDateValue(student.startDate || '')}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold text-primary">ថ្ងៃបង់ប្រាក់ (Payment Date)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-calendar-check text-primary"></i></span>
                                                <input type="text" class="form-control date-picker-edit" name="paymentDate" value="${safeDateValue(student.paymentDate || '')}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold text-danger">ថ្ងៃកំណត់បង់ (Due Date)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-calendar-exclamation text-danger"></i></span>
                                                <input type="text" class="form-control date-picker-edit" name="dueDate" value="${safeDateValue(student.dueDate || student.nextPaymentDate || '')}">
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">ថ្ងៃបញ្ចប់សិក្សា (End Date)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-calendar-minus text-dark"></i></span>
                                                <input type="text" class="form-control date-picker-edit" name="endDate" value="${safeDateValue(student.endDate || '')}">
                                            </div>
                                        </div>
                                        <div class="col-12 mt-2">
                                            <label class="form-label small fw-bold">កំណត់ចំណាំ (Notes)</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-white"><i class="fi fi-rr-document text-warning"></i></span>
                                                <textarea class="form-control" name="notes" rows="2">${student.notes || ''}</textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 4. Guardian Info -->
                                <div class="tab-pane fade" id="pills-guardian" role="tabpanel">
                                    <div class="row g-3 p-3">
                                        <div class="col-md-6 border-end">
                                            <div class="p-3 bg-primary bg-opacity-10 rounded-4">
                                                <h6 class="fw-bold text-primary mb-3 d-flex align-items-center"><i class="fi fi-rr-man-head me-2 fs-5"></i>ព័ត៌មានឪពុក (Father)</h6>
                                                <div class="row g-2">
                                                    <div class="col-12">
                                                        <label class="small fw-bold">ឈ្មោះឪពុក</label>
                                                        <input type="text" class="form-control form-control-sm" name="fatherName" value="${student.fatherName || ''}">
                                                    </div>
                                                    <div class="col-6">
                                                        <label class="small fw-bold">មុខរបរ</label>
                                                        <input type="text" class="form-control form-control-sm" name="fatherJob" value="${student.fatherJob || ''}">
                                                    </div>
                                                    <div class="col-6">
                                                        <label class="small fw-bold">លេខទូរស័ព្ទ</label>
                                                        <input type="text" class="form-control form-control-sm" name="fatherPhone" value="${student.fatherPhone || ''}">
                                                    </div>
                                                    <div class="col-12">
                                                        <label class="small fw-bold">អាសយដ្ឋាន</label>
                                                        <textarea class="form-control form-control-sm" name="fatherAddress" rows="1">${student.fatherAddress || ''}</textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="p-3 bg-danger bg-opacity-10 rounded-4">
                                                <h6 class="fw-bold text-danger mb-3 d-flex align-items-center"><i class="fi fi-rr-woman-head me-2 fs-5"></i>ព័ត៌មានម្តាយ (Mother)</h6>
                                                <div class="row g-2">
                                                    <div class="col-12">
                                                        <label class="small fw-bold">ឈ្មោះម្តាយ</label>
                                                        <input type="text" class="form-control form-control-sm" name="motherName" value="${student.motherName || ''}">
                                                    </div>
                                                    <div class="col-6">
                                                        <label class="small fw-bold">មុខរបរ</label>
                                                        <input type="text" class="form-control form-control-sm" name="motherJob" value="${student.motherJob || ''}">
                                                    </div>
                                                    <div class="col-6">
                                                        <label class="small fw-bold">លេខទូរស័ព្ទ</label>
                                                        <input type="text" class="form-control form-control-sm" name="motherPhone" value="${student.motherPhone || ''}">
                                                    </div>
                                                    <div class="col-12">
                                                        <label class="small fw-bold">អាសយដ្ឋាន</label>
                                                        <textarea class="form-control form-control-sm" name="motherAddress" rows="1">${student.motherAddress || ''}</textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                            </div>
                        </form>
                    </div>
                    <div class="modal-footer border-0 bg-light p-3">
                        <button type="button" class="btn btn-light px-4 border shadow-sm rounded-pill" data-bs-dismiss="modal">បិទ</button>
                        <button type="button" class="btn btn-primary px-5 fw-bold shadow-sm rounded-pill border-0" onclick="saveStudentChanges('${student.key}')" style="background: rgb(31, 6, 55);">
                            <i class="fi fi-rr-disk me-2"></i>រក្សាទុកការកែប្រែ
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // Populate installments - Removed as installments are now managed in income-expense.html
    let installments = [];
    if (student.installments) {
        if (Array.isArray(student.installments)) installments = student.installments;
        else if (typeof student.installments === 'object') installments = Object.values(student.installments);
    }
    // addInstallmentRow is no longer defined and the UI element editInstallmentBody is removed.



    // Initialize Flatpickr for date inputs with Khmer localization
    flatpickr.localize(KhmerLocale);
    flatpickr(".date-picker-edit", {
        dateFormat: "Y-m-d", // Data format
        altInput: true,      // Display formatted text
        altFormat: "d-M-Y",  // User-friendly format: 02-កញ្ញា-2025
        allowInput: true,
        monthSelectorType: "static"
    });

    new bootstrap.Modal(document.getElementById('editStudentModal')).show();
}

/**
 * Add a dynamic row to the installment table in edit modal
 */

/**
 * Auto-calculate totals in the edit form
 */


function saveStudentChanges(key) {
    const form = document.getElementById('editStudentForm');
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);

    // Basic Validation - firstName is no longer required as it is merged into lastName
    if (!data.lastName) {
        return showAlert('សូមបំពេញឈ្មោះសិស្ស (Khmer Name)', 'danger');
    }


    showLoading(true);
    studentsRef.child(key).update({
        ...data,
        firstName: '', // Explicitly clear firstName as it's merged into lastName
        englishFirstName: '', // Explicitly clear englishFirstName as it's merged into englishLastName
        updatedAt: new Date().toISOString()
    })
        .then(() => {
            showAlert('កែប្រែបានជោគជ័យ', 'success');
            const modalEl = document.getElementById('editStudentModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            // Firebase list listener will trigger re-render
        })
        .catch(error => {
            console.error("Update error:", error);
            showAlert('កំហុសក្នុងការរក្សាទុក: ' + error.message, 'danger');
        })
        .finally(() => showLoading(false));
}



// ----------------------------------------------------
// Actions: Delete & Mark as Paid
// ----------------------------------------------------

function deleteStudent(key, displayId) {
    if (!confirm(`តើអ្នកចង់លុបសិស្ស ID: ${displayId} មែនទេ?`)) return;
    studentsRef.child(key).remove()
        .then(() => showAlert(`លុប ID: ${displayId} ជោគជ័យ`, 'success'))
        .catch(e => showAlert(e.message, 'danger'));
}



function markAsPaid(key) {
    const s = allStudentsData[key];
    if (!s) return;

    const amountToPay = calculateRemainingAmount(s);
    if (!confirm(`តើអ្នកពិតជាចង់បង់ប្រាក់សរុប $${amountToPay.toFixed(2)} សម្រាប់សិស្សនេះមែនទេ?`)) return;

    const months = parseInt(s.paymentMonths || 1);
    let nextDate = 'មិនមាន';
    const engDate = convertToEnglishDate(s.nextPaymentDate);

    // Determine the base date for calculation
    let baseDate = null;
    if (engDate) {
        baseDate = new Date(engDate);
    } else if (s.dueDate && !['មិនមាន', 'N/A', ''].includes(s.dueDate)) {
        // Try to parse YYYY-MM-DD
        const d = new Date(s.dueDate);
        if (!isNaN(d.getTime())) baseDate = d;
    }

    if (baseDate) {
        baseDate.setMonth(baseDate.getMonth() + months);
        nextDate = `ថ្ងៃទី ${baseDate.getDate()}/${baseDate.getMonth() + 1}/${baseDate.getFullYear()}`;
    }

    studentsRef.child(key).update({
        paymentStatus: 'Paid',
        nextPaymentDate: nextDate,
        updatedAt: new Date().toISOString()
    }).then(() => {
        // Record Transaction
        if (amountToPay > 0) {
            recordTransaction({
                type: 'income',
                amount: amountToPay,
                date: new Date().toISOString().split('T')[0],
                category: 'ថ្លៃសិក្សា (Tuition Fee)',
                description: `បង់ថ្លៃសិក្សា: ${s.lastName} ${s.firstName} (${s.displayId})`,
                referenceId: s.displayId,
                payer: 'អាណាព្យាបាល',
                receiver: firebase.auth().currentUser ? (firebase.auth().currentUser.displayName || firebase.auth().currentUser.email) : 'Admin'
            }).catch(console.error);
        }

        showAlert('បង់ប្រាក់រួចរាល់', 'success');
        if (studentDetailsModal) studentDetailsModal.hide();
    });
}

function markAsDropout(key) {
    if (!confirm('តើអ្នកពិតជាចង់កំណត់សិស្សនេះជា "សិស្សបោះបង់ការសិក្សា" ដែរឬទេ?')) return;
    studentsRef.child(key).update({
        enrollmentStatus: 'dropout',
        updatedAt: new Date().toISOString()
    }).then(() => {
        showAlert('បានកំណត់ជាសិស្សបោះបង់ការសិក្សា', 'success');
    });
}

function restoreStudent(key) {
    if (!confirm('តើអ្នកពិតជាចង់ឱ្យសិស្សនេះចូលរៀនវិញដែរឬទេ?')) return;
    studentsRef.child(key).update({
        enrollmentStatus: 'active',
        updatedAt: new Date().toISOString()
    }).then(() => {
        showAlert('បានដាក់ឱ្យចូលរៀនវិញជោគជ័យ', 'success');
    });
}

function recordTransaction(data) {
    const transactionsRef = firebase.database().ref('transactions');
    const transactionData = {
        ...data,
        sourceType: 'manual_linked',
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    return transactionsRef.push(transactionData);
}

// ----------------------------------------------------
// Alerts & Notifications
// ----------------------------------------------------

function checkPaymentAlerts(data) {
    notifications = { overdue: [], warning: [] };
    if (!data) return updateNotificationCount(0);

    Object.keys(data).forEach(key => {
        const s = data[key];
        const status = getPaymentStatus(s);
        // Alert based on status returned by getPaymentStatus (which now prioritizes Date <= 10)
        // We do NOT check remaining > 0 anymore for warnings, as requested.
        if (status.status === 'overdue' && calculateRemainingAmount(s) > 0) {
            // Only alert overdue if they actually owe money? Or strictly date?
            // "alert must alert... even if paid money" applied to "near 10 days".
            // For overdue, usually we care about debt. Let's keep logic for overdue as is (debt based or date based if debt exists).
            // But for WARNING (near date), we alert regardless.
            notifications.overdue.push({ id: key, name: `${s.lastName} ${s.firstName}`, days: Math.abs(status.daysRemaining) });
        } else if (status.status === 'warning') {
            // Warning is now triggered by Date <= 10 regardless of debt
            notifications.warning.push({ id: key, name: `${s.lastName} ${s.firstName}`, days: status.daysRemaining });
        }
    });

    updateNotificationCount(notifications.overdue.length + notifications.warning.length);
    renderAlertPanel();

    if (notifications.warning.length > 0) {
        showAlert(`⚠️ មានសិស្ស ${notifications.warning.length} នាក់ជិតដល់ថ្ងៃបង់ប្រាក់ (10 ថ្ងៃ)`, 'warning');
    }
}

function updateNotificationCount(count) {
    const badge = document.getElementById('notificationCount');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function renderAlertPanel() {
    const list = document.getElementById('alertList');
    if (!list) return;

    let html = '';
    if (notifications.overdue.length === 0 && notifications.warning.length === 0) {
        html = '<div class="p-4 text-center text-muted"><i class="fi fi-rr-check-circle fa-2x mb-2 d-block text-success"></i>គ្មានការជូនដំណឹង</div>';
    } else {
        notifications.overdue.forEach(n => {
            html += `<div class="alert-item overdue p-3 border-bottom d-flex align-items-center" onclick="viewStudentDetails('${n.id}')" style="cursor:pointer">
                <div class="me-3 p-2 bg-white rounded-circle"><i class="fi fi-rr-flag text-danger"></i></div>
                <div>
                    <div class="fw-bold text-danger">ហួសកំណត់: ${n.name}</div>
                    <small class="text-muted"><i class="fi fi-rr-calendar-xmark me-1"></i>ហួស ${n.days} ថ្ងៃ</small>
                </div>
            </div>`;
        });
        notifications.warning.forEach(n => {
            html += `<div class="alert-item warning p-3 border-bottom d-flex align-items-center" onclick="viewStudentDetails('${n.id}')" style="cursor:pointer">
                <div class="me-3 p-2 bg-white rounded-circle"><i class="fi fi-rr-hourglass text-warning"></i></div>
                <div>
                    <div class="fw-bold text-warning">ជិតដល់ថ្ងៃបង់: ${n.name}</div>
                    <small class="text-muted"><i class="fi fi-rr-clock me-1"></i>នៅសល់ ${n.days} ថ្ងៃ</small>
                </div>
            </div>`;
        });
    }
    list.innerHTML = html;
}

// ----------------------------------------------------
// Reports
// ----------------------------------------------------

// ----------------------------------------------------
// Renew & Transfer Logic
// ----------------------------------------------------

function showRenewModal(key) {
    const s = allStudentsData[key];
    if (!s) return;

    const existing = document.getElementById('renewStudentModal');
    if (existing) existing.remove();

    // Find the latest installment for display
    let lastPaymentHtml = '<div class="text-center text-muted small py-2">មិនទាន់មានប្រវត្តិបង់ប្រាក់</div>';
    if (s.installments) {
        let installs = Array.isArray(s.installments) ? s.installments : Object.values(s.installments);
        if (installs.length > 0) {
            const last = installs[installs.length - 1];
            lastPaymentHtml = `
                <table class="table table-sm table-bordered mb-0 small" style="background: #f8f9fa;">
                    <thead>
                        <tr class="text-secondary">
                            <th>កាលបរិច្ឆេទ</th>
                            <th>ទឹកប្រាក់</th>
                            <th>ចំនួនខែ</th>
                            <th>អ្នកទទួល</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="fw-bold">${toKhmerDate(last.date)}</td>
                            <td class="fw-bold text-success">$${(parseFloat(last.amount) || 0).toFixed(2)}</td>
                            <td>${last.months || '1'} ខែ</td>
                            <td>${last.receiver || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        }
    }

    const html = `
        <div class="modal fade" id="renewStudentModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-md modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 20px;">
                    <div class="modal-header bg-purple text-white p-4 border-0 shadow-sm" style="background-color: #6f42c1;">
                        <h5 class="modal-title fw-bold">
                            <i class="fi fi-rr-graduation-cap me-2"></i>បច្ចុប្បន្នភាពការសិក្សា (Academic Upgrade)
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4 bg-light">
                        <form id="renewStudentForm">
                            <input type="hidden" name="key" value="${s.key}">
                            
                            <!-- Academic Updates -->
                            <div class="card border-0 shadow-sm">
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold">កម្រិតសិក្សា (Level)</label>
                                            <input type="text" class="form-control" name="newLevel" value="${s.studyLevel || ''}">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold">ម៉ោងសិក្សា (Time)</label>
                                            <input type="text" class="form-control" name="newTime" value="${s.studyTime || ''}">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold">គ្រូបន្ទុកថ្នាក់ (Teacher)</label>
                                            <input type="text" class="form-control" name="newTeacher" value="${s.teacherName || ''}">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold">បន្ទប់រៀន (Classroom)</label>
                                            <input type="text" class="form-control" name="newClassroom" value="${s.classroom || ''}">
                                        </div>
                                        <!-- Removed Financial Section -->
                                        <div class="col-12 mt-3">
                                            <label class="form-label small fw-bold">កំណត់សម្គាល់ (Note)</label>
                                            <input type="text" class="form-control" name="note" placeholder="សម្គាល់...">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer p-4 bg-white border-0 shadow-sm">
                        <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">បិទ</button>
                        <button type="button" class="btn btn-primary px-5 fw-bold shadow-sm" style="background-color: #6f42c1; border-color: #6f42c1;" onclick="processRenew('${s.key}')">
                            <i class="fi fi-rr-check-circle me-2"></i>រក្សាទុក (Save)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('renewStudentModal')).show();
}

function processRenew(key) {
    const s = allStudentsData[key];
    const form = document.getElementById('renewStudentForm');
    if (!s || !form) return;

    const newLevel = form.newLevel.value.trim();
    const newTime = form.newTime.value.trim();
    const newTeacher = form.newTeacher.value.trim();
    const newClassroom = form.newClassroom.value.trim();
    const note = form.note.value.trim();

    // 1. Update Academic Info
    const updateData = {
        studyLevel: newLevel,
        studyTime: newTime,
        teacherName: newTeacher,
        classroom: newClassroom,
        updatedAt: new Date().toISOString()
    };

    // Note handling: if note is provided, user might want to set it.
    // If we want to append history we can, but usually overwriting 'note' field or just not touching it if empty is fine. Let's update if not empty.
    if (note) updateData.note = note;

    showLoading(true);
    studentsRef.child(key).update(updateData)
        .then(() => {
            showAlert('បច្ចុប្បន្នភាពការសិក្សាជោគជ័យ!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('renewStudentModal')).hide();
            if (studentDetailsModal) {
                studentDetailsModal.hide();
                setTimeout(() => viewStudentDetails(key), 500);
            }
        })
        .catch(e => showAlert('Error: ' + e.message, 'danger'))
        .finally(() => showLoading(false));
}


// ----------------------------------------------------
// Reports & Exports
// ----------------------------------------------------

function getFilteredStudents() {
    return Object.values(allStudentsData).filter(s => {
        // Name Search
        const term = (currentFilters.searchName || '').toLowerCase().trim();

        // Consolidate all searchable fields into one string for easier matching
        const searchableText = [
            s.lastName, s.firstName,
            s.englishLastName, s.englishFirstName,
            s.chineseLastName, s.chineseFirstName,
            s.displayId
        ].filter(Boolean).join(' ').toLowerCase();

        // Token matching: Split search term by spaces and ensure EVERY word appears in the student record
        // This allows "First Last", "Last First", or "Name ID" searches to work perfectly.
        const searchTokens = term.split(/\s+/);
        const nameMatch = !term || searchTokens.every(token => searchableText.includes(token));

        // Status Filter
        const statusObj = getPaymentStatus(s);
        const statusMatch = currentFilters.status === 'all' || statusObj.status === currentFilters.status;

        // Time Filter (Study Time)
        const timeMatch = currentFilters.filterTime === 'all' || s.studyTime === currentFilters.filterTime;

        // Level Filter
        const levelMatch = currentFilters.filterLevel === 'all' || s.studyLevel === currentFilters.filterLevel;

        // Gender Filter
        const genderMatch = currentFilters.gender === 'all' || s.gender === currentFilters.gender;

        // Date Range
        let dateMatch = true;
        if (currentFilters.startDate && currentFilters.endDate) {
            const regDate = new Date(s.startDate);
            const start = new Date(currentFilters.startDate);
            const end = new Date(currentFilters.endDate);
            // Ignore time
            regDate.setHours(0, 0, 0, 0); start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
            dateMatch = regDate >= start && regDate <= end;
        }

        return nameMatch && statusMatch && timeMatch && levelMatch && genderMatch && dateMatch;
    });
}

function exportToExcel(data = null, filename = 'Student_Data') {
    let students = data || getFilteredStudents();

    if (window.SHOW_OVERDUE_REPORT) {
        // Filter for Overdue Report
        students = students.filter(s => {
            const status = getPaymentStatus(s);
            const debt = calculateRemainingAmount(s);
            const isDebt = debt > 0;
            return status.status === 'overdue' || status.status === 'warning' || (status.status === 'pending' && isDebt) || (status.status === 'installment' && isDebt);
        });
        filename = 'Overdue_Report';
    }

    if (students.length === 0) return showAlert('គ្មានទិន្នន័យសម្រាប់នាំចេញ', 'warning');

    let csv = '\uFEFFល.រ,អត្តលេខ,ឈ្មោះ,ភេទ,លេខទូរស័ព្ទ,កម្រិត,ម៉ោង,ថ្ងៃចុះឈ្មោះ,ថ្ងៃផុតកំណត់,ចំនួនខែ,គ្រូបន្ទុកថ្នាក់,ចំណាំ,តម្លៃ,ខ្វះ,ស្ថានភាព\n';
    students.forEach((s, i) => {
        const status = getPaymentStatus(s);
        // Use homeroomTeacher if available, fallback to teacherName or empty
        const teacher = s.homeroomTeacher || s.teacherName || '';
        csv += `${i + 1},${s.displayId},"${s.lastName} ${s.firstName}",${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'},${s.personalPhone || ''},${s.studyLevel || ''},${s.studyTime || ''},${s.startDate || ''},${s.nextPaymentDate || ''},${s.paymentMonths || ''},"${teacher}","${s.remark || ''}",$${calculateTotalAmount(s)},$${calculateRemainingAmount(s)},${status.text}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ----------------------------------------------------
// Reports
// ----------------------------------------------------

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

        // Include if they owe money OR are time-critical (Overdue/Today/Warning)
        // This ensures students who need to renew (0 debt but date passed) are included.
        if (debt > 0 || isTimeCritical) return true;

        return false;
    });

    if (students.length === 0) return showAlert('ល្អណាស់! មិនមានសិស្សជំពាក់ប្រាក់ហួសកំណត់ទេ', 'success');

    // Sort by ID
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

        // Determine Date Validity
        const hasDate = s.nextPaymentDate && !['N/A', 'មិនមាន', ''].includes(s.nextPaymentDate);

        let groupKey = 'unpaid'; // Default to generic Unpaid

        if (hasDate) {
            if (days < 0) groupKey = 'overdue';
            else if (days === 0) groupKey = 'today';
            else if (days > 0 && days <= 10) groupKey = 'warning';
            // If days > 10, stay as 'unpaid' (Future debt)
        }

        // Push and update stats
        categories[catKey].groups[groupKey].push(s);
        categories[catKey].totalDebt += debt;

        stats[groupKey].count++;
        stats[groupKey].amount += debt;
        stats.total.count++;
        stats.total.amount += debt;
    });

    // Open Popup
    let win = window.open('', 'OverdueReport', 'width=1200,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
    if (!win) { showAlert('Please allow popups for this website', 'error'); return; }

    let html = `<html><head><title>របាយការណ៍បំណុលសិស្ស</title>
        <base href="${window.location.href}">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
        <style>
            @page { margin: 20mm; size: auto; }
            body { font-family: 'Battambang', sans-serif !important; background: #eaecf1; color: #333; font-size: 14px; margin: 0; padding: 20px; padding-top: 80px; }
            
            /* Header Styling */
            .header-container { 
                background: white; 
                padding: 20px 40px; 
                border-radius: 0; 
                margin-bottom: 30px; 
                position: relative;
                border-bottom: 4px solid #8a0e5b;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 30px;
            }
            .logo-box { width: 100px; text-align: left; flex-shrink: 0; }
            .logo { width: 100px; height: auto; object-fit: contain; }
            
            .school-text { flex: 1; text-align: center; min-width: 250px; }
            .school-text h1 { font-family: 'Moul', serif; margin: 0; font-size: 24px; color: #8a0e5b; line-height: 1.4; }
            .school-text h2 { font-family: 'Times New Roman', serif; margin: 5px 0 15px; font-size: 14px; color: #2c3e50; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
            
            .report-badge { 
                background: #8a0e5b; 
                color: white; 
                padding: 8px 20px; 
                border-radius: 50px; 
                font-size: 14px; 
                font-weight: bold; 
                display: inline-block;
                box-shadow: 0 4px 10px rgba(138, 14, 91, 0.3);
                white-space: nowrap;
            }

            .date-box { width: 140px; text-align: right; font-size: 11px; color: #666; font-weight: bold; flex-shrink: 0; }

            /* Action Floating Bar */
            .action-bar { 
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                width: 90%; max-width: 700px; 
                background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); 
                padding: 8px 15px; border-radius: 50px; 
                box-shadow: 0 8px 25px rgba(0,0,0,0.12); 
                display: flex; justify-content: space-between; align-items: center; 
                z-index: 1000; border: 1px solid rgba(255,255,255,0.8); 
            }
            .btn-action { 
                text-decoration: none; padding: 10px 25px; border-radius: 30px; 
                color: white; border: none; cursor: pointer; display: inline-flex; 
                align-items: center; gap: 8px; font-weight: bold; font-size: 13px; 
                transition: all 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            }
            .btn-action:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
            .btn-home { background: linear-gradient(135deg, #667eea, #764ba2); }
            .btn-print { background: linear-gradient(135deg, #ff6b6b, #ee0979); }

            /* Summary Dashboard */
            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                margin-bottom: 40px;
                break-inside: avoid;
            }
            .stat-card {
                background: white;
                padding: 15px;
                border-radius: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.03);
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                border: 1px solid #eee;
                position: relative;
                overflow: hidden;
            }
            .stat-card::before { content:''; position:absolute; top:0; left:0; width:100%; height:4px; }
            .stat-card.blue::before { background: #0d6efd; }
            .stat-card.red::before { background: #dc3545; }
            .stat-card.orange::before { background: #fd7e14; }
            .stat-card.gray::before { background: #6c757d; }
            
            .stat-icon { font-size: 20px; margin-bottom: 8px; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            .blue .stat-icon { background: #e7f1ff; color: #0d6efd; }
            .red .stat-icon { background: #fff5f5; color: #dc3545; }
            .orange .stat-icon { background: #fff9db; color: #fd7e14; }
            .gray .stat-icon { background: #f8f9fa; color: #6c757d; }
            
            .stat-title { font-family: 'Moul', serif; font-size: 11px; color: #666; margin-bottom: 5px; }
            .stat-value { font-size: 18px; font-weight: 800; color: #333; }
            .stat-debt { font-size: 13px; font-weight: bold; color: #666; margin-top: 4px; background: #f8f9fa; padding: 2px 8px; border-radius: 10px; }

            /* Category Sections */
            .category-section { background: white; margin-bottom: 30px; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 0; }
            .section-header { padding: 12px 20px; font-size: 15px; font-weight: bold; background: #fff; color: #333; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
            .section-blue { border-left: 5px solid #0d6efd; }
            .section-orange { border-left: 5px solid #fd7e14; }
            .section-green { border-left: 5px solid #198754; }
            .section-gray { border-left: 5px solid #6c757d; }

            .sub-section-container { padding: 5px 20px 20px; }
            .sub-title { font-size: 14px; font-family: 'Moul', serif; margin: 20px 0 10px; padding-bottom: 8px; border-bottom: 2px dashed #eee; display: flex; align-items: center; gap: 8px; }
            
            table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; border: 1px solid #f0f0f0; border-radius: 10px; overflow: hidden; margin-bottom: 10px; }
            th { background: #f9fafb; color: #555; font-weight: bold; padding: 10px; border-bottom: 1px solid #eee; text-transform: uppercase; font-size: 11px; }
            td { padding: 10px; border-bottom: 1px solid #f5f5f5; text-align: center; vertical-align: middle; }
            tr:last-child td { border-bottom: none; }
            tr:hover td { background: #fcfcfc; }
            
            .amount-positive { color: #dc3545; font-weight: 800; background: #fff5f5; padding: 4px 8px; border-radius: 8px; font-size:12px; }
            
            /* Print Footer */
            .print-footer { display: none; }

            @media print {
                /* Set Margins */
                @page { margin: 20mm; }
                
                .no-print { display: none !important; }
                body { padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; height: auto; margin-bottom: 30px; }
                
                .header-container { 
                    border-bottom: 2px solid #8a0e5b !important; 
                    margin-bottom: 25px; 
                    padding: 0 0 20px 0;
                    box-shadow: none !important;
                    gap: 20px;
                    justify-content: space-between;
                }
                .school-text h1 { color: #8a0e5b !important; -webkit-text-fill-color: #8a0e5b; font-size: 22px; }
                .report-badge { 
                    background: white !important; 
                    color: black !important; 
                    border: 2px solid #8a0e5b; 
                    padding: 4px 15px;
                    font-size: 14px;
                    box-shadow: none !important;
                }

                .category-section { 
                    /* Allow breaking across pages to avoid blank pages */
                    break-inside: auto; 
                    page-break-inside: auto;
                    border: 1px solid #ddd !important; 
                    box-shadow: none !important; 
                    margin-bottom: 15px;
                    display: block; /* Ensure it behaves like a block */
                }
                
                .dashboard-grid { 
                    display: grid;
                    grid-template-columns: repeat(4, 1fr) !important; 
                    gap: 15px !important;
                    margin-top: 20px !important;
                    border-top: 1px dashed #999 !important;
                    padding-top: 20px !important;
                    break-inside: avoid; /* Keep summary together if possible */
                }
                .stat-card { 
                    border: 1px solid #ccc !important; 
                    box-shadow: none !important; 
                    padding: 8px !important;
                    background: #f9f9f9 !important;
                    flex-direction: column !important; /* Stack for better fit in Portrait */
                    justify-content: center;
                    text-align: center;
                    align-items: center;
                }
                .stat-icon { margin-bottom: 5px !important; margin-right: 0 !important; }
                .stat-value { font-size: 14px !important; }
                .stat-title { font-size: 11px !important; }
                
                table { border: 1px solid #999; width: 100%; border-collapse: collapse; }
                th { background-color: #eee !important; color: black !important; border: 1px solid #999; font-weight: bold; font-size: 10px; padding: 6px; }
                td { border: 1px solid #999; color: black; font-size: 10px; padding: 6px; }
                tr { break-inside: avoid; page-break-inside: avoid; }
                
                .section-header { background-color: #eee !important; border-bottom: 1px solid #999 !important; color: black !important;  padding: 6px 15px; font-size: 13px;}
                .print-footer {
                    display: flex;
                    position: fixed;
                    bottom: 0;
                    left: 0; 
                    width: 100%;
                    height: 30px;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 40px; /* Match header padding */
                    border-top: 1px solid #ccc;
                    font-size: 10px;
                    color: #666;
                    background: white;
                    z-index: 9999;
                }
                .page-number:after {
                    content: "Page " counter(page);
                }
            }
        </style>
        </head><body>

    <div class="action-bar no-print">
        <a href="javascript:void(0)" onclick="window.close()" class="btn-action btn-home"><i class="fa fa-times-circle"></i> បិទ (Close)</a>
        <button onclick="window.print()" class="btn-action btn-print"><i class="fa fa-print"></i> បោះពុម្ព (Print)</button>
    </div>

    <div class="header-container">
        <div class="logo-box">
            <img src="img/1.jpg" class="logo" onerror="this.src='img/logo.jpg'">
        </div>
        <div class="school-text">
            <h1>សាលាអន្តរជាតិ អាយធី ឃេ</h1>
            <h2>INTERNATIONAL SCHOOL ITK</h2>
            <div class="report-badge">របាយការណ៍បំណុលសិស្ស (Debt Report)</div>
        </div>
        <div class="date-box">
            <i class="fa fa-calendar-alt me-1"></i> ${new Date().toLocaleDateString('km-KH')}
        </div>
    </div>



    `;

    Object.keys(categories).forEach(catKey => {
        const cat = categories[catKey];
        const count = cat.groups.today.length + cat.groups.overdue.length + cat.groups.warning.length + cat.groups.unpaid.length;
        if (count === 0) return;

        let hdrClass = 'section-gray';
        if (catKey.includes('Fulltime')) hdrClass = 'section-blue';
        else if (catKey.includes('Parttime')) hdrClass = 'section-orange';
        else if (catKey.includes('Language')) hdrClass = 'section-green';

        html += `
            <div class="category-section">
                <div class="section-header ${hdrClass}">
                    <span><i class="fa fa-bookmark me-2"></i>${cat.title}</span>
                    <div>
                        <span class="badge" style="font-size:12px; color:#555; background:#f8f9fa; border:1px solid #eee; padding:5px 12px; border-radius:30px; margin-right:5px;">សិស្ស: ${count}</span>
                        <span class="badge" style="font-size:12px; color:#dc3545; background:#fff5f5; border:1px solid #ffebeb; padding:5px 12px; border-radius:30px;">$${cat.totalDebt.toFixed(2)}</span>
                    </div>
                </div>
                <div class="sub-section-container">
        `;

        const renderSubTable = (title, color, list, icon) => {
            if (list.length === 0) return '';
            let tbl = `
                <div class="sub-title" style="color:${color}"><i class="${icon}"></i> ${title} <span style="font-size:12px; color:#999; margin-left:5px;">(${list.length} នាក់)</span></div>
                <table>
                    <thead>
                        <tr>
                            <th width="40">L.R</th>
                            <th width="70">ID</th>
                            <th style="text-align:left;">ឈ្មោះសិស្ស</th>
                            <th width="50">ភេទ</th>
                            <th width="90">ម៉ោង</th>
                            <th width="100">គ្រូបន្ទុកថ្នាក់</th>
                            <th width="90">ទូរស័ព្ទឪពុក</th>
                            <th width="90">ទូរស័ព្ទម្តាយ</th>
                            <th width="100">ថ្ងៃកំណត់</th>
                            <th width="100">ស្ថានភាព</th>
                            <th width="90">ជំពាក់</th>
                        </tr>
                    </thead>
                    <tbody>`;

            list.forEach((s, idx) => {
                const statusObj = getPaymentStatus(s);
                const debt = calculateRemainingAmount(s);
                const days = statusObj.daysRemaining;
                const hasDate = s.nextPaymentDate && !['N/A', '', 'មិនមាន'].includes(s.nextPaymentDate);

                let badge = '';
                if (color === '#0d6efd') badge = `<span style="color:#0d6efd; background:#e7f1ff; padding:4px 10px; border-radius:50px; font-weight:bold; font-size:11px;">ថ្ងៃនេះ</span>`;
                else if (color === '#dc3545') badge = `<span style="color:#dc3545; background:#fff5f5; padding:4px 10px; border-radius:50px; font-weight:bold; font-size:11px;">ហួស ${Math.abs(days)} ថ្ងៃ</span>`;
                else if (color === '#fd7e14') badge = `<span style="color:#fd7e14; background:#fff9db; padding:4px 10px; border-radius:50px; font-weight:bold; font-size:11px;">សល់ ${days} ថ្ងៃ</span>`;
                else badge = `<span style="color:#666; background:#f8f9fa; padding:4px 10px; border-radius:50px; font-size:11px;">មិនទាន់បង់</span>`;

                tbl += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td style="font-weight:bold; color:#555;">${s.displayId}</td>
                        <td style="text-align:left;">
                            <div style="font-weight:bold; color:#333;">${s.lastName || ''} ${s.firstName || ''}</div>
                            <div style="font-size:11px; color:#888; text-transform:uppercase;">${s.englishLastName || ''} ${s.englishFirstName || ''}</div>
                        </td>
                        <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                        <td>${s.studyTime || '-'}</td>
                        <td style="font-size:12px; color:#555;">${s.homeroomTeacher || s.teacherName || '-'}</td>
                        <td style="font-size:11px;">${s.fatherPhone || '-'}</td>
                        <td style="font-size:11px;">${s.motherPhone || '-'}</td>
                        <td style="font-weight:bold;">${hasDate ? toKhmerDate(s.nextPaymentDate) : '-'}</td>
                        <td>${badge}</td>
                        <td class="amount-positive">$${debt.toFixed(2)}</td>
                    </tr>`;
            });
            tbl += `</tbody></table>`;
            return tbl;
        };

        html += renderSubTable('ត្រូវបង់ថ្ងៃនេះ (Due Today)', '#0d6efd', cat.groups.today, 'fa fa-calendar-day');
        html += renderSubTable('ហួសកំណត់ (Overdue)', '#dc3545', cat.groups.overdue, 'fa fa-exclamation-circle');
        html += renderSubTable('ជិតដល់ថ្ងៃ (Upcoming)', '#fd7e14', cat.groups.warning, 'fa fa-clock');
        html += renderSubTable('មិនទាន់បង់ផ្សេងៗ (Other Unpaid)', '#6c757d', cat.groups.unpaid, 'fa fa-file-invoice-dollar');

        html += `</div></div>`;
    });

    html += `
    <div class="dashboard-grid" style="margin-top: 50px; border-top: 2px dashed #ddd; padding-top: 30px; break-inside: avoid;">
        <div class="stat-card blue">
            <div class="stat-icon"><i class="fa fa-calendar-day"></i></div>
            <div class="stat-title">ត្រូវបង់ថ្ងៃនេះ</div>
            <div class="stat-value">${stats.today.count} នាក់</div>
            <div class="stat-debt">$${stats.today.amount.toFixed(2)}</div>
        </div>
        <div class="stat-card red">
            <div class="stat-icon"><i class="fa fa-exclamation-triangle"></i></div>
            <div class="stat-title">ហួសកំណត់</div>
            <div class="stat-value">${stats.overdue.count} នាក់</div>
            <div class="stat-debt">$${stats.overdue.amount.toFixed(2)}</div>
        </div>
        <div class="stat-card orange">
            <div class="stat-icon"><i class="fa fa-clock"></i></div>
            <div class="stat-title">ជិតដល់ថ្ងៃ</div>
            <div class="stat-value">${stats.warning.count} នាក់</div>
            <div class="stat-debt">$${stats.warning.amount.toFixed(2)}</div>
        </div>
        <div class="stat-card gray">
            <div class="stat-icon"><i class="fa fa-users"></i></div>
            <div class="stat-title">សរុបរួម</div>
            <div class="stat-value" style="color:#8a0e5b;">${stats.total.count} នាក់</div>
            <div class="stat-debt" style="color:#dc3545;">$${stats.total.amount.toFixed(2)}</div>
        </div>
    </div>`;

    html += `
        <div style="margin-top: 60px; display: flex; justify-content: space-around; break-inside: avoid;">
            <div style="text-align: center;">
                <p style="font-weight:bold; color:#555;">រៀបចំដោយ</p>
                <div style="height:60px;"></div>
                <div style="width:120px; border-top:1px solid #bbb; margin:0 auto;"></div>
                <p style="margin-top:8px; font-size:13px; color:#777;">បេឡាករ</p>
            </div>
            <div style="text-align: center;">
                <p style="font-weight:bold; color:#555;">ត្រួតពិនិត្យដោយ</p>
                <div style="height:60px;"></div>
                <div style="width:120px; border-top:1px solid #bbb; margin:0 auto;"></div>
                <p style="margin-top:8px; font-size:13px; color:#777;">ប្រធានគណនេយ្យ</p>
            </div>
            <div style="text-align: center;">
                <p style="font-weight:bold; color:#555;">អនុម័តដោយ</p>
                <div style="height:60px;"></div>
                <div style="width:120px; border-top:1px solid #bbb; margin:0 auto;"></div>
                <p style="margin-top:8px; font-size:13px; color:#777;">នាយកសាលា</p>
            </div>
        </div>
        
        <div class="print-footer">
            <div>International School ITK</div>
            <div class="page-number"></div>
            <div>${new Date().toLocaleDateString('en-GB')}</div>
        </div>
    </body></html>`;

    win.document.write(html);
    win.document.close();
}

function generateStandardPDF(students, title, subtitle = '') {
    if (!students || students.length === 0) return showAlert('គ្មានទិន្នន័យសម្រាប់បង្កើតរបាយការណ៍', 'warning');

    // Sort by ID or relevant field
    students.sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

    let totalDueAmount = 0;
    students.forEach(s => totalDueAmount += calculateRemainingAmount(s));

    let win = window.open('', '_blank');
    let html = `<html><head><title>${title}</title>
        <base href="${window.location.href}">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            @page { margin: 20mm; size: auto; }
            @font-face {
                font-family: 'Khmer OS Battambang';
                src: url('fonts/KhmerOSBattambang.woff2') format('woff2'),
                     url('fonts/KhmerOSBattambang.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
            @font-face {
                font-family: 'Khmer OS Battambang';
                src: url('fonts/KhmerOSBattambang.ttf') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
            body { 
                font-family: 'Khmer OS Battambang', sans-serif !important; 
                padding: 20px; 
                color: #333; 
                background: #fff; 
                margin-bottom: 40px;
            }
            .header-container { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
            .logo { width: 90px; height: 90px; object-fit: cover; margin-bottom: 5px; }
            .school-text h1 { margin: 0; font-size: 1.6rem; color: #2c3e50; font-weight: bold; }
            .school-text h2 { margin: 5px 0 0; font-size: 1.1rem; color: #c71585; font-weight: bold; }
            .report-title { text-align: center; margin: 20px 0; }
            .report-title h2 { margin: 0; color: #d63384; text-transform: uppercase; font-size: 1.3rem; text-decoration: underline; }
            .report-subtitle { margin-top: 5px; font-weight: bold; color: #555; }
            .date-info { text-align: right; margin-top: 10px; font-size: 0.9rem; font-style: italic; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem; }
            th, td { border: 1px solid #444; padding: 8px 4px; text-align: center; vertical-align: middle; }
            th { background-color: #f1f1f1; color: #333; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            
            .text-left { text-align: left !important; padding-left: 8px; }
            .text-right { text-align: right !important; padding-right: 8px; }
            .text-danger { color: #dc3545; }
            
            .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 0.9rem; page-break-inside: avoid; }
            .signature-box { text-align: center; width: 200px; }
            .signature-line { margin-top: 50px; border-top: 1px solid #333; width: 80%; margin-left: auto; margin-right: auto; }

            /* Buttons */
            .action-bar { margin-bottom: 20px; display: flex; gap: 10px; justify-content: flex-end; }
            .btn { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-family: inherit; font-weight: bold; display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: 0.9rem; }
            .btn-print { background: #0d6efd; color: white; }
            .btn-close { background: #6c757d; color: white; }
            .btn-close:hover { background: #5a6268; }

            .print-footer { display: none; }

            @media print { 
                @page { margin: 20mm; }
                .no-print { display: none !important; } 
                body { padding: 0; margin-bottom: 40px; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                
                 .print-footer {
                     display: flex;
                     position: fixed;
                     bottom: 0;
                     left: 0; 
                     width: 100%;
                     height: 30px;
                     justify-content: space-between;
                     align-items: center;
                     padding: 0 40px;
                     border-top: 1px solid #ccc;
                     font-size: 10px;
                     color: #666;
                     background: white;
                     z-index: 9999;
                 }
                 .page-number:after {
                    content: "Page " counter(page);
                 }
            }
        </style></head><body>
        
        <div class="action-bar no-print">
            <a href="data-tracking.html" class="btn btn-close" onclick="window.close(); return false;">
                <i class="fi fi-rr-arrow-left"></i> ត្រឡប់ទៅផ្ទាំងដើម
            </a>
            <button class="btn btn-print" onclick="window.print()">
                <i class="fi fi-rr-print"></i> បោះពុម្ពឯកសារ
            </button>
        </div>

        <div class="header-container">
            <img src="img/logo.jpg" class="logo" onerror="this.src='img/1.jpg'">
            <div class="school-text">
                <h1>សាលាអន្តរជាតិ អាយធី ឃេ</h1>
                <h2>INTERNATIONAL SCHOOL ITK</h2>
            </div>
            <div class="report-title">
                <h2>${title}</h2>
                ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ''}
            </div>
            <div class="date-info">
                កាលបរិច្ឆេទបញ្ចេញ: ${new Date().toLocaleDateString('en-GB')}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="4%">ល.រ</th>
                    <th width="8%">អត្តលេខ</th>
                    <th width="15%">ឈ្មោះសិស្ស</th>
                    <th width="5%">ភេទ</th>
                    <th width="10%">លេខទូរស័ព្ទ</th>
                    <th width="8%">កំរិតសិក្សា</th>
                    <th width="8%">ម៉ោងសិក្សា</th>
                    <th width="8%">ថ្ងៃចុះឈ្មោះ</th>
                    <th width="8%">ថ្ងៃកំណត់</th>
                    <th width="12%">គ្រូបន្ទុកថ្នាក់</th>
                    <th width="8%">ស្ថានភាព</th>
                     <th width="8%">ទឹកប្រាក់ខ្វះ</th>
                </tr>
            </thead>
            <tbody>`;

    students.forEach((s, index) => {
        const statusObj = getPaymentStatus(s);

        // Date Formatting
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            if (dateStr.includes('-')) {
                const d = new Date(dateStr);
                return isNaN(d) ? dateStr : d.toLocaleDateString('en-GB');
            }
            if (dateStr.includes('/')) return dateStr;
            return dateStr;
        };

        html += `<tr>
            <td>${index + 1}</td>
            <td style="font-weight: bold;">${s.displayId}</td>
            <td class="text-left">${s.lastName} ${s.firstName}</td>
            <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
            <td>${s.personalPhone || '-'}</td>
            <td>${s.studyLevel || '-'}</td>
            <td>${s.studyTime || '-'}</td>
            <td>${formatDate(s.startDate)}</td>
            <td>${formatDate(s.nextPaymentDate)}</td>
            <td>${s.teacherName || 'មិនបញ្ជាក់'}</td>
            <td>${statusObj.text}</td>
            <td class="text-right ${calculateRemainingAmount(s) > 0 ? 'text-danger fw-bold' : ''}">$${calculateRemainingAmount(s).toFixed(2)}</td>
        </tr>`;
    });

    html += `
            <tr style="background-color: #f0f0f0; font-weight: bold;">
                <td colspan="11" class="text-right">សរុបទឹកប្រាក់ដែលនៅខ្វះ (Total Outstanding):</td>
                <td class="text-danger text-right">$${totalDueAmount.toFixed(2)}</td>
            </tr>
            </tbody>
        </table>

        <div class="footer">
            <div class="signature-box">
                <p>រៀបចំដោយ</p>
                <div class="signature-line"></div>
                <p>បេឡាករ</p>
            </div>
            <div class="signature-box">
                <p>ត្រួតពិនិត្យដោយ</p>
                <div class="signature-line"></div>
                <p>ប្រធានគណនេយ្យ</p>
            </div>
            <div class="signature-box">
                <p>អនុម័តដោយ</p>
                <div class="signature-line"></div>
                <p>នាយកសាលា</p>
            </div>
        </div>
        
        <div class="print-footer">
            <div>International School ITK</div>
            <div class="page-number"></div>
            <div>${new Date().toLocaleDateString('en-GB')}</div>
        </div>
    </body></html>`;

    win.document.write(html);
    win.document.close();
}

function downloadMonthlyReport(type) {
    const currentYear = new Date().getFullYear();
    const promptMonth = prompt("សូមបញ្ចូលខែ (1-12):", new Date().getMonth() + 1);
    if (!promptMonth) return;

    const promptYear = prompt("សូមបញ្ចូលឆ្នាំ:", currentYear);
    if (!promptYear) return;

    const month = parseInt(promptMonth);
    const year = parseInt(promptYear);

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        return showAlert('ទិន្នន័យមិនត្រឹមត្រូវ', 'danger');
    }

    const students = Object.values(allStudentsData).filter(s => {
        if (!s.startDate) return false;
        try {
            // Handle YYYY-MM-DD or DD/MM/YYYY
            let d;
            if (s.startDate.includes('/')) {
                const parts = s.startDate.split('/');
                d = new Date(parts[2], parts[1] - 1, parts[0]); // DD/MM/YYYY
            } else {
                d = new Date(s.startDate);
            }
            return d.getMonth() + 1 === month && d.getFullYear() === year;
        } catch (e) { return false; }
    });

    if (students.length === 0) return showAlert(`គ្មានសិស្សចុះឈ្មោះក្នុងខែ ${month}/${year}`, 'info');

    const title = `របាយការណ៍ប្រចាំខែ ${month} ឆ្នាំ ${year}`;
    const subtitle = `សិស្សចុះឈ្មោះថ្មី (New Registrations)`;

    if (type === 'pdf') {
        generateStandardPDF(students, title, subtitle);
    } else {
        exportToExcel(students, `Monthly_Report_${month}_${year}`);
    }
}

function downloadYearlyReport(type) {
    const currentYear = new Date().getFullYear();
    const promptYear = prompt("សូមបញ្ចូលឆ្នាំ:", currentYear);
    if (!promptYear) return;

    const year = parseInt(promptYear);
    if (isNaN(year)) return showAlert('ឆ្នាំមិនត្រឹមត្រូវ', 'danger');

    const students = Object.values(allStudentsData).filter(s => {
        if (!s.startDate) return false;
        try {
            let d;
            if (s.startDate.includes('/')) {
                const parts = s.startDate.split('/');
                d = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                d = new Date(s.startDate);
            }
            return d.getFullYear() === year;
        } catch (e) { return false; }
    });

    if (students.length === 0) return showAlert(`គ្មានសិស្សចុះឈ្មោះក្នុងឆ្នាំ ${year}`, 'info');

    const title = `របាយការណ៍ប្រចាំឆ្នាំ ${year}`;
    const subtitle = `សិស្សចុះឈ្មោះថ្មី (New Registrations)`;

    if (type === 'pdf') {
        generateStandardPDF(students, title, subtitle);
    } else {
        exportToExcel(students, `Yearly_Report_${year}`);
    }
}

function generateDetailedAlertReport() {
    // 1. Filter students who are overdue or warning
    const alertStudents = Object.values(allStudentsData).filter(s => {
        const status = getPaymentStatus(s);
        const remaining = calculateRemainingAmount(s);
        // "Overdue" or "Warning" AND has remaining balance
        return ['overdue', 'warning'].includes(status.status) && remaining > 0;
    });

    if (alertStudents.length === 0) return showAlert('គ្មានសិស្សត្រូវជូនដំណឹង (No students to alert)', 'info');

    // 2. Define Categories
    const categories = {
        'chinese_full': { label: 'ថ្នាក់ភាសាចិនពេញម៉ោង (Chinese Full-time)', students: [], total: 0 },
        'chinese_part': { label: 'ថ្នាក់ភាសាចិនក្រៅម៉ោង (Chinese Part-time)', students: [], total: 0 },
        'lang_1': { label: 'ថ្នាក់ភាសា (១ភាសា / 1 Language)', students: [], total: 0 },
        'lang_2': { label: 'ថ្នាក់ភាសា (២ភាសា / 2 Languages)', students: [], total: 0 },
        'lang_3': { label: 'ថ្នាក់ភាសា (៣ភាសា / 3 Languages)', students: [], total: 0 },
        'other': { label: 'ផ្សេងៗ (Other)', students: [], total: 0 }
    };

    // 3. Categorize Students
    alertStudents.forEach(s => {
        const level = (s.studyLevel || '').toLowerCase();
        let catKey = 'other';

        if (level.includes('ពេញម៉ោង') || level.includes('full')) {
            catKey = 'chinese_full';
        } else if (level.includes('ក្រៅម៉ោង') || level.includes('part')) {
            catKey = 'chinese_part';
        } else if (level.includes('១ភាសា') || level.includes('1 language')) {
            catKey = 'lang_1';
        } else if (level.includes('២ភាសា') || level.includes('2 language')) {
            catKey = 'lang_2';
        } else if (level.includes('៣ភាសា') || level.includes('3 language')) {
            catKey = 'lang_3';
        }

        categories[catKey].students.push(s);
        categories[catKey].total += calculateRemainingAmount(s);
    });

    let grandTotal = 0;
    Object.values(categories).forEach(c => grandTotal += c.total);

    let win = window.open('', '_blank');
    let html = `<html><head><title>របាយការណ៍សិស្សហួសកំណត់បង់ប្រាក់</title>
        <base href="${window.location.href}">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            @font-face {
                font-family: 'Khmer OS Battambang';
                src: url('fonts/KhmerOSBattambang.woff2') format('woff2'),
                    url('fonts/KhmerOSBattambang.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
            @font-face {
                font-family: 'Khmer OS Battambang';
                src: url('fonts/KhmerOSBattambang.ttf') format('truetype');
                font-weight: bold;
                font-style: normal;
            }
            @page { margin: 20mm; size: auto; }
            body { 
                font-family: 'Khmer OS Battambang', sans-serif !important; 
                padding: 20px; 
                margin: 0;
                color: #333; 
                background: #f8f9fa; 
                margin-bottom: 40px;
            }
            .header-container { text-align: center; margin-bottom: 20px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .logo { width: 90px; height: 90px; object-fit: cover; margin-bottom: 30px; }
            .school-text h1 { margin: 0; font-size: 1.6rem; color: #2c3e50; font-weight: bold; }
            .school-text h2 { margin: 5px 0 0; font-size: 1.1rem; color: #c71585; font-weight: bold; }
            .report-title h2 { margin: 15px 0; color: #d63384; text-transform: uppercase; font-size: 1.3rem; text-decoration: underline; }
            .date-info { text-align: right; margin-top: 5px; font-size: 0.9rem; font-style: italic; color: #666; }
            
            .section-container { margin-bottom: 30px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .section-header { 
                background-color: #e9ecef; 
                padding: 10px 15px; 
                font-weight: bold; 
                color: #495057; 
                border-left: 5px solid #d63384; 
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 0.85rem; }
            th, td { border: 1px solid #dee2e6; padding: 8px 5px; text-align: center; vertical-align: middle; }
            th { background-color: #212529; color: #fff; font-weight: normal; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            
            .text-left { text-align: left !important; padding-left: 10px; }
            .text-right { text-align: right !important; padding-right: 10px; }
            .text-danger { color: #dc3545; font-weight: bold; }
            .text-warning { color: #fd7e14; font-weight: bold; }
            .fw-bold { font-weight: bold; }

            .summary-card {
                display: inline-block;
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 10px 15px;
                margin: 0 10px 10px 0;
                min-width: 200px;
                text-align: left;
            }
            .summary-card h4 { margin: 0 0 5px 0; font-size: 0.9rem; color: #6c757d; }
            .summary-card p { margin: 0; font-size: 1.1rem; font-weight: bold; color: #d63384; }

            /* Action Bar */
            /* Action Bar - Changed from fixed to sticky/relative so it doesn't block content */
            .action-bar { 
                position: relative;
                top: 0; 
                left: 0; 
                width: 100%; 
                background: #343a40; 
                padding: 10px 20px; 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 20px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .content-wrapper { margin-top: 0; } /* Removed margin-top since bar is not fixed */

            .footer { margin-top: 40px; display: flex; justify-content: space-around; font-size: 0.9rem; page-break-inside: avoid; background: white; padding: 20px; border-radius: 8px; }
            .signature-box { text-align: center; width: 200px; }
            .signature-line { margin-top: 50px; border-top: 1px solid #333; width: 80%; margin-left: auto; margin-right: auto; }

            .print-footer { display: none; }

            @media print { 
                @page { margin: 20mm; }
                .no-print { display: none !important; } 
                body { padding: 0; background: white; margin-bottom: 40px; }
                .content-wrapper { margin-top: 0; }
                .header-container { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #8a0e5b !important; }
                /* Allow sections to break across pages */
                .section-container { box-shadow: none; border: 1px solid #eee; break-inside: auto; }
                .section-header { background: #f8f9fa; border-left-color: #000; color: #000; }
                th { background-color: #e9ecef; color: #000; font-weight: bold; border-color: #000; }
                td { border-color: #000; }
                tr { break-inside: avoid; page-break-inside: avoid; }
                thead { display: table-header-group; }
                .summary-card { border: 1px solid #000; }
                .summary-card p { color: #000; }

                .print-footer {
                     display: flex;
                     position: fixed;
                     bottom: 0;
                     left: 0; 
                     width: 100%;
                     height: 30px;
                     justify-content: space-between;
                     align-items: center;
                     padding: 0 40px;
                     border-top: 1px solid #ccc;
                     font-size: 10px;
                     color: #666;
                     background: white;
                     z-index: 9999;
                 }
                 .page-number:after {
                    content: "Page " counter(page);
                 }
            }
        </style>
        <script>
            function searchTable() {
                var input, filter, tables, tr, td, i, txtValue;
                input = document.getElementById("searchReportInput");
                filter = input.value.toUpperCase();
                // Search all tbody rows
                tables = document.getElementsByTagName("table");
                for (var t = 0; t < tables.length; t++) {
                     tr = tables[t].getElementsByTagName("tr");
                     for (i = 0; i < tr.length; i++) {
                        // Check multiple columns (ID, Name)
                        var tdId = tr[i].getElementsByTagName("td")[1];
                        var tdName = tr[i].getElementsByTagName("td")[2];
                        if (tdId || tdName) {
                            var txtId = tdId ? (tdId.textContent || tdId.innerText) : "";
                            var txtName = tdName ? (tdName.textContent || tdName.innerText) : "";
                            if (txtId.toUpperCase().indexOf(filter) > -1 || txtName.toUpperCase().indexOf(filter) > -1) {
                                tr[i].style.display = "";
                            } else {
                                // Don't hide header rows or footer rows if they exist in main body (unlikely here)
                                // Only hide data rows
                                if(tr[i].getElementsByTagName("td").length > 0 && !tr[i].classList.contains("total-row")) {
                                     tr[i].style.display = "none";
                                }
                            }
                        }
                     }
                }
            }
        </script>
        </head><body>
        
        <div class="action-bar no-print">
            <div class="d-flex align-items-center">
                 <h4><i class="fas fa-file-invoice-dollar me-2"></i>របាយការណ៍ហួសកំណត់</h4>
            </div>
            <div class="d-flex align-items-center">
                 <div class="search-container me-3">
                    <i class="fas fa-search text-muted"></i>
                    <input type="text" id="searchReportInput" class="search-input" onkeyup="searchTable()" placeholder="ស្វែងរកឈ្មោះ/អត្តលេខ...">
                 </div>
                <a href="data-tracking.html" class="btn btn-back" onclick="window.close(); return false;">
                    <i class="fas fa-home"></i> ត្រឡប់ទៅផ្ទាំងដើម
                </a>
                <button class="btn btn-print ms-2" onclick="window.print()">
                    <i class="fas fa-print"></i> បោះពុម្ព
                </button>
            </div>
        </div>

        <div class="content-wrapper">
            <div class="header-container">
                <img src="img/logo.jpg" class="logo" onerror="this.src='img/1.jpg'">
                <div class="school-text">
                    <h1>សាលាអន្តរជាតិ អាយធី ឃេ</h1>
                    <h2>INTERNATIONAL SCHOOL ITK</h2>
                </div>
                <div class="report-title">
                    <h2>របាយការណ៍សិស្សហួសកំណត់បង់ប្រាក់</h2>
                </div>
                <div class="date-info">
                    កាលបរិច្ឆេទ: ${new Date().toLocaleDateString('en-GB')}
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <div class="summary-card">
                        <h4>សរុបសិស្សហួសកំណត់</h4>
                        <p>${alertStudents.length} នាក់</p>
                    </div>
                     <div class="summary-card">
                        <h4>ទឹកប្រាក់ខ្វះសរុប</h4>
                        <p class="text-danger">$${grandTotal.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            ${Object.keys(categories).map(key => {
        const cat = categories[key];
        if (cat.students.length === 0) return ''; // Skip empty categories

        // Sort students in category
        cat.students.sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

        return `
                <div class="section-container">
                    <div class="section-header">
                        <span>${cat.label.toUpperCase()}</span>
                        <span class="badge bg-danger text-white px-2 rounded">${cat.students.length} នាក់</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th width="4%">ល.រ</th>
                                <th width="7%">អត្តលេខ</th>
                                <th width="15%">ឈ្មោះសិស្ស</th>
                                <th width="5%">ភេទ</th>
                                <th width="10%">គ្រូបន្ទុកថ្នាក់</th>
                                <th width="10%">មុខវិជ្ជា</th>
                                <th width="10%">ម៉ោងសិក្សា</th>
                                <th width="8%">កាលបរិច្ឆេទបង់</th>
                                <th width="8%">ចំនួនខែ</th>
                                <th width="12%">ស្ថានភាព</th>
                                <th width="10%">ទឹកប្រាក់ខ្វះ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cat.students.map((s, index) => {
            const statusObj = getPaymentStatus(s);
            const days = statusObj.daysRemaining;
            let statusLabel = "";
            let statusClass = "";

            if (days < 0) {
                statusLabel = `ហួស ${Math.abs(days)} ថ្ងៃ`;
                statusClass = "text-danger";
            } else {
                statusLabel = `ជិតដល់ (${days} ថ្ងៃទៀត)`;
                statusClass = "text-warning";
            }

            // Override if unpaid but not strictly overdue by date logic (rare but possible if manually set)
            if (statusObj.status === 'paid') statusLabel = "បានបង់ (Verified)"; // Should not happen due to filter

            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td class="fw-bold">${s.displayId}</td>
                                    <td class="text-left">${s.lastName} ${s.firstName}</td>
                                    <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                                    <td>${s.teacherName || '-'}</td>
                                    <td>${s.subject || '-'}</td>
                                    <td>${s.studyTime || '-'}</td>
                                    <td>${s.nextPaymentDate || '-'}</td>
                                    <td>${s.paymentMonths || 1} ខែ</td>
                                    <td class="${statusClass}">${statusLabel}</td>
                                    <td class="text-right text-danger">$${calculateRemainingAmount(s).toFixed(2)}</td>
                                </tr>
                                `;
        }).join('')}
                            <tr class="total-row" style="background-color: #ffe6e6; font-weight: bold;">
                                <td colspan="9" class="text-right">សរុបផ្នែកនេះ (Subtotal):</td>
                                <td class="text-right text-danger">$${cat.total.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                `;
    }).join('')}

            <div class="footer">
                <div class="signature-box">
                    <p>រៀបចំដោយ</p>
                    <div class="signature-line"></div>
                    <p>បេឡាករ</p>
                </div>
                <div class="signature-box">
                    <p>ត្រួតពិនិត្យដោយ</p>
                    <div class="signature-line"></div>
                    <p>ប្រធានគណនេយ្យ</p>
                </div>
                <div class="signature-box">
                    <p>អនុម័តដោយ</p>
                    <div class="signature-line"></div>
                    <p>នាយកសាលា</p>
                </div>
            </div>
        </div>
        
        <div class="print-footer">
            <div>International School ITK</div>
            <div class="page-number"></div>
            <div>${new Date().toLocaleDateString('en-GB')}</div>
        </div>
    </body></html>`;

    win.document.write(html);
    win.document.close();
}

function generateMonthlyReport() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const monthlyStudents = Object.values(allStudentsData).filter(student => {
        if (!student.startDate || student.startDate === 'មិនមាន') return false;
        try {
            const engStartDate = convertToEnglishDate(student.startDate);
            if (!engStartDate) return false;
            const dateParts = engStartDate.split('/');
            return parseInt(dateParts[0]) === currentMonth && parseInt(dateParts[2]) === currentYear;
        } catch (e) { return false; }
    });

    if (monthlyStudents.length === 0) {
        return showAlert('គ្មានទិន្នន័យសិស្សចុះឈ្មោះក្នុងខែនេះទេ', 'info');
    }

    monthlyStudents.sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

    let win = window.open('', '_blank');
    let html = `<html><head><title>របាយការណ៍ប្រចាំខែ</title>
        <base href="${window.location.href}">
        <style>
            @font-face {
                font-family: 'Khmer OS Battambang';
                src: url('fonts/KhmerOSBattambang.ttf') format('truetype');
            }
            body { font-family: 'Khmer OS Battambang', sans-serif; padding: 40px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid #3498db; padding-bottom: 20px; }
            .school-info { display: flex; align-items: center; gap: 20px; }
            .logo { width: 80px; height: 80px; object-fit: cover; border-radius: 10px; border: 2px solid #3498db; }
            .school-name h2 { margin: 0; color: #2980b9; }
            .school-name p { margin: 5px 0 0; font-size: 0.9rem; color: #666; }
            .report-title { text-align: center; margin: 30px 0; }
            .report-title h1 { color: #2980b9; font-size: 1.8rem; text-decoration: underline; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
            th, td { border: 1px solid #dee2e6; padding: 12px; text-align: center; }
            th { background: linear-gradient(135deg, #3498db, #2980b9); color: white; }
            tr:nth-child(even) { background-color: #fcfcfc; }
            .footer { margin-top: 50px; text-align: right; font-style: italic; font-size: 0.9rem; }
            @media print { 
                .no-print { display: none; } 
                tr { break-inside: avoid; page-break-inside: avoid; }
                thead { display: table-header-group; }
            }
        </style></head><body>`;

    html += `
        <div class="header">
            <div class="school-info">
                <img src="img/1.jpg" class="logo">
                <div class="school-name">
                    <h2>សាលាអន្តរជាតិ (International School)</h2>
                    <p>របាយការណ៍សិស្សចុះឈ្មោះថ្មីប្រចាំខែ</p>
                </div>
            </div>
            <div class="date-info">
                <p>ខែ: ${currentMonth}/${currentYear}</p>
                <button class="no-print" onclick="window.print()" style="padding: 8px 20px; background: #2980b9; color: white; border: none; border-radius: 5px; cursor: pointer;">បោះពុម្ព</button>
            </div>
        </div>
        <div class="report-title">
            <h1>របាយការណ៍សិស្សចុះឈ្មោះថ្មីប្រចាំខែ ${currentMonth} ឆ្នាំ ${currentYear}</h1>
        </div>
        <table>
            <thead>
                <tr>
                    <th>អត្តលេខ</th>
                    <th>ឈ្មោះសិស្ស</th>
                    <th>ថ្ងៃចុះឈ្មោះ</th>
                    <th>តម្លៃសិក្សាសរុប ($)</th>
                </tr>
            </thead>
            <tbody>`;

    monthlyStudents.forEach(s => {
        html += `<tr>
            <td style="font-weight: bold; color: #2980b9;">${s.displayId}</td>
            <td>${s.lastName} ${s.firstName}</td>
            <td>${s.startDate}</td>
            <td style="font-weight: bold;">$${calculateTotalAmount(s).toFixed(2)}</td>
        </tr>`;
    });

    html += `</tbody></table>
        <div class="footer">
            <p>បោះពុម្ពដោយប្រព័ន្ធគ្រប់គ្រងសាលា នៅថ្ងៃទី ${new Date().toLocaleString('km-KH')}</p>
        </div>
    </body></html>`;

    win.document.write(html);
    win.document.close();
}

function checkAllPayments() {
    if (!allStudentsData || Object.keys(allStudentsData).length === 0) {
        showAlert('គ្មានទិន្នន័យសិស្សទេ', 'info');
        return;
    }

    let warningCount = 0;
    let overdueCount = 0;
    let totalDue = 0;

    Object.values(allStudentsData).forEach(student => {
        const paymentStatus = getPaymentStatus(student);
        if (paymentStatus.status === 'warning') {
            warningCount++;
            totalDue += calculateRemainingAmount(student);
        } else if (paymentStatus.status === 'overdue') {
            overdueCount++;
            totalDue += calculateRemainingAmount(student);
        }
    });

    const totalAlerts = warningCount + overdueCount;

    if (totalAlerts > 0) {
        showAlert(`ការពិនិត្យ៖ ${overdueCount} នាក់ហួសកំណត់, ${warningCount} នាក់ជិតដល់កំណត់ | សរុបទឹកប្រាក់ខ្វះ: $${totalDue.toFixed(2)}`, 'warning', 8000);
    } else {
        showAlert('គ្មានសិស្សហួសកំណត់ ឬជិតដល់កំណត់ទេ', 'success');
    }
}

// ----------------------------------------------------
// Init
// ----------------------------------------------------


let systemUserNames = [];


function fetchSystemUsers() {
    firebase.database().ref('users').once('value').then(snapshot => {
        const users = snapshot.val();
        if (users) {
            systemUserNames = Object.values(users).map(u => u.name).filter(n => n);
        }
    }).catch(err => console.error("Error fetching users:", err));
}

function getReceiverSelectHtml(selectedValue, nameAttr, classAttr, idAttr) {
    let html = `<select class="form-select ${classAttr || ''}" name="${nameAttr || ''}" ${idAttr ? `id="${idAttr}"` : ''}>`;
    html += `<option value="">ជ្រើសរើសអ្នកទទួល...</option>`;

    // Sort names
    let options = [...new Set(systemUserNames)].sort();

    options.forEach(name => {
        const selected = (selectedValue === name) ? 'selected' : '';
        html += `<option value="${name}" ${selected}>${name}</option>`;
    });

    // If selectedValue is not in the list (legacy data or manual entry), add it as an option
    if (selectedValue && !options.includes(selectedValue)) {
        html += `<option value="${selectedValue}" selected>${selectedValue}</option>`;
    }

    html += `</select>`;
    return html;
}

function getPaymentMethodSelectHtml(selectedValue, nameAttr, classAttr, idAttr) {
    let html = `<select class="form-select ${classAttr || ''}" name="${nameAttr || ''}" ${idAttr ? `id="${idAttr}"` : ''}>`;
    // User requested specifically "តាមធនាគារ (Bank)" and "ប្រាក់សុទ្ធ (Cash)"
    const methods = [
        { value: "Cash", label: "ប្រាក់សុទ្ធ (Cash)" },
        { value: "Bank", label: "តាមធនាគារ (Bank)" }
    ];

    methods.forEach(m => {
        const selected = (selectedValue === m.value) ? 'selected' : '';
        html += `<option value="${m.value}" ${selected}>${m.label}</option>`;
    });

    // Legacy check
    if (selectedValue && !methods.some(m => m.value === selectedValue)) {
        html += `<option value="${selectedValue}" selected>${selectedValue}</option>`;
    }

    html += `</select>`;
    return html;
}

function setupSearchListener() {
    $('#searchName').off('input keyup paste search').on('input keyup paste search', function () {
        currentFilters.searchName = $(this).val();
        renderFilteredTable();
    });

    // Prevent Enter form submission
    $('#searchName').off('keypress').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            return false;
        }
    });
}


// Ensure this is globally available for the HTML oninput attribute
window.handleSearchInput = function (element) {
    if (!element) return;
    currentFilters.searchName = $(element).val();
    renderFilteredTable();
};

$(document).ready(function () {
    fetchSystemUsers();
    loadStudentData();

    // Notification Panel Toggle
    $('#notificationsBtn').on('click', (e) => {
        e.stopPropagation();
        $('#alertPanel').toggleClass('show');
    });
    $(document).on('click', () => $('#alertPanel').removeClass('show'));

    // Button Actions
    $(document).on('click', '.edit-btn', function (e) { e.stopPropagation(); showEditModal($(this).data('key')); });
    $(document).on('click', '.delete-btn', function (e) { e.stopPropagation(); deleteStudent($(this).data('key'), $(this).data('display-id')); });
    $(document).on('click', '.mark-paid-btn', function (e) { e.stopPropagation(); markAsPaid($(this).data('key')); });

    // Report/Export Buttons
    $('#exportExcelBtn').on('click', exportToExcel);
    $('#exportPDFBtn').on('click', generateDetailedAlertReport);

    // Filter Listeners
    // Call search listener immediately (using global function)
    setupSearchListener();
    $('#filterStatus').on('change', function () { currentFilters.status = $(this).val(); renderFilteredTable(); });
    $('#filterTime').on('change', function () { currentFilters.filterTime = $(this).val(); renderFilteredTable(); });
    $('#filterLevel').on('change', function () { currentFilters.filterLevel = $(this).val(); renderFilteredTable(); });
    $('#filterGender').on('change', function () { currentFilters.gender = $(this).val(); renderFilteredTable(); });
    $('#startDateFilter').on('change', function () { currentFilters.startDate = $(this).val(); renderFilteredTable(); });
    $('#endDateFilter').on('change', function () { currentFilters.endDate = $(this).val(); renderFilteredTable(); });

    $('#clearFiltersBtn').on('click', function () {
        currentFilters = {
            searchName: '',
            status: 'all',
            filterTime: 'all',
            filterLevel: 'all',
            gender: 'all',
            startDate: '',
            endDate: ''
        };
        $('#searchName').val('');
        $('#filterStatus').val('all');
        $('#filterTime').val('all');
        $('#filterLevel').val('all');
        $('#filterGender').val('all');
        $('#startDateFilter').val('');
        $('#endDateFilter').val('');
        renderFilteredTable();
        showAlert('បានសម្អាតការស្វែងរក', 'info');
    });

    // Quick search focus (Ctrl+F)
    $(document).on('keydown', (e) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            $('#searchName').focus();
        }
    });

    console.log('✅ Data Tracking System Successfully Loaded');


    /**
 * POS Receipt Preview Function
 * Shows the receipt in a modal for user to review before printing (A5 Size)
 */
    /**
     * Shows the receipt in a NEW POPUP WINDOW for review and printing.
     * This ensures 100% clean printing without main page interference.
     */
    function printPOSReceipt(studentKey) {
        const s = allStudentsData[studentKey];
        if (!s) return;

        const exchangeRate = 4100;
        const totalUSD = calculateTotalAmount(s);
        const totalKHR = totalUSD * exchangeRate;
        const paidUSD = calculateTotalPaid(s);
        const remainingUSD = calculateRemainingAmount(s);

        const receiptDate = new Date().toLocaleString("en-GB", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
            hour12: true
        });

        const googleMapsUrl = "https://maps.app.goo.gl/PfPwVquPbs7k4sHb6";
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(googleMapsUrl)}`;

        // Open a new window with specific A5-like dimensions for preview
        // A5 is 148mm x 210mm (Landscape width ~800px, height ~600px)
        const win = window.open('', '_blank', 'width=900,height=700,status=no,toolbar=no,menubar=no,location=no');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>POS Receipt - ${s.displayId}</title>
            <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
                body { margin: 0; padding: 20px; background: #555; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; font-family: 'Battambang', sans-serif; }
                
                /* The Receipt Paper visual on screen */
                .pos-receipt-paper {
                    width: 210mm;
                    height: 148mm;
                    background: white;
                    padding: 15mm;
                    box-sizing: border-box;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                }

                /* Print Styles - Crucial for "1 Page" */
                @media print {
                    body { background: white; margin: 0; padding: 0; display: block; }
                    .pos-receipt-paper {
                        width: 100%;
                        height: 100%; /* Force A5 landscape fill */
                        box-shadow: none;
                        margin: 0;
                        padding: 15mm; /* Maintain internal padding */
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }
                    /* Hide print button when printing */
                    .no-print { display: none !important; }
                    
                    @page {
                        size: A5 landscape;
                        margin: 0;
                    }
                }

                /* Utility Headers */
                .header-row { display: flex; border-bottom: 3px double #d63384; padding-bottom: 10px; margin-bottom: 15px; }
                .logo-col { flex: 0 0 35mm; }
                .text-col { flex: 1; text-align: center; }
                .meta-col { flex: 0 0 40mm; text-align: right; }
                
                .school-kh { font-family: 'Moul', serif; font-size: 16pt; color: #d63384; line-height: 1.2; }
                .school-en { font-size: 10pt; font-weight: bold; color: #0d6efd; letter-spacing: 0.5px; margin-top: 5px; }
                .contact { font-size: 8pt; color: #444; margin-top: 5px; line-height: 1.3; }
                
                .receipt-badge { background: #d63384; color: white; padding: 5px 10px; border-radius: 4px; display: inline-block; text-align: center; min-width: 25mm; }
                .receipt-title-kh { font-size: 11pt; font-weight: bold; }
                .receipt-title-en { font-size: 6pt; letter-spacing: 1px; }

                /* Data Grid */
                .content-grid { display: flex; gap: 15px; align-items: flex-start; height: 65mm; } /* Fixed height to ensuring fitting */
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

                /* Footer */
                .footer-row { display: flex; margin-top: 10px; border-top: 2px solid #eee; padding-top: 10px; }
                .footer-note { flex: 1.5; font-size: 7.5pt; color: #444; line-height: 1.4; }
                .footer-sig { flex: 1; display: flex; justify-content: space-between; padding-left: 20px; }
                .sig-box { text-align: center; width: 45%; }
                .sig-line { border-top: 1px solid #333; margin-top: 35px; }
                .sig-label { font-size: 8pt; font-weight: bold; }

                /* Floating Print Button */
                .print-fab {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #0d6efd;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                    transition: transform 0.2s;
                    z-index: 1000;
                }
                .print-fab:hover { transform: scale(1.1); background: #0b5ed7; }
            </style>
        </head>
        <body>
            <button class="print-fab no-print" onclick="window.print()" title="Print Receipt"><i class="fa fa-print"></i></button>

            <div class="pos-receipt-paper">
                <!-- Header -->
                <div class="header-row">
                    <div class="logo-col"><img src="img/1.jpg" onerror="this.src='img/logo.jpg'" style="width:100%;"></div>
                    <div class="text-col">
                        <div class="school-kh">សាលាអន្តរជាតិ អាយធី ឃេ</div>
                        <div class="school-en">INTERNATIONAL SCHOOL ITK</div>
                        <div class="contact">សាខាទី២ ភូមិក្រាំង សង្កាត់ក្រាំងអំពិល ក្រុងកំពត ខេត្តកំពត<br>Tel: 093 83 56 78</div>
                    </div>
                    <div class="meta-col">
                        <div class="receipt-badge">
                            <div class="receipt-title-kh">វិក្កយបត្រ</div>
                            <div class="receipt-title-en">RECEIPT</div>
                        </div>
                        <div style="font-size:9pt; font-weight:bold; margin-top:8px;">No: ${s.displayId}</div>
                    </div>
                </div>

                <!-- Body -->
                <div class="content-grid">
                    <div class="left-panel">
                        <div style="font-weight:bold; font-size:10pt; color:#d63384; border-bottom:1px solid #eee; margin-bottom:5px;">
                            <i class="fa fa-user-graduate"></i> ព័ត៌មានសិស្ស
                        </div>
                        <table>
                            <tr><td class="info-label">ឈ្មោះ / Name:</td><td class="info-val">${s.lastName} ${s.firstName}</td></tr>
                            <tr><td class="info-label">ភេទ / Gender:</td><td class="info-val">${s.gender === 'Male' ? 'ប្រុស (M)' : 'ស្រី (F)'}</td></tr>
                            <tr><td class="info-label">កម្រិត / Level:</td><td class="info-val">${s.studyLevel || '-'}</td></tr>
                            <tr><td class="info-label">ម៉ោង / Time:</td><td class="info-val">${s.studyTime || '-'}</td></tr>
                            <tr><td class="info-label" style="color:#0d6efd">ថ្ងៃចូល / Start:</td><td class="info-val" style="color:#0d6efd">${s.startDate || '-'}</td></tr>
                            <tr><td class="info-label">ចំនួនខែ / Paid:</td><td class="info-val">${s.paymentMonths || '0'} ខែ</td></tr>
                            <tr><td class="info-label" style="color:#dc3545">ផុតកំណត់ / Due:</td><td class="info-val" style="color:#dc3545">${s.nextPaymentDate || s.paymentDueDate || '-'}</td></tr>
                        </table>
                    </div>

                    <div class="right-panel">
                        <table class="invoice-table">
                            <thead>
                                <tr><th>បរិយាយ (Description)</th><th width="30%">តម្លៃ (Price)</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>ថ្លៃសិក្សា / Tuition Fee</td><td>$${(parseFloat(s.tuitionFee) || 0).toFixed(2)}</td></tr>
                                ${(parseFloat(s.registrationFee) || 0) > 0 ? `<tr><td>ថ្លៃចុះឈ្មោះ / Registration</td><td>$${(parseFloat(s.registrationFee) || 0).toFixed(2)}</td></tr>` : ''}
                                ${(parseFloat(s.bookFee) || 0) > 0 ? `<tr><td>ថ្លៃសៀវភៅ / Book Fee</td><td>$${(parseFloat(s.bookFee) || 0).toFixed(2)}</td></tr>` : ''}
                                ${(parseFloat(s.fulltimeBookFee) || 0) > 0 ? `<tr><td>ថ្លៃសៀវភៅពេញម៉ោង / FT Book</td><td>$${(parseFloat(s.fulltimeBookFee) || 0).toFixed(2)}</td></tr>` : ''}
                                ${(parseFloat(s.uniformFee) || 0) > 0 ? `<tr><td>ថ្លៃឯកសណ្ឋាន / Uniform</td><td>$${(parseFloat(s.uniformFee) || 0).toFixed(2)}</td></tr>` : ''}
                                ${(parseFloat(s.adminServicesFee) || 0) > 0 ? `<tr><td>សេវារដ្ឋបាល / Admin Service</td><td>$${(parseFloat(s.adminServicesFee) || 0).toFixed(2)}</td></tr>` : ''}
                                ${s.discountPercent > 0 ? `<tr style="color:#dc3545; font-style:italic;"><td>Discounts (${s.discountPercent}%)</td><td>-$${(s.tuitionFee * s.discountPercent / 100).toFixed(2)}</td></tr>` : ''}
                                ${s.discount > 0 ? `<tr style="color:#dc3545; font-style:italic;"><td>Other Discount</td><td>-$${parseFloat(s.discount).toFixed(2)}</td></tr>` : ''}
                            </tbody>
                            <tfoot>
                                <tr class="total-row"><td>សរុបរួម / TOTAL:</td><td>$${totalUSD.toFixed(2)}</td></tr>
                                <tr style="color:#198754; font-weight:bold;"><td>បានបង់ / PAID:</td><td align="right">$${paidUSD.toFixed(2)}</td></tr>
                                <tr style="color:#dc3545; font-weight:bold;"><td>នៅខ្វះ / BALANCE:</td><td align="right">$${remainingUSD.toFixed(2)}</td></tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer-row">
                    <div class="footer-note">
                        <div style="font-weight:bold; text-decoration:underline;">ចំណាំ / Note:</div>
                        <div>1. ប្រាក់បង់រួច មិនអាចដកវិញបានទេ (Paid money is non-refundable)</div>
                        <div>2. សូមពិនិត្យបង្កាន់ដៃមុនចាកចេញ (Check receipt before leaving)</div>
                        <div>3. ត្រូវមានបង្កាន់ដៃពី Reception (Receipt required)</div>
                        <div style="margin-top:5px; font-style:italic; font-size:7pt; color:#999;">Printed: ${receiptDate}</div>
                    </div>
                    <div class="footer-sig">
                        <div class="sig-box">
                            <div class="sig-label">អ្នកបង់ប្រាក់ / Payer</div>
                            <div class="sig-line"></div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-label">អ្នកទទួល / Receiver</div>
                            <div class="sig-line"></div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                // Auto print context can be enabled if desired
                // window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
        `;

        win.document.write(html);
        win.document.close();
    }

    /**
     * Triggers browser print for the receipt modal
     */
    function printModalReceipt() {
        window.print();
    }

    /**
     * Mark student as DROPOUT
     */
    const markAsDropout = (key) => {
        if (confirm("តើអ្នកពិតជាចង់កំណត់សិស្សនេះជា 'សិស្សបោះបង់ការសិក្សា' មែនទេ?")) {
            showLoading(true);
            studentsRef.child(key).update({
                enrollmentStatus: 'dropout',
                dropoutDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }).then(() => {
                showLoading(false);
                // Close modal if open
                const modalEl = document.getElementById('studentDetailsModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }

                showAlert("សិស្សត្រូវបានកំណត់ជាបោះបង់ការសិក្សាដោយជោគជ័យ", "success");
            }).catch(err => {
                showLoading(false);
                showAlert("កំហុស: " + err.message, "danger");
            });
        }
    };

    /**
     * Re-enroll student (Active)
     */
    const reEnrollStudent = (key) => {
        if (confirm("តើអ្នកពិតជាចង់នាំសិស្សនេះមកសិក្សាវិញមែនទេ?")) {
            showLoading(true);
            studentsRef.child(key).update({
                enrollmentStatus: 'active',
                reEnrollDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }).then(() => {
                showLoading(false);
                // Close modal if open
                const modalEl = document.getElementById('studentDetailsModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }

                showAlert("សិស្សត្រូវបាននាំមកសិក្សាវិញដោយជោគជ័យ", "success");
            }).catch(err => {
                showLoading(false);
                showAlert("កំហុស: " + err.message, "danger");
            });
        }
    };

    // Make functions globally accessible for HTML onclick attributes
    window.viewStudentDetails = viewStudentDetails;
    window.showEditModal = showEditModal;
    window.saveStudentChanges = saveStudentChanges;
    window.deleteStudent = deleteStudent;
    window.markAsPaid = markAsPaid;
    window.markAsDropout = markAsDropout;
    window.reEnrollStudent = reEnrollStudent;
    window.printPOSReceipt = printPOSReceipt;
    window.printModalReceipt = printModalReceipt;
    window.generateMonthlyReport = generateMonthlyReport;
    window.generateDetailedAlertReport = generateDetailedAlertReport;
    window.checkAllPayments = checkAllPayments;
    window.exportToExcel = exportToExcel;
    window.downloadMonthlyReport = downloadMonthlyReport;
    window.downloadYearlyReport = downloadYearlyReport;
    window.downloadMonthlyReport = downloadMonthlyReport;
    window.downloadYearlyReport = downloadYearlyReport;
    window.exportOverdueReport = exportOverdueReport;
    window.printPaymentReceipt = printPaymentReceipt;

    window.generateStudentListPDF = async (students, title, subtitle = '') => {
        if (!students || students.length === 0) return showAlert('គ្មានទិន្នន័យសម្រាប់បង្កើតរបាយការណ៍', 'warning');

        if (!window.jspdf) return showAlert('PDF Library not loaded. Please refresh.', 'error');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Font
        if (typeof khmerFontBase64 !== 'undefined') {
            doc.addFileToVFS('KhmerOSBattambang.ttf', khmerFontBase64);
            doc.addFont('KhmerOSBattambang.ttf', 'Khmer', 'normal');
            doc.setFont('Khmer');
        }

        // Sort
        students.sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

        const tableColumn = ["#", "អត្តលេខ", "ឈ្មោះសិស្ស", "ភេទ", "ទូរស័ព្ទ", "កំរិត", "ម៉ោង", "ថ្ងៃចុះឈ្មោះ", "ថ្ងៃកំណត់", "ស្ថានភាព", "ជំពាក់"];
        const tableRows = [];
        let totalDueAmount = 0;

        students.forEach((s, index) => {
            const remaining = calculateRemainingAmount(s);
            totalDueAmount += remaining;
            const status = getPaymentStatus(s);
            const rowData = [
                index + 1,
                s.displayId,
                `${s.lastName || ''} ${s.firstName || ''}`,
                s.gender === 'Male' ? 'ប្រុស' : 'ស្រី',
                s.personalPhone || s.fatherPhone || 'N/A',
                s.studyLevel || '',
                s.studyTime || '',
                toKhmerDate(s.startDate),
                s.nextPaymentDate ? toKhmerDate(s.nextPaymentDate) : '-',
                status.text,
                `$${remaining.toFixed(2)}`
            ];
            tableRows.push(rowData);
        });

        // Header
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 14;

        const drawHeader = () => {
            const logoImg = document.getElementById('sidebar-logo');
            // ... (Existing content)

            /**
             * Print Receipt for a specific historical installment
             */
            // Moved to end of file

            const textStartX = margin + 25;
            doc.setFontSize(16);
            doc.setTextColor(138, 14, 91);
            doc.setFont('Khmer', 'normal');
            doc.text("សាលាអន្តរជាតិ អាយធី ឃេ", textStartX, 18);
            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            doc.setFont('Helvetica', 'bold');
            doc.text("INTERNATIONAL SCHOOL ITK", textStartX, 24);
            doc.setFont('Khmer', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text(title, pageWidth / 2, 35, { align: 'center' });
            if (subtitle) {
                doc.setFontSize(11);
                doc.setTextColor(100, 100, 100);
                doc.text(subtitle, pageWidth / 2, 41, { align: 'center' });
            }
            doc.setDrawColor(200);
            doc.line(margin, 46, pageWidth - margin, 46);
        };

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            theme: 'grid',
            styles: { font: 'Khmer', fontSize: 9, cellPadding: 2, valign: 'middle', lineWidth: 0.1, lineColor: [200, 200, 200] },
            headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 22 },
                3: { halign: 'center', cellWidth: 12 },
                10: { halign: 'right', textColor: [220, 53, 69] }
            },
            didDrawPage: (data) => {
                if (data.pageNumber === 1) drawHeader();
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text("ទំព័រទី " + data.pageNumber, pageWidth - margin - 15, pageHeight - 10);
                doc.text("កាលបរិច្ឆេទ: " + new Date().toLocaleDateString('km-KH'), margin, pageHeight - 10);
            },
            margin: { top: 50, left: margin, right: margin, bottom: 20 }
        });

        let finalY = doc.lastAutoTable.finalY + 10;
        if (finalY > pageHeight - 40) { doc.addPage(); finalY = 20; }
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`សរុបទឹកប្រាក់ខ្វះ (Total Due): $${totalDueAmount.toFixed(2)}`, pageWidth - margin, finalY, { align: 'right' });

        const sigY = finalY + 30;
        if (sigY > pageHeight - 30) doc.addPage();
        let currentSigY = sigY > pageHeight - 30 ? 30 : sigY;

        doc.setFontSize(10);
        doc.text("រៀបចំដោយ", margin + 20, currentSigY);
        doc.text("ត្រួតពិនិត្យដោយ", pageWidth / 2 - 20, currentSigY);
        doc.text("អនុម័តដោយ", pageWidth - margin - 40, currentSigY);

        doc.save(`Student_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    /**
     * Print Receipt for a specific historical installment
     */
    function printPaymentReceipt(studentKey, index) {
        const s = allStudentsData[studentKey];
        if (!s) return;

        // Flatten installments to find the one matching the index
        let installments = [];
        if (s.installments) {
            if (Array.isArray(s.installments)) {
                installments = s.installments;
            } else if (typeof s.installments === 'object') {
                installments = Object.values(s.installments);
            }
        }

        const inst = installments[index];
        if (!inst) return showAlert('រកមិនឃើញទិន្នន័យបង់ប្រាក់', 'error');

        const amount = parseFloat(inst.amount) || 0;

        // Open a new window with specific A5-like dimensions for preview
        const win = window.open('', '_blank', 'width=900,height=700,status=no,toolbar=no,menubar=no,location=no');

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Receipt - ${s.displayId}</title>
            <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Moul&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <style>
                body { margin: 0; padding: 20px; background: #555; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; font-family: 'Battambang', sans-serif; }
                
                /* The Receipt Paper visual on screen */
                .pos-receipt-paper {
                    width: 210mm;
                    height: 148mm;
                    background: white;
                    padding: 15mm;
                    box-sizing: border-box;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                }

                /* Print Styles - Crucial for "1 Page" */
                @media print {
                    body { background: white; margin: 0; padding: 0; display: block; }
                    .pos-receipt-paper {
                        width: 100%;
                        height: 100%; /* Force A5 landscape fill */
                        box-shadow: none;
                        margin: 0;
                        padding: 15mm; /* Maintain internal padding */
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }
                    /* Hide print button when printing */
                    .no-print { display: none !important; }
                    
                    @page {
                        size: A5 landscape;
                        margin: 0;
                    }
                }

                /* Utility Headers */
                .header-row { display: flex; border-bottom: 3px double #d63384; padding-bottom: 10px; margin-bottom: 15px; }
                .logo-col { flex: 0 0 35mm; }
                .text-col { flex: 1; text-align: center; }
                .meta-col { flex: 0 0 40mm; text-align: right; }
                
                .school-kh { font-family: 'Moul', serif; font-size: 16pt; color: #d63384; line-height: 1.2; }
                .school-en { font-size: 10pt; font-weight: bold; color: #0d6efd; letter-spacing: 0.5px; margin-top: 5px; }
                .contact { font-size: 8pt; color: #444; margin-top: 5px; line-height: 1.3; }
                
                .receipt-badge { background: #d63384; color: white; padding: 5px 10px; border-radius: 4px; display: inline-block; text-align: center; min-width: 25mm; }
                .receipt-title-kh { font-size: 11pt; font-weight: bold; }
                .receipt-title-en { font-size: 6pt; letter-spacing: 1px; }

                /* Data Grid */
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

                /* Footer */
                .footer-row { display: flex; margin-top: 10px; border-top: 2px solid #eee; padding-top: 10px; }
                .footer-note { flex: 1.5; font-size: 7.5pt; color: #444; line-height: 1.4; }
                .footer-sig { flex: 1; display: flex; justify-content: space-between; padding-left: 20px; }
                .sig-box { text-align: center; width: 45%; }
                .sig-line { border-top: 1px solid #333; margin-top: 35px; }
                .sig-label { font-size: 8pt; font-weight: bold; }

                /* Floating Print Button */
                .print-fab {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #0d6efd;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                    transition: transform 0.2s;
                    z-index: 1000;
                }
                .print-fab:hover { transform: scale(1.1); background: #0b5ed7; }
            </style>
        </head>
        <body>
            <button class="print-fab no-print" onclick="window.print()" title="Print Receipt"><i class="fa fa-print"></i></button>

            <div class="pos-receipt-paper">
                <!-- Header -->
                <div class="header-row">
                    <div class="logo-col"><img src="img/1.jpg" onerror="this.src='img/logo.jpg'" style="width:100%;"></div>
                    <div class="text-col">
                        <div class="school-kh">សាលាអន្តរជាតិ ធាន ស៊ីន</div>
                        <div class="school-en">TIAN XIN INTERNATIONAL SCHOOL</div>
                        <div class="contact">សាខាទី២ ភូមិក្រាំង សង្កាត់ក្រាំងអំពិល ក្រុងកំពត ខេត្តកំពត<br>Tel: 093 83 56 78</div>
                    </div>
                    <div class="meta-col">
                        <div class="receipt-badge">
                            <div class="receipt-title-kh">វិក្កយបត្រ</div>
                            <div class="receipt-title-en">RECEIPT</div>
                        </div>
                        <div style="font-size:9pt; font-weight:bold; margin-top:8px;">No: ${s.displayId}-${index + 1}</div>
                    </div>
                </div>

                <!-- Body -->
                <div class="content-grid">
                    <div class="left-panel">
                        <div style="font-weight:bold; font-size:10pt; color:#d63384; border-bottom:1px solid #eee; margin-bottom:5px;">
                            <i class="fa fa-user-graduate"></i> ព័ត៌មានសិស្ស
                        </div>
                        <table>
                            <tr><td class="info-label">ឈ្មោះ / Name:</td><td class="info-val">${s.lastName} ${s.firstName}</td></tr>
                            <tr><td class="info-label">ភេទ / Gender:</td><td class="info-val">${s.gender === 'Male' ? 'ប្រុស (M)' : 'ស្រី (F)'}</td></tr>
                            <tr><td class="info-label">កម្រិត / Level:</td><td class="info-val">${s.studyLevel || '-'}</td></tr>
                            <tr><td class="info-label">ម៉ោង / Time:</td><td class="info-val">${s.studyTime || '-'}</td></tr>
                            <tr><td class="info-label" style="color:#0d6efd">ថ្ងៃបង់ / Date:</td><td class="info-val" style="color:#0d6efd">${toKhmerDate(inst.date) || '-'}</td></tr>
                            <tr><td class="info-label">ចំនួនខែ / Months:</td><td class="info-val">${inst.months || '1'} ខែ</td></tr>
                        </table>
                    </div>

                    <div class="right-panel">
                        <table class="invoice-table">
                            <thead>
                                <tr><th>បរិយាយ (Description)</th><th width="30%">តម្លៃ (Price)</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>ថ្លៃសិក្សា (Tuition Fee)</td><td>$${amount.toFixed(2)}</td></tr>
                                ${inst.materialFee > 0 ? `<tr><td>ថ្លៃសម្ភារៈ (Material Fee)</td><td>$${parseFloat(inst.materialFee).toFixed(2)}</td></tr>` : ''}
                                ${inst.adminServicesFee > 0 ? `<tr><td>ថ្លៃរដ្ឋបាល (Admin Fee)</td><td>$${parseFloat(inst.adminServicesFee).toFixed(2)}</td></tr>` : ''}
                                ${inst.discountPercent > 0 ? `<tr style="color:#d63384; font-style:italic;"><td>ការបញ្ចុះតម្លៃ (Discount ${inst.discountPercent}%)</td><td>-$${(amount * inst.discountPercent / 100).toFixed(2)}</td></tr>` : ''}
                                ${inst.discountDollar > 0 ? `<tr style="color:#d63384; font-style:italic;"><td>ការបញ្ចុះតម្លៃ (Discount)</td><td>-$${parseFloat(inst.discountDollar).toFixed(2)}</td></tr>` : ''}
                                ${inst.note ? `<tr><td style="font-style:italic; font-size:8pt; color:#666;">* ${inst.note}</td><td></td></tr>` : ''}
                            </tbody>
                            <tfoot>
                                <tr class="total-row"><td>សរុបបង់ / TOTAL PAID:</td><td>$${(() => {
                let total = amount + (parseFloat(inst.materialFee) || 0) + (parseFloat(inst.adminServicesFee) || 0);
                if (inst.discountPercent > 0) total -= (amount * inst.discountPercent / 100);
                if (inst.discountDollar > 0) total -= parseFloat(inst.discountDollar);
                return total.toFixed(2);
            })()}</td></tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer-row">
                    <div class="footer-note">
                        <div style="font-weight:bold; text-decoration:underline;">ចំណាំ / Note:</div>
                        <div>1. ប្រាក់បង់រួច មិនអាចដកវិញបានទេ (Paid money is non-refundable)</div>
                        <div>2. សូមពិនិត្យបង្កាន់ដៃមុនចាកចេញ (Check receipt before leaving)</div>
                        <div>3. ត្រូវមានបង្កាន់ដៃពី Reception (Receipt required)</div>
                        <div style="margin-top:5px; font-style:italic; font-size:7pt; color:#999;">Printed: ${new Date().toLocaleString("en-GB")}</div>
                    </div>
                    <div class="footer-sig">
                        <div class="sig-box">
                            <div class="sig-label">អ្នកបង់ប្រាក់ / Payer</div>
                            <div class="sig-line"></div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-label">អ្នកទទួល / Receiver (User: ${inst.receiver || '-'})</div>
                            <div class="sig-line"></div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                // window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
        `;

        win.document.write(html);
        win.document.close();
    }
});

// Initialize Flatpickr when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Initialize Flatpickr for Filter Dates
    flatpickr("#startDateFilter", {
        locale: KhmerLocaleFlatpickr,
        dateFormat: "Y-m-d", // Value format
        altInput: true,
        altFormat: "j F Y", // Display format: 26 មករា 2026
        allowInput: true
    });

    flatpickr("#endDateFilter", {
        locale: KhmerLocaleFlatpickr,
        dateFormat: "Y-m-d", // Value format
        altInput: true,
        altFormat: "j F Y",
        allowInput: true
    });

    // Initialize Flatpickr for Modal Dates
    const dateInputs = ["#paymentDate", "#dueDateModal", "#nextPaymentDate"];
    dateInputs.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            flatpickr(selector, {
                locale: KhmerLocaleFlatpickr,
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "j F Y",
                allowInput: true,
                defaultDate: new Date()
            });
        }
    });
});
