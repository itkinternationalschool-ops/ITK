
// ============================================
// SHARED STYLES & HEADER
// ============================================

const REPORT_STYLES = `
    @font-face {
        font-family: 'Kantumruy-Light';
        src: url('fonts/Kantumruy-Light.ttf') format('truetype');
    }
    :root {
        --primary-color: rgb(31, 6, 55);
        --secondary-color: #6c757d;
        --border-color: #dee2e6;
    }
    body {
        font-family: 'Kantumruy-Light', sans-serif;
        font-size: 12px;
        color: #333;
        line-height: 1.5;
        margin: 0;
        padding: 20px;
    }
    .report-container {
        max-width: 100%;
        margin: 0 auto;
    }
    /* Header Styles */
    .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        border-bottom: 3px double var(--primary-color);
        padding-bottom: 20px;
    }
    .logo-area {
        width: 120px;
        text-align: left;
    }
    .logo-img {
        width: 100%;
        height: auto;
        object-fit: contain;
    }
    .school-info {
        flex: 1;
        text-align: center;
        padding: 0 20px;
    }
    .school-name-kh {
        font-size: 24px;
        font-weight: bold;
        color: var(--primary-color);
        margin: 0;
        font-family: 'Khmer OS Muol Light', 'Kantumruy-Light';
    }
    .school-name-en {
        font-size: 16px;
        font-weight: bold;
        color: #555;
        text-transform: uppercase;
        margin: 5px 0 10px 0;
        letter-spacing: 1px;
    }
    .contact-info {
        font-size: 11px;
        color: #666;
        margin-bottom: 2px;
    }
    .report-meta {
        width: 150px;
        text-align: right;
        font-size: 11px;
        color: #666;
    }
    
    /* Title Section */
    .report-title-section {
        text-align: center;
        margin-bottom: 25px;
    }
    .report-main-title {
        font-size: 18px;
        font-weight: bold;
        background: var(--primary-color);
        color: white;
        display: inline-block;
        padding: 8px 30px;
        border-radius: 50px;
        margin-bottom: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .report-subtitle {
        font-size: 14px;
        color: #555;
        font-weight: bold;
    }

    /* Summary Box */
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
    }
    .summary-card {
        background: #f8f9fa;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 15px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .summary-value {
        font-size: 18px;
        font-weight: bold;
        color: var(--primary-color);
        display: block;
    }
    .summary-label {
        font-size: 11px;
        color: #666;
        text-transform: uppercase;
        margin-top: 5px;
        display: block;
    }

    /* Table Styles */
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    th {
        background-color: var(--primary-color);
        color: white;
        padding: 10px 8px;
        text-align: center;
        border: 1px solid #4a0d85;
        font-weight: normal;
        white-space: nowrap;
    }
    td {
        padding: 8px;
        border: 1px solid var(--border-color);
        vertical-align: middle;
        text-align: center;
    }
    tr:nth-child(even) {
        background-color: #f8f9fa;
    }
    td.text-start { text-align: left; }
    td.text-end { text-align: right; }
    td.fw-bold { font-weight: bold; }
    
    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
    }

    /* Footer */
    .report-footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #888;
    }
    
    @page { margin: 15mm; size: A4 portrait; }
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
`;

function getLogo() {
    return 'img/logo.jpg';
}

function createReportHeader(title, subtitle = '') {
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const timeStr = today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="report-header">
            <div class="logo-area">
                <img src="${getLogo()}" class="logo-img" alt="Logo" onerror="this.src='https://via.placeholder.com/100x100?text=Logo'">
            </div>
            <div class="school-info">
                <h1 class="school-name-kh">សាលារៀន អាយ ធី ឃេ</h1>
                <h2 class="school-name-en">ITK INTERNATIONAL SCHOOL</h2>
                <div class="contact-info">អាសយដ្ឋាន៖ ភូមិត្រពាំងព្រីងខាងត្បូង ឃុំត្រពាំងព្រីង ស្រុកទឹកឈូ ខេត្តកំពត</div>
                <div class="contact-info">ទូរស័ព្ទ៖ 097 75 33 473 | អ៊ីមែល: info@itkschool.com</div>
            </div>
            <div class="report-meta">
                <div>កាលបរិច្ឆេទ: ${dateStr}</div>
                <div>ម៉ោង: ${timeStr}</div>
                <div>អ្នកបង្កើត: Admin</div>
            </div>
        </div>
        
        <div class="report-title-section">
            <div class="report-main-title">${title}</div>
            ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ''}
        </div>
    `;
}

function createReportFooter() {
    return `
        <div class="report-footer">
            <div>ITK School Management System</div>
            <div>Generated automatically by system</div>
            <div>Page <span class="pageNumber"></span></div>
        </div>
    `;
}

function wrapHTML(content) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Report</title>
            <style>${REPORT_STYLES}</style>
        </head>
        <body>
            <div class="report-container">
                ${content}
            </div>
        </body>
        </html>
    `;
}

// ============================================
// REPORT GENERATION LOGIC
// ============================================

// 1. GENERIC PREVIEW
function showReportPreview(htmlContent, title) {
    Swal.fire({
        title: title,
        html: `
            <div style="text-align: left; height: 75vh; border: 1px solid #dee2e6; background: #525659; border-radius: 8px; overflow: hidden;">
                <iframe id="reportPreviewFrame" style="width: 100%; height: 100%; border: none; background: white;"></iframe>
            </div>
        `,
        width: '1000px',
        padding: '0',
        showCancelButton: true,
        confirmButtonText: '<i class="fi fi-rr-print me-2"></i>បោះពុម្ព (Print)',
        cancelButtonText: '<i class="fi fi-rr-cross-circle me-2"></i>បិទ (Close)',
        confirmButtonColor: 'rgb(31, 6, 55)',
        cancelButtonColor: '#6c757d',
        didOpen: () => {
            const iframe = document.getElementById('reportPreviewFrame');
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const iframe = document.getElementById('reportPreviewFrame');
            iframe.contentWindow.print();
        }
    });
}


// 2. NEW: OVERDUE REPORT (Financial)
function generateOverdueReportPDF() {
    const students = Object.values(allStudentsData).filter(s => {
        // Find overdue or those with debt
        const status = getPaymentStatus(s);
        const debt = calculateRemainingAmount(s);
        return (status.status === 'overdue' || status.status === 'warning' || debt > 0) && s.enrollmentStatus !== 'dropout';
    }).sort((a, b) => calculateRemainingAmount(b) - calculateRemainingAmount(a)); // Sort by debt desc

    if (students.length === 0) return Swal.fire('ល្អណាស់', 'មិនមានសិស្សជំពាក់ប្រាក់ទេ', 'success');

    const totalDebt = students.reduce((sum, s) => sum + calculateRemainingAmount(s), 0);

    // Rows
    const rows = students.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="fw-bold">${s.displayId}</td>
            <td class="text-start">
                <div style="font-weight:bold;">${s.lastName} ${s.firstName}</div>
                <div style="font-size:10px; color:#666;">${s.englishName || ''}</div>
            </td>
            <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
            <td>${s.personalPhone || '-'}</td>
            <td>${s.studyLevel || '-'}</td>
             <td>${formatDueDateWithColor(s)}</td>
            <td class="fw-bold text-end text-danger">$${calculateRemainingAmount(s).toFixed(2)}</td>
            <td><span style="color:red;">${getPaymentStatus(s).text}</span></td>
        </tr>
    `).join('');

    const content = `
        ${createReportHeader('របាយការណ៍បំណុលសិស្ស', 'បញ្ជីសិស្សដែលមិនទាន់បង់ប្រាក់ ឬហួសកំណត់')}
        
        <div class="summary-grid">
            <div class="summary-card">
                <span class="summary-value text-danger">${students.length} នាក់</span>
                <span class="summary-label">សិស្សជំពាក់សរុប</span>
            </div>
            <div class="summary-card">
                <span class="summary-value text-danger">$${totalDebt.toFixed(2)}</span>
                <span class="summary-label">ទឹកប្រាក់ជំពាក់សរុប</span>
            </div>
            <div class="summary-card">
                <span class="summary-value text-warning">${students.filter(s => getPaymentStatus(s).status === 'overdue').length} នាក់</span>
                <span class="summary-label">ហួសកំណត់ (Overdue)</span>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="5%">ល.រ</th>
                    <th width="10%">ID</th>
                    <th width="20%">ឈ្មោះសិស្ស</th>
                    <th width="5%">ភេទ</th>
                    <th width="12%">ទូរស័ព្ទ</th>
                     <th width="10%">កម្រិត</th>
                    <th width="15%">ថ្ងៃត្រូវបង់</th>
                    <th width="10%">ទឹកប្រាក់</th>
                    <th width="13%">ស្ថានភាព</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        ${createReportFooter()}
    `;

    showReportPreview(wrapHTML(content), 'Overdue Report');
}

// 3. NEW: STATISTICS REPORT
function generateStatisticsReportPDF() {
    const students = Object.values(allStudentsData).filter(s => s.enrollmentStatus !== 'dropout');

    const maleCount = students.filter(s => s.gender === 'Male' || s.gender === 'ប្រុស').length;
    const femaleCount = students.length - maleCount;

    // Group by Level
    const byLevel = {};
    students.forEach(s => {
        const lv = s.studyLevel || 'Other';
        if (!byLevel[lv]) byLevel[lv] = 0;
        byLevel[lv]++;
    });

    // Group by Status
    const byStatus = { paid: 0, pending: 0, overdue: 0 };
    students.forEach(s => {
        const st = getPaymentStatus(s).status;
        if (st === 'paid') byStatus.paid++;
        else if (st === 'overdue') byStatus.overdue++;
        else byStatus.pending++;
    });

    const content = `
        ${createReportHeader('របាយការណ៍សង្ខេបស្ថិតិ', 'សិស្សកំពុងសិក្សាសរុប')}
        
        <div class="summary-grid">
            <div class="summary-card">
                <span class="summary-value">${students.length}</span>
                <span class="summary-label">សិស្សសរុប</span>
            </div>
            <div class="summary-card">
                <span class="summary-value" style="color:#0d6efd;">${maleCount}</span>
                 <span class="summary-label">សិស្សប្រុស</span>
            </div>
            <div class="summary-card">
                <span class="summary-value" style="color:#d63384;">${femaleCount}</span>
                 <span class="summary-label">សិស្សស្រី</span>
            </div>
        </div>

        <div style="display:flex; gap:20px;">
            <div style="flex:1;">
                <h3 style="border-bottom:1px solid #ccc; padding-bottom:10px;">ស្ថិតិតាមកម្រិតសិក្សា</h3>
                <table>
                    <thead>
                        <tr>
                            <th>កម្រិតសិក្សា</th>
                            <th>ចំនួនសិស្ស</th>
                            <th>ភាគរយ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(byLevel).sort().map(lv => `
                            <tr>
                                <td class="text-start">${lv}</td>
                                <td class="fw-bold">${byLevel[lv]}</td>
                                <td>${((byLevel[lv] / students.length) * 100).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="flex:1;">
                <h3 style="border-bottom:1px solid #ccc; padding-bottom:10px;">ស្ថិតិការបង់ប្រាក់</h3>
                <table>
                     <thead>
                        <tr>
                            <th>ស្ថានភាព</th>
                            <th>ចំនួន</th>
                            <th>សកម្មភាព</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td class="text-start text-success fw-bold">បង់រួច (Paid)</td><td>${byStatus.paid}</td><td>-</td></tr>
                        <tr><td class="text-start text-danger fw-bold">ហួសកំណត់ (Overdue)</td><td>${byStatus.overdue}</td><td><span style="color:red; font-size:10px;">ត្រួតពិនិត្យបន្ទាន់</span></td></tr>
                        <tr><td class="text-start text-warning fw-bold">មិនទាន់បង់ (Pending)</td><td>${byStatus.pending}</td><td>តាមដាន</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        ${createReportFooter()}
    `;

    showReportPreview(wrapHTML(content), 'Statistics Report');
}

// 4. UPDATED: CURRENT VIEW PDF
function exportCurrentView(type) {
    const students = filterStudents(rawStudentsArray);

    if (type === 'excel') {
        // Excel Logic (Keep existing basic logic or improve it)
        const exportData = students.map((s, i) => ({
            'No': i + 1,
            'ID': s.displayId,
            'Khmer Name': s.lastName + ' ' + s.firstName,
            'English Name': (s.englishLastName || '') + ' ' + (s.englishFirstName || ''),
            'Gender': s.gender,
            'DOB': toKhmerDate(s.dob),
            'Subject': s.subject,
            'Level': s.studyLevel,
            'Teacher': s.teacherName,
            'Phone': s.personalPhone,
            'Status': getPaymentStatus(s).text
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CurrentView");
        XLSX.writeFile(wb, `Student_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
        // Enhanced PDF
        const rows = students.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="fw-bold">${s.displayId}</td>
                <td class="text-start">${s.lastName} ${s.firstName}</td>
                <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                <td>${s.studyLevel || '-'}</td>
                 <td>${s.studyTime || '-'}</td>
                <td>${s.teacherName || '-'}</td>
                 <td>${s.personalPhone || '-'}</td>
                <td>${getPaymentStatus(s).text}</td>
            </tr>
        `).join('');

        const content = `
            ${createReportHeader('របាយការណ៍សិស្ស (Current View)', 'បញ្ជីសិស្សតាមការស្វែងរក')}
            <p>លក្ខខណ្ឌស្វែងរក: ${students.length} លទ្ធផល</p>
            <table>
                <thead>
                    <tr>
                        <th width="4%">ល.រ</th>
                        <th width="10%">ID</th>
                        <th width="18%">ឈ្មោះ</th>
                        <th width="5%">ភេទ</th>
                        <th width="10%">កម្រិត</th>
                         <th width="12%">ម៉ោង</th>
                        <th width="15%">គ្រូ</th>
                        <th width="12%">ទូរស័ព្ទ</th>
                        <th width="10%">ស្ថានភាព</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${createReportFooter()}
        `;
        showReportPreview(wrapHTML(content), "Current View Report");
    }
}

// 5. UPDATED: OTHER REPORTS (Monthly, Yearly, Teacher, Level, Time)
// Consolidating repetitive logic into a renderer

function renderGenericStudentListPDF(students, title, subtitle) {
    const rows = students.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="fw-bold">${s.displayId}</td>
            <td class="text-start">
                <div>${s.lastName} ${s.firstName}</div>
                <div style="font-size:10px; color:#666;">${s.englishName || ''}</div>
            </td>
            <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
            <td>${s.studyLevel || '-'}</td>
            <td>${s.teacherName || '-'}</td>
            <td>${toKhmerDate(s.startDate)}</td>
            <td class="text-end">$${calculateTotalAmount(s).toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        ${createReportHeader(title, subtitle)}
        <table>
            <thead>
                <tr>
                    <th width="5%">ល.រ</th>
                    <th width="10%">ID</th>
                    <th width="20%">ឈ្មោះ</th>
                    <th width="5%">ភេទ</th>
                    <th width="12%">កម្រិត</th>
                    <th width="15%">គ្រូ</th>
                    <th width="15%">ថ្ងៃចូលរៀន</th>
                    <th width="15%">តម្លៃសិក្សា</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        ${createReportFooter()}
    `;
    return wrapHTML(content);
}

// Monthly PDF
function generateMonthlyReportPDF() {
    const picker = document.getElementById('reportMonthPicker');
    if (!picker.value) return Swal.fire('Error', 'Please select a month', 'error');
    const [year, month] = picker.value.split('-');

    // Logic
    const students = Object.values(allStudentsData).filter(s => {
        if (!s.startDate) return false;
        const d = new Date(s.startDate);
        return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
    });

    if (students.length === 0) return Swal.fire('គ្មានទិន្នន័យ', 'មិនមានសិស្សក្នុងខែនេះទេ', 'info');

    const content = renderGenericStudentListPDF(students, `របាយការណ៍ប្រចាំខែ ${month}/${year}`, `សិស្សចុះឈ្មោះថ្មីសរុប៖ ${students.length} នាក់`);
    showReportPreview(content, 'Monthly Report');
}

// Yearly PDF
function generateYearlyReportPDF() {
    const year = document.getElementById('reportYearPicker').value;
    const students = Object.values(allStudentsData).filter(s => {
        if (!s.startDate) return false;
        return new Date(s.startDate).getFullYear() === parseInt(year);
    });

    if (students.length === 0) return Swal.fire('គ្មានទិន្នន័យ', 'មិនមានទិន្នន័យសម្រាប់ឆ្នាំនេះទេ', 'info');

    const content = renderGenericStudentListPDF(students, `របាយការណ៍ប្រចាំឆ្នាំ ${year}`, `សិស្សចុះឈ្មោះថ្មីសរុប៖ ${students.length} នាក់`);
    showReportPreview(content, 'Yearly Report');
}

// Teacher PDF
function generateTeacherReportPDF() {
    const teacher = document.getElementById('reportTeacherPicker').value;
    if (teacher === 'all') {
        // Maybe summary of all teachers? For now let's just list ALL students grouped by teacher via generic
        const students = Object.values(allStudentsData);
        const content = renderGenericStudentListPDF(students, 'របាយការណ៍គ្រូទាំងអស់', `សិស្សសរុប៖ ${students.length}`);
        showReportPreview(content, 'All Teachers Report');
    } else {
        const students = Object.values(allStudentsData).filter(s => s.teacherName === teacher);
        if (students.length === 0) return Swal.fire('គ្មានទិន្នន័យ', 'មិនមានសិស្សសម្រាប់គ្រូនេះទេ', 'info');

        const content = renderGenericStudentListPDF(students, `របាយការណ៍គ្រូ៖ ${teacher}`, `សិស្សសរុប៖ ${students.length} នាក់`);
        showReportPreview(content, 'Teacher Report');
    }
}

// Level PDF (New logic with improved UI)
function generateLevelReportNew() {
    const level = document.getElementById('reportLevelPicker').value;
    let students = Object.values(allStudentsData);
    if (level !== 'all') students = students.filter(s => s.studyLevel === level);

    if (students.length === 0) return Swal.fire('គ្មានទិន្នន័យ', 'មិនមានទិន្នន័យទេ', 'info');

    const content = renderGenericStudentListPDF(students, `របាយការណ៍កម្រិត៖ ${level === 'all' ? 'ទាំងអស់' : level}`, `សិស្សសរុប៖ ${students.length} នាក់`);
    showReportPreview(content, 'Level Report');
}

// Study Time Prompt & Gen (Improved)
function generateStudyTimeReportPrompt() {
    const teacherSelect = document.getElementById('reportTeacherPicker') ? document.getElementById('reportTeacherPicker').innerHTML : '';
    Swal.fire({
        title: 'ជម្រើសរបាយការណ៍ម៉ោងសិក្សា',
        html: `
            <div class="mb-3 text-start">
                <label class="form-label fw-bold">ជ្រើសរើសគ្រូបង្រៀន (Optional)</label>
                <select id="swalTeacherSelect" class="form-select">${teacherSelect}</select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fi fi-rr-file-pdf me-2"></i>បង្កើត (Generate)',
        cancelButtonText: '<i class="fi fi-rr-cross-circle me-2"></i>បិទ (Close)',
        confirmButtonColor: 'rgb(31, 6, 55)',
        cancelButtonColor: '#6c757d'
    }).then((res) => {
        if (res.isConfirmed) {
            const teacher = document.getElementById('swalTeacherSelect').value;
            let students = Object.values(allStudentsData);
            if (teacher !== 'all') students = students.filter(s => s.teacherName === teacher);

            if (students.length === 0) return Swal.fire('គ្មានទិន្នន័យ', '', 'info');

            // Special grouping for Time Report
            createStudyTimeReportHTMLv2(students, teacher);
        }
    });
}

function createStudyTimeReportHTMLv2(students, teacherFilter) {
    // Group by Time
    const byTime = {};
    students.forEach(s => {
        const t = s.studyTime || 'Unknown';
        if (!byTime[t]) byTime[t] = [];
        byTime[t].push(s);
    });

    const times = Object.keys(byTime).sort(); // Sort times

    let htmlGroups = '';
    times.forEach(t => {
        const grp = byTime[t];
        const rows = grp.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="fw-bold">${s.displayId}</td>
                <td class="text-start">${s.lastName} ${s.firstName}</td>
                <td>${s.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</td>
                <td>${s.studyLevel || '-'}</td>
                <td>${s.teacherName || '-'}</td>
                <td class="text-end">${s.personalPhone || '-'}</td>
            </tr>
        `).join('');

        htmlGroups += `
            <h3 style="background:#eee; padding:10px; border-left:5px solid var(--primary-color); margin-top:20px;">ម៉ោងសិក្សា៖ ${t} (${grp.length} នាក់)</h3>
            <table>
                <thead>
                    <tr><th width="5%">ល.រ</th><th width="10%">ID</th><th width="20%">ឈ្មោះ</th><th width="5%">ភេទ</th><th width="10%">កម្រិត</th><th width="20%">គ្រូ</th><th width="15%">ទូរស័ព្ទ</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    });

    const content = `
        ${createReportHeader('របាយការណ៍តាមម៉ោងសិក្សា', teacherFilter !== 'all' ? `គ្រូ៖ ${teacherFilter}` : 'គ្រូទាំងអស់')}
        ${htmlGroups}
        ${createReportFooter()}
    `;
    showReportPreview(wrapHTML(content), 'Study Time Report');
}

// Helper: Populate Logic (Kept mostly same, added Level)
function populateReportPickers(students) {
    const teacherSet = new Set();
    const yearSet = new Set();
    const levelSet = new Set();

    yearSet.add(new Date().getFullYear());

    Object.values(students).forEach(s => {
        if (s.teacherName) teacherSet.add(s.teacherName);
        if (s.studyLevel) levelSet.add(s.studyLevel);
        if (s.startDate) {
            const y = new Date(s.startDate).getFullYear();
            if (!isNaN(y)) yearSet.add(y);
        }
    });

    // Populate Teachers
    const teacherSelect = document.getElementById('reportTeacherPicker');
    if (teacherSelect && teacherSet.size > 0) {
        teacherSelect.innerHTML = '<option value="all">គ្រូទាំងអស់ (All Teachers)</option>';
        Array.from(teacherSet).sort().forEach(t => {
            if (!t) return;
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t; teacherSelect.appendChild(opt);
        });
    }

    // Populate Levels
    const levelSelect = document.getElementById('reportLevelPicker');
    if (levelSelect && levelSet.size > 0) {
        levelSelect.innerHTML = '<option value="all">ទាំងអស់ (All Levels)</option>';
        Array.from(levelSet).sort().forEach(l => {
            if (!l) return;
            const opt = document.createElement('option');
            opt.value = l; opt.textContent = l; levelSelect.appendChild(opt);
        });
    }

    // Populate Years
    const yearSelect = document.getElementById('reportYearPicker');
    if (yearSelect && yearSet.size > 0) {
        yearSelect.innerHTML = '';
        Array.from(yearSet).sort((a, b) => b - a).forEach(y => {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y; yearSelect.appendChild(opt);
        });
    }
}

// ============================================
// SHARED PAYMENT HELPER FUNCTIONS
// (Copied from data-tracking-script.js to be available globally)
// ============================================

function calculateTotalAmount(student) {
    if (!student) return 0;
    const tuitionFee = parseFloat(student.tuitionFee) || 0;
    const materialFee = parseFloat(student.materialFee) || 0;
    const adminFee = parseFloat(student.adminFee) || 0;

    const discountAmount = parseFloat(student.discountAmount || student.discount) || 0;
    const discountPercent = parseFloat(student.discountPercent) || 0;

    const totalDiscount = discountAmount + (tuitionFee * discountPercent / 100);
    const total = (tuitionFee + materialFee + adminFee) - totalDiscount;
    return total > 0 ? total : 0;
}

function calculateTotalPaid(student) {
    if (!student) return 0;
    let totalPaid = (parseFloat(student.initialPayment) || 0) + (parseFloat(student.extraPayment) || 0);

    if (student.installments) {
        const installments = Array.isArray(student.installments) ? student.installments : Object.values(student.installments);
        installments.forEach(inst => {
            totalPaid += (parseFloat(inst.amount || inst.paidAmount) || 0);
        });
    }
    return totalPaid;
}

function calculateRemainingAmount(student) {
    if (!student) return 0;
    const months = parseInt(student.paymentMonths || student.studyDuration) || 0;
    if (months === 48) return 0;

    const balance = calculateTotalAmount(student) - calculateTotalPaid(student);
    return Math.max(0, balance);
}

function convertKhmerNum(str) {
    const khmerNumerals = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    return str.split('').map(char => {
        const i = khmerNumerals.indexOf(char);
        return i > -1 ? i : char;
    }).join('');
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

        // Handle YYYY-MM-DD (Already ISO)
        if (/^\d{4}-\d{2}-\d{2}$/.test(khmerDateStr)) {
            const [y, m, d] = khmerDateStr.split('-');
            return `${parseInt(m)}/${parseInt(d)}/${y}`;
        }

        // Handle Khmer Format: DD-MonthName-YYYY
        const khmerMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
        if (khmerDateStr.includes('-')) {
            const p = khmerDateStr.split('-');
            if (p.length === 3) {
                const mIndex = khmerMonths.indexOf(p[1]);
                if (mIndex !== -1) {
                    const month = mIndex + 1;
                    const day = convertKhmerNum(p[0]);
                    const year = convertKhmerNum(p[2]);
                    return `${month}/${day}/${year}`;
                }
                // Check English Month Abbr
                const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
                const mStr = p[1].toLowerCase();
                if (months[mStr]) return `${months[mStr]}/${parseInt(p[0])}/${p[2]}`;

                return `${parseInt(p[1])}/${parseInt(p[2])}/${p[0]}`;
            }
        }
        return null;
    } catch (e) { return null; }
}

function getPaymentStatus(student) {
    if (!student) return { text: 'N/A', badge: 'status-pending', status: 'pending', daysRemaining: 0 };

    // Check for 48 months duration
    const pm = parseInt(student.paymentMonths) || 0;
    if (pm === 48) {
        return { text: '✅ បង់ដាច់ 100%', badge: 'status-paid', status: 'paid', daysRemaining: 0 };
    }

    // 1. Check Date Proximity FIRST
    let daysDiff = 0;
    const nextPaymentDateStr = student.nextPaymentDate;
    if (nextPaymentDateStr && !['មិនមាន', 'N/A', ''].includes(nextPaymentDateStr)) {
        const engDate = convertToEnglishDate(nextPaymentDateStr);
        if (engDate) {
            const parts = engDate.split('/');
            if (parts.length === 3) {
                const [month, day, year] = parts.map(Number);
                const nextDueDate = new Date(year, month - 1, day);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (!isNaN(nextDueDate.getTime())) {
                    daysDiff = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24));

                    // Overdue (Date passed)
                    if (daysDiff < 0) {
                        return { text: `❌ ហួសកំណត់ (${Math.abs(daysDiff)} ថ្ងៃ)`, badge: 'status-overdue', status: 'overdue', daysRemaining: daysDiff };
                    }

                    // TODAY (Strictly 0 days)
                    if (daysDiff === 0) {
                        return { text: '📅 ត្រូវបង់ថ្ងៃនេះ', badge: 'status-today', status: 'today', daysRemaining: 0 };
                    }

                    // Warning (Tomorrow - 10 days)
                    if (daysDiff > 0 && daysDiff <= 10) {
                        return { text: `⏳ ជិតដល់ថ្ងៃ (${daysDiff} ថ្ងៃ)`, badge: 'status-warning', status: 'warning', daysRemaining: daysDiff };
                    }
                }
            }
        }
    }

    // 2. Check Financial Status
    const remainingAmount = calculateRemainingAmount(student);
    if (remainingAmount <= 0) return { text: '✅ បង់រួច', badge: 'status-paid', status: 'paid', daysRemaining: daysDiff };

    // 3. Fallback for Overdue
    if (daysDiff < 0) {
        return { text: `❌ ហួសកំណត់ (${Math.abs(daysDiff)} ថ្ងៃ)`, badge: 'status-overdue', status: 'overdue', daysRemaining: daysDiff };
    }

    const dbStatus = student.paymentStatus || 'Pending';
    if (['Paid', 'បង់រួច'].includes(dbStatus)) return { text: '✅ បង់រួច', badge: 'status-paid', status: 'paid', daysRemaining: daysDiff };
    if (['Installment', 'Partial', 'នៅជំណាក់'].includes(dbStatus)) return { text: '⏳ នៅជំណាក់', badge: 'status-installment', status: 'installment', daysRemaining: daysDiff };

    return { text: '❌ មិនទាន់បង់', badge: 'status-pending', status: 'pending', daysRemaining: daysDiff };
}

function toKhmerDate(dateStr) {
    if (!dateStr || ['N/A', '', 'មិនមាន', 'null', 'undefined'].includes(dateStr)) return '';
    const khmerMonths = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"];
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = khmerMonths[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) { return dateStr; }
}

