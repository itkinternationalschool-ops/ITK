/**
 * ITK School System - Teacher Portal Script
 * Organized & Refactored for Professional Implementation
 * "Standard Dynamic" Edition
 */

document.addEventListener('DOMContentLoaded', function () {
    // === 1. CONFIGURATION & CONSTANTS ===
    const MONTHS_LIST = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // === 2. STATE MANAGEMENT ===
    let allStudents = [];
    let currentTeacherName = '';
    let currentPeriod = 'monthly';
    let currentSelectedMonth = 'December'; // Default
    window.teacherSettings = {};
    window.monthConfigData = [];

    // === 3. DOM ELEMENTS ===
    const els = {
        loginForm: document.getElementById('teacherLoginForm'),
        loginSection: document.getElementById('login-section'),
        dashboard: document.getElementById('teacher-dashboard'),
        scoreSection: document.getElementById('score-section'),
        totalScoresSection: document.getElementById('total-scores-section'),
        honorRollSection: document.getElementById('honor-roll-view-section'),
        settingsSection: document.getElementById('settings-section'),
        certificateSection: document.getElementById('certificate-section'),
        
        teacherSelect: document.getElementById('teacherSelect'),
        teacherSecret: document.getElementById('teacherSecret'),
        classSelect: document.getElementById('classSelect'),
        monthSelect: document.getElementById('monthSelect'),
        periodSelect: document.getElementById('periodSelect'),
        summaryClassSelect: document.getElementById('summaryClassSelect'),
        dashMonthSelect: document.getElementById('dashMonthSelectPremium'),
        
        studentTableBody: document.getElementById('studentScoreTableBody'),
        totalPassed: document.getElementById('totalPassed'),
        totalFailed: document.getElementById('totalFailed')
    };

    // === 4. HELPER FUNCTIONS (LOGIC & UI) ===
    
    const safeSetText = (idOrEl, text) => {
        const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (el) el.textContent = text;
    };

    const getGradeAndClass = (pct) => {
        if (pct === null || pct === undefined || pct === '' || isNaN(pct)) return { grade: '', label: '', color: '' };
        if (pct >= 90) return { grade: 'A', label: 'ល្អប្រសើរ', color: 'text-success' };
        if (pct >= 80) return { grade: 'B', label: 'ល្អណាស់', color: 'text-success' };
        if (pct >= 70) return { grade: 'C', label: 'ល្អ', color: 'text-primary' };
        if (pct >= 60) return { grade: 'D', label: 'ល្អបង្គួរ', color: 'text-primary' };
        if (pct >= 50) return { grade: 'E', label: 'មធ្យម', color: 'text-warning' };
        return { grade: 'F', label: 'ខ្សោយ', color: 'text-danger' };
    };

    const updateCurrentDate = () => {
        const now = new Date();
        const khTime = new Intl.DateTimeFormat('km-KH', { day: '2-digit', month: 'short', year: 'numeric' }).format(now);
        document.querySelectorAll('.displayDate').forEach(el => safeSetText(el, khTime));
        const footerDate = document.getElementById('footerDate');
        if (footerDate) footerDate.textContent = khTime;
    };

    // === 5. DATA FETCHING & INITIALIZATION ===

    function initData() {
        firebase.database().ref('teachers').once('value').then(snap => {
            window.teacherSettings = snap.val() || {};
        });

        firebase.database().ref('students').on('value', (snap) => {
            const data = snap.val();
            if (data) {
                allStudents = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                refreshTeacherList();
                if (currentTeacherName) syncStateAfterDataChange();
            }
        });
        loadMonthConfig();
    }

    function refreshTeacherList() {
        const teacherSet = new Set();
        allStudents.forEach(s => { if (s.teacherName) teacherSet.add(s.teacherName.trim()); });
        const teachers = Array.from(teacherSet).sort();
        
        const current = els.teacherSelect.value;
        els.teacherSelect.innerHTML = '<option value="" disabled selected>-- ជ្រើសរើសគ្រូ --</option>';
        teachers.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            els.teacherSelect.appendChild(opt);
        });
        if (current && teachers.includes(current)) els.teacherSelect.value = current;
    }

    function syncStateAfterDataChange() {
        populateClassDropdowns(currentTeacherName);
        refreshActiveDisplay();
    }
    
    function refreshActiveDisplay() {
        if (!els.scoreSection.classList.contains('d-none')) renderScoreTable();
        if (!els.totalScoresSection.classList.contains('d-none')) renderTotalScores();
        if (!els.honorRollSection.classList.contains('d-none')) updateHonorRoll();
        if (!els.certificateSection.classList.contains('d-none')) populateCertificates();
    }

    // === 6. AUTHENTICATION & NAVIGATION ===

    els.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = els.teacherSelect.value;
        const secret = els.teacherSecret.value;
        const correctSecret = (window.teacherSettings[name]?.code || '1234').toString();

        if (name && secret === correctSecret) {
            currentTeacherName = name;
            showSection('teacher-dashboard');
            safeSetText('dashTeacherNameHeader', name);
            document.querySelectorAll('.displayTeacherName').forEach(el => safeSetText(el, name));
            updateCurrentDate();
            Swal.fire({ icon: 'success', title: 'ស្វាគមន៍!', text: name, timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'កូដមិនត្រឹមត្រូវ', text: 'សូមពិនិត្យម្តងទៀត!' });
        }
    });

    window.showSection = function(sectionId) {
        const sections = ['login-section', 'teacher-dashboard', 'score-section', 'total-scores-section', 'honor-roll-view-section', 'settings-section', 'certificate-section', 'reports-section'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('d-none');
        });

        document.body.classList.toggle('dashboard-body', sectionId === 'teacher-dashboard');

        const target = document.getElementById(sectionId);
        if (target) {
            target.classList.remove('d-none');
            target.classList.add('animate__animated', 'animate__fadeIn');
        }

        if (sectionId === 'settings-section') initSettingsPage();
        if (sectionId === 'reports-section') renderTrimesterReport();
        if (sectionId === 'total-scores-section') renderTotalScoresSummary();
        if (sectionId === 'honor-roll-view-section') updateHonorRoll();
        if (sectionId === 'certificate-section') populateCertificates();
    };

    // === 7. SCORE TABLE ENGINE ===

    function populateClassDropdowns(teacher) {
        const teacherStudents = allStudents.filter(s => s.teacherName === teacher && s.status !== 'dropped' && s.status !== 'completed');
        const classes = [...new Set(teacherStudents.map(s => s.classRoom || s.class || s.grade || 'N/A'))].sort();
        
        [els.classSelect, els.summaryClassSelect].forEach(sel => {
            if (!sel) return;
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">-- គ្រប់ថ្នាក់ --</option>';
            classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = 'ថ្នាក់៖ ' + c;
                sel.appendChild(opt);
            });
            sel.value = currentVal;
        });
    }

    function renderTableHeader() {
        const header = document.getElementById('scoreTableHeader');
        if (currentPeriod === 'monthly') {
            header.innerHTML = `
                <tr>
                    <th class="action-column" style="width: 40px;"><input type="checkbox" id="selectAllStudents" class="form-check-input"></th>
                    <th style="width: 45px;">N.O</th><th style="width: 75px;">ID</th><th style="width: 155px;">Name</th><th style="width: 38px;">Sex</th>
                    <th class="vertical-th">Attendance</th><th class="vertical-th">Homework</th><th class="vertical-th">Discipline</th>
                    <th class="vertical-th">Class Work</th><th class="vertical-th">Book</th><th class="vertical-th">Exam</th>
                    <th class="vertical-th">Total</th><th class="vertical-th">Avg</th>
                    <th class="vertical-th">Result</th><th class="vertical-th">Rank</th><th class="vertical-th">Grade</th>
                    <th class="action-column" style="width: 120px;">Action</th>
                </tr>`;
            
            setTimeout(() => {
                const selectAll = document.getElementById('selectAllStudents');
                if (selectAll) selectAll.onclick = (e) => {
                    document.querySelectorAll('.student-checkbox').forEach(c => c.checked = e.target.checked);
                };
            }, 50);
        } else {
            const semNum = currentPeriod === 'semester1' ? '1' : '2';
            header.innerHTML = `
                <tr>
                    <th style="width: 45px;">N.O</th><th style="width: 90px;">ID</th><th style="width: 150px;">Name</th><th style="width: 50px;">Sex</th>
                    <th>Monthly Avg</th><th>Semester ${semNum} Exam</th><th>Total</th><th>Average</th><th>Result</th><th>Rank</th><th>Grade</th>
                    <th class="action-column">Action</th>
                </tr>`;
        }
    }

    function renderScoreTable() {
        els.studentTableBody.innerHTML = '';
        renderTableHeader();

        const selClass = els.classSelect.value;
        const filtered = allStudents.filter(s => 
            s.teacherName === currentTeacherName && s.status !== 'dropped' && s.status !== 'completed' &&
            (!selClass || (s.classRoom || s.class || s.grade) === selClass)
        );

        if (filtered.length === 0) {
            els.studentTableBody.innerHTML = '<tr><td colspan="20" class="text-center py-4 text-muted small">មិនមានសិស្សក្នុងបញ្ជីរបស់លោកគ្រូ/អ្នកគ្រូទេ</td></tr>';
            return;
        }

        safeSetText('print-month', currentSelectedMonth);
        if (filtered[0]) {
            safeSetText('print-level', filtered[0].classRoom || filtered[0].grade || 'K2');
            safeSetText('print-room', filtered[0].room || 'LAB1');
            safeSetText('print-time', filtered[0].studyTime || '5:00PM-6:00PM');
        }

        filtered.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.dataset.sid = s.id;
            const name = `${(s.englishLastName || '').toUpperCase()} ${(s.englishFirstName || '').toUpperCase()}`;
            const sex = s.gender === 'Female' ? 'ស្រី' : 'ប្រុស';

            if (currentPeriod === 'monthly') {
                const ms = s.monthlyScores?.[currentSelectedMonth] || {};
                tr.innerHTML = `
                    <td class="action-column"><input type="checkbox" class="form-check-input student-checkbox" data-sid="${s.id}"></td>
                    <td>${idx + 1}</td>
                    <td><span class="badge bg-light text-dark">${s.displayId || s.studentID || ''}</span></td>
                    <td class="text-start fw-bold">${name}</td>
                    <td>${sex}</td>
                    <td><input type="number" class="score-input" data-key="attendance" value="${ms.attendance || ''}" min="0" max="10"></td>
                    <td><input type="number" class="score-input" data-key="homework" value="${ms.homework || ''}" min="0" max="10"></td>
                    <td><input type="number" class="score-input" data-key="discipline" value="${ms.discipline || ''}" min="0" max="15"></td>
                    <td><input type="number" class="score-input" data-key="actionClass" value="${ms.actionClass || ''}" min="0" max="10"></td>
                    <td><input type="number" class="score-input" data-key="book" value="${ms.book || ''}" min="0" max="15"></td>
                    <td><input type="number" class="score-input" data-key="exam" value="${ms.exam || ''}" min="0" max="40"></td>
                    <td class="total-cell fw-bold"></td><td class="average-cell"></td><td class="result-cell fw-bold"></td>
                    <td class="rank-cell"></td><td class="grade-cell fw-bold"></td>
                    <td class="action-column">
                        <div class="d-flex gap-1 justify-content-center">
                            <button class="btn btn-sm btn-success p-1" onclick="saveSingleRow('${s.id}')"><i class="fi fi-rr-disk"></i></button>
                            <button class="btn btn-sm btn-outline-primary p-1" onclick="openEditScoreModal('${s.id}')"><i class="fi fi-rr-edit"></i></button>
                        </div>
                    </td>`;
            } else {
                const sd = s[currentPeriod] || {};
                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${s.displayId || s.studentID || ''}</td>
                    <td class="text-start fw-bold">${name}</td>
                    <td>${sex}</td>
                    <td><input type="number" class="score-input" data-key="monthlyAvg" value="${sd.monthlyAvg || ''}" min="0" max="100"></td>
                    <td><input type="number" class="score-input" data-key="exam" value="${sd.exam || ''}" min="0" max="100"></td>
                    <td class="total-cell fw-bold"></td><td class="average-cell"></td><td class="result-cell fw-bold"></td>
                    <td class="rank-cell"></td><td class="grade-cell fw-bold"></td>
                    <td class="action-column">
                        <div class="d-flex gap-1 justify-content-center">
                            <button class="btn btn-sm btn-success p-1" onclick="saveSingleRow('${s.id}')"><i class="fi fi-rr-disk"></i></button>
                            <button class="btn btn-sm btn-outline-primary p-1" onclick="openEditScoreModal('${s.id}')"><i class="fi fi-rr-edit"></i></button>
                        </div>
                    </td>`;
            }
            els.studentTableBody.appendChild(tr);
            calculateRow(tr);
        });

        els.studentTableBody.querySelectorAll('.score-input').forEach(input => {
            input.oninput = () => {
                calculateRow(input.closest('tr'));
                updateSummaryAndRanks();
            };
        });
        updateSummaryAndRanks();
    }

    function calculateRow(tr) {
        const inputs = tr.querySelectorAll('.score-input');
        let total = 0, filled = 0;
        inputs.forEach(i => { if (i.value !== '') { total += parseFloat(i.value) || 0; filled++; } });
        const hasData = filled > 0;
        let scorePct = 0, avgDisp = '-';

        if (hasData) {
            if (currentPeriod === 'monthly') { scorePct = total; avgDisp = (total/6).toFixed(1); }
            else { scorePct = total / 2; avgDisp = scorePct.toFixed(1); }
        }

        const { grade, label, color } = getGradeAndClass(hasData ? scorePct : null);
        tr.querySelector('.total-cell').textContent = hasData ? total.toFixed(1) : '-';
        tr.querySelector('.average-cell').textContent = hasData ? avgDisp + '%' : '-';
        
        const resCell = tr.querySelector('.result-cell');
        const gradeCell = tr.querySelector('.grade-cell');
        
        if (hasData) {
            const isPass = scorePct >= 50;
            resCell.textContent = isPass ? 'ជាប់' : 'ធ្លាក់';
            resCell.className = `result-cell fw-bold text-center ${isPass ? 'text-success pass-cell' : 'text-danger fail-cell'}`;
            gradeCell.textContent = `${grade} (${label})`;
            gradeCell.className = `grade-cell fw-bold ${color}`;
            tr.dataset.scorePct = scorePct;
            tr.classList.remove('empty-row-print');
        } else {
            resCell.textContent = ''; gradeCell.textContent = ''; 
            tr.dataset.scorePct = '';
            tr.classList.add('empty-row-print');
        }
    }

    function updateSummaryAndRanks() {
        const rows = Array.from(els.studentTableBody.querySelectorAll('tr'));
        const scoredRows = rows.filter(r => r.dataset.scorePct !== '').sort((a, b) => b.dataset.scorePct - a.dataset.scorePct);
        let rank = 1;
        scoredRows.forEach((r, idx) => {
            if (idx > 0 && parseFloat(r.dataset.scorePct) < parseFloat(scoredRows[idx-1].dataset.scorePct)) rank = idx + 1;
            r.querySelector('.rank-cell').textContent = 'ទី' + rank;
        });

        let passed = 0, failed = 0, male = 0, female = 0, lastIdx = 0, lastName = '...';
        const selClass = els.classSelect.value;
        const currentBatch = allStudents.filter(s => s.teacherName === currentTeacherName && s.status !== 'dropped' && s.status !== 'completed' && (!selClass || (s.classRoom || s.class || s.grade) === selClass));
        currentBatch.forEach(s => { if (s.gender === 'Female') female++; else male++; });

        rows.forEach((tr, idx) => {
            const pct = tr.dataset.scorePct;
            if (pct !== '') {
                if (parseFloat(pct) >= 50) passed++; else failed++;
                lastIdx = idx + 1;
                lastName = tr.querySelector('td:nth-child(4)')?.textContent || '...';
            }
        });

        safeSetText(els.totalPassed, passed);
        safeSetText(els.totalFailed, failed);
        ['print-passed', 'print-failed', 'print-male-count', 'print-female-count', 'print-end-no', 'print-end-name'].forEach(id => {
            const val = id.includes('passed') ? passed : id.includes('failed') ? failed : id.includes('male') ? male : id.includes('female') ? female : id.includes('no') ? lastIdx : lastName;
            safeSetText(id, val);
        });
        updateTop5UI(scoredRows);
    }

    function updateTop5UI(sortedRows) {
        const list = document.getElementById('top5List');
        if (!list) return;
        list.innerHTML = '';
        const top5 = sortedRows.slice(0, 5);
        if (top5.length === 0) { list.innerHTML = '<p class="text-muted small text-center py-3">គ្មានទិន្នន័យ...</p>'; return; }
        top5.forEach((r, idx) => {
            const name = r.querySelector('td:nth-child(4)').textContent;
            const avg = r.querySelector('.average-cell').textContent;
            list.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0 py-2">
                    <span class="fw-bold small">${idx+1}. ${name}</span>
                    <span class="badge bg-soft-primary text-primary rounded-pill">${avg}</span>
                </div>`;
        });
    }

    // === 11. TOTAL SCORES SUMMARY ENGINE ===

    window.renderTotalScoresSummary = function() {
        const body = document.getElementById('totalScoresTableBody');
        const classFilter = document.getElementById('summaryClassSelect').value;
        if (!body) return;

        body.innerHTML = '';
        const teacherStudents = allStudents.filter(s => s.teacherName === currentTeacherName && s.status !== 'dropped' && s.status !== 'completed');
        const filtered = classFilter ? teacherStudents.filter(s => (s.classRoom || s.class || s.grade) === classFilter) : teacherStudents;

        const months = ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June", "July", "August"];

        filtered.forEach((s, idx) => {
            const scores = months.map(m => {
                const monthData = (s.monthlyScores && s.monthlyScores[m]) || {};
                return monthData.totalScore || 0;
            });

            const total = scores.reduce((a, b) => a + b, 0);
            const activeMonths = scores.filter(v => v > 0).length;
            const avg = activeMonths > 0 ? (total / activeMonths) : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td class="text-start fw-bold">${(s.englishLastName||'').toUpperCase()} ${(s.englishFirstName||'').toUpperCase()}</td>
                <td>${s.gender==='Female'?'F':'M'}</td>
                ${scores.map(val => `<td>${val > 0 ? val.toFixed(1) : '-'}</td>`).join('')}
                <td class="fw-bold bg-light">${total.toFixed(1)}</td>
                <td class="fw-bold bg-light text-primary">${avg.toFixed(1)}%</td>
            `;
            body.appendChild(tr);
        });

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="${3 + months.length + 2}" class="py-4 text-muted italic">មិនមានទិន្នន័យសម្រាប់ថ្នាក់ដែលបានជ្រើសរើសឡើយ</td></tr>`;
        }
    };

    // Re-render when class filter changes
    document.getElementById('summaryClassSelect')?.addEventListener('change', renderTotalScoresSummary);


    // === 8. DATA SAVING ACTIONS ===

    window.saveSingleRow = async function(sid) {
        const tr = els.studentTableBody.querySelector(`tr[data-sid="${sid}"]`);
        if (!tr) return;
        const inputs = tr.querySelectorAll('.score-input');
        const data = { updatedAt: firebase.database.ServerValue.TIMESTAMP, teacher: currentTeacherName };
        inputs.forEach(i => data[i.dataset.key] = parseFloat(i.value) || 0);
        try {
            const path = currentPeriod === 'monthly' ? `students/${sid}/monthlyScores/${currentSelectedMonth}` : `students/${sid}/${currentPeriod}`;
            await firebase.database().ref(path).update(data);
            Swal.fire({ icon: 'success', title: 'រក្សាទុក!', timer: 800, showConfirmButton: false });
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    };

    window.saveScores = async function() {
        if (currentPeriod === 'monthly' && !currentSelectedMonth) return Swal.fire('Warning', 'សូមជ្រើសរើសខែ!', 'warning');
        const rows = Array.from(els.studentTableBody.querySelectorAll('tr'));
        const updates = {};
        rows.forEach(tr => {
            const sid = tr.dataset.sid;
            const data = { updatedAt: firebase.database.ServerValue.TIMESTAMP, teacher: currentTeacherName };
            tr.querySelectorAll('.score-input').forEach(i => data[i.dataset.key] = parseFloat(i.value) || 0);
            const path = currentPeriod === 'monthly' ? `/students/${sid}/monthlyScores/${currentSelectedMonth}` : `/students/${sid}/${currentPeriod}`;
            updates[path] = data;
        });
        Swal.fire({ title: 'កំពុងរក្សាទុក...', didOpen: () => Swal.showLoading() });
        try { await firebase.database().ref().update(updates); Swal.fire({ icon: 'success', title: 'ជោគជ័យ!', timer: 1500, showConfirmButton: false }); } 
        catch (e) { Swal.fire('Error', e.message, 'error'); }
    };

    window.saveSelectedScores = function() {
        const checks = Array.from(document.querySelectorAll('.student-checkbox:checked'));
        if (checks.length === 0) return Swal.fire('Info', 'សូមជ្រើសរើសសិស្ស!', 'info');
        const updates = {};
        checks.forEach(c => {
            const tr = c.closest('tr');
            const sid = tr.dataset.sid;
            const data = { updatedAt: firebase.database.ServerValue.TIMESTAMP, teacher: currentTeacherName };
            tr.querySelectorAll('.score-input').forEach(i => data[i.dataset.key] = parseFloat(i.value) || 0);
            const path = currentPeriod === 'monthly' ? `/students/${sid}/monthlyScores/${currentSelectedMonth}` : `/students/${sid}/${currentPeriod}`;
            updates[path] = data;
        });
        firebase.database().ref().update(updates).then(() => Swal.fire({ icon: 'success', title: 'Saved!', timer: 1000, showConfirmButton: false }));
    };

    // === 9. MODAL EDITING ===

    window.openEditScoreModal = function(sid) {
        const s = allStudents.find(x => x.id === sid);
        if (!s) return;
        document.getElementById('modalSid').value = sid;
        document.getElementById('modalStudentName').textContent = `${(s.englishLastName || '').toUpperCase()} ${(s.englishFirstName || '').toUpperCase()}`;
        document.getElementById('modalStudentId').textContent = `ID: ${s.displayId || s.studentID}`;
        const container = document.getElementById('modalScoreInputs');
        container.innerHTML = '';
        if (currentPeriod === 'monthly') {
            const ms = s.monthlyScores?.[currentSelectedMonth] || {};
            const fields = [{label:'Attendance',key:'attendance',max:10},{label:'Homework',key:'homework',max:10},{label:'Discipline',key:'discipline',max:15},{label:'Class Work',key:'actionClass',max:10},{label:'Book',key:'book',max:15},{label:'Exam',key:'exam',max:40}];
            fields.forEach(f => container.innerHTML += `<div class="col-6 mb-2"><label class="form-label small fw-bold">${f.label}</label><input type="number" class="form-control modal-score-input" data-key="${f.key}" value="${ms[f.key] || ''}" oninput="calculateModalLive()"></div>`);
        } else {
            const sd = s[currentPeriod] || {};
            container.innerHTML = `<div class="col-6"><label class="form-label small">Monthly Avg</label><input type="number" class="form-control modal-score-input" data-key="monthlyAvg" value="${sd.monthlyAvg || ''}" oninput="calculateModalLive()"></div><div class="col-6"><label class="form-label small">Exam</label><input type="number" class="form-control modal-score-input" data-key="exam" value="${sd.exam || ''}" oninput="calculateModalLive()"></div>`;
        }
        new bootstrap.Modal(document.getElementById('editScoreModal')).show();
    };

    window.calculateModalLive = function() {
        const inputs = document.querySelectorAll('.modal-score-input');
        let total = 0, pct = 0;
        if (currentPeriod === 'monthly') { inputs.forEach(i => total += parseFloat(i.value) || 0); pct = total; }
        else { let m = 0, e = 0; inputs.forEach(i => { if (i.dataset.key==='monthlyAvg') m = parseFloat(i.value)||0; if (i.dataset.key==='exam') e = parseFloat(i.value)||0; }); pct = (m+e)/2; total = pct; }
        safeSetText('modalLiveTotal', total.toFixed(1));
        safeSetText('modalLiveGrade', getGradeAndClass(pct).label || '-');
    };

    window.saveModalScores = async function() {
        const sid = document.getElementById('modalSid').value;
        const data = { updatedAt: firebase.database.ServerValue.TIMESTAMP, teacher: currentTeacherName };
        document.querySelectorAll('.modal-score-input').forEach(i => data[i.dataset.key] = parseFloat(i.value) || 0);
        const path = currentPeriod === 'monthly' ? `students/${sid}/monthlyScores/${currentSelectedMonth}` : `students/${sid}/${currentPeriod}`;
        await firebase.database().ref(path).update(data);
        bootstrap.Modal.getInstance(document.getElementById('editScoreModal')).hide();
    };

    // === 9.5 CLASS MANAGEMENT ===

    let selectedClassStudentIds = new Set();

    window.openCreateClassModal = function() {
        document.getElementById('newClassNameInput').value = '';
        document.getElementById('searchStudentForClass').value = '';
        document.getElementById('selectAllForClass').checked = false;
        
        const teacherStudents = allStudents.filter(s => s.teacherName === currentTeacherName && s.status !== 'dropped' && s.status !== 'completed');
        const classes = [...new Set(teacherStudents.map(s => s.classRoom || s.class || s.grade).filter(c => c))].sort();
        
        const manageClassSelect = document.getElementById('manageClassSelect');
        manageClassSelect.innerHTML = '<option value="NEW">-- បង្កើតថ្នាក់រៀនថ្មី (Create New Class) --</option>';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = `ថ្នាក់៖ ${c}`;
            manageClassSelect.appendChild(opt);
        });
        
        manageClassSelect.value = 'NEW';
        window.onManageClassSelectChange();
        
        new bootstrap.Modal(document.getElementById('createClassModal')).show();
    };

    window.onManageClassSelectChange = function() {
        const val = document.getElementById('manageClassSelect').value;
        const newClassContainer = document.getElementById('newClassInputContainer');
        
        if (val === 'NEW') {
            newClassContainer.classList.remove('d-none');
        } else {
            newClassContainer.classList.add('d-none');
        }
        
        document.getElementById('searchStudentForClass').value = '';
        document.getElementById('selectAllForClass').checked = false;
        
        selectedClassStudentIds.clear();
        if (val !== 'NEW') {
            const classStudents = allStudents.filter(s => (s.classRoom || s.class || s.grade) === val && s.teacherName === currentTeacherName);
            classStudents.forEach(s => selectedClassStudentIds.add(s.id));
        }
        
        renderStudentSelectionTable('');
    };

    window.filterStudentsForClass = function() {
        const query = document.getElementById('searchStudentForClass').value.toLowerCase();
        renderStudentSelectionTable(query);
    };

    function renderStudentSelectionTable(query) {
        const tbody = document.getElementById('studentSelectionTableBody');
        tbody.innerHTML = '';
        
        const activeStudents = allStudents.filter(s => s.status !== 'dropped' && s.status !== 'completed');
        
        const filtered = activeStudents.filter(s => {
            const name = `${(s.englishLastName || '').toLowerCase()} ${(s.englishFirstName || '').toLowerCase()}`;
            const id = (s.displayId || s.studentID || '').toLowerCase();
            return name.includes(query) || id.includes(query);
        }).sort((a, b) => {
            const nameA = `${(a.englishLastName || '').toLowerCase()} ${(a.englishFirstName || '').toLowerCase()}`;
            const nameB = `${(b.englishLastName || '').toLowerCase()} ${(b.englishFirstName || '').toLowerCase()}`;
            return nameA.localeCompare(nameB);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">រកមិនឃើញសិស្ស</td></tr>';
            return;
        }

        filtered.forEach(s => {
            const name = `${(s.englishLastName || '').toUpperCase()} ${(s.englishFirstName || '').toUpperCase()}`;
            const sex = s.gender === 'Female' ? 'ស្រី' : 'ប្រុស';
            const currClass = s.classRoom || s.class || s.grade || 'គ្មាន';
            
            const isChecked = selectedClassStudentIds.has(s.id);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">
                    <input type="checkbox" class="form-check-input class-student-checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} onchange="toggleStudentSelection(this)">
                </td>
                <td><span class="badge bg-light text-dark">${s.displayId || s.studentID || ''}</span></td>
                <td class="fw-bold">${name}</td>
                <td>${sex}</td>
                <td><span class="badge ${currClass === 'គ្មាន' ? 'bg-secondary' : 'bg-info'}">${currClass}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.toggleStudentSelection = function(checkbox) {
        if (checkbox.checked) {
            selectedClassStudentIds.add(checkbox.value);
        } else {
            selectedClassStudentIds.delete(checkbox.value);
        }
    };

    window.toggleSelectAllForClass = function(el) {
        document.querySelectorAll('.class-student-checkbox').forEach(c => {
            c.checked = el.checked;
            window.toggleStudentSelection(c);
        });
    };

    window.saveNewClass = async function() {
        const manageSelectVal = document.getElementById('manageClassSelect').value;
        let targetClassName = '';
        
        if (manageSelectVal === 'NEW') {
            targetClassName = document.getElementById('newClassNameInput').value.trim();
            if (!targetClassName) {
                Swal.fire('Warning', 'សូមបញ្ចូលឈ្មោះថ្នាក់រៀន!', 'warning');
                return;
            }
        } else {
            targetClassName = manageSelectVal;
        }

        Swal.fire({ title: 'កំពុងរក្សាទុក...', didOpen: () => Swal.showLoading() });

        const updates = {};
        const activeStudents = allStudents.filter(s => s.status !== 'dropped' && s.status !== 'completed');
        
        activeStudents.forEach(s => {
            const currClass = s.classRoom || s.class || s.grade;
            const inSet = selectedClassStudentIds.has(s.id);
            const inClass = (currClass === targetClassName && s.teacherName === currentTeacherName);
            
            if (inSet && !inClass) {
                updates[`students/${s.id}/classRoom`] = targetClassName;
                updates[`students/${s.id}/teacherName`] = currentTeacherName;
            } else if (!inSet && inClass) {
                updates[`students/${s.id}/classRoom`] = ""; 
            }
        });

        if (Object.keys(updates).length === 0 && manageSelectVal !== 'NEW') {
            bootstrap.Modal.getInstance(document.getElementById('createClassModal')).hide();
            Swal.fire({ icon: 'info', title: 'គ្មានការផ្លាស់ប្តូរ', timer: 1000, showConfirmButton: false });
            return;
        }

        try {
            await firebase.database().ref().update(updates);
            Swal.fire({ icon: 'success', title: 'ជោគជ័យ!', text: 'ទិន្នន័យត្រូវបានរក្សាទុក', timer: 1500, showConfirmButton: false });
            bootstrap.Modal.getInstance(document.getElementById('createClassModal')).hide();
            
            setTimeout(() => {
                populateClassDropdowns(currentTeacherName);
                if(els.classSelect) {
                    els.classSelect.value = targetClassName;
                }
                renderScoreTable();
            }, 800);
            
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    };

    // === 10. HONOR ROLL & CERTIFICATES ===

    function updateHonorRoll() {
        const cards = document.getElementById('honorRollCards');
        const rows = Array.from(els.studentTableBody.querySelectorAll('tr'));
        const top5 = rows.filter(r => r.dataset.scorePct !== '').sort((a,b) => b.dataset.scorePct - a.dataset.scorePct).slice(0, 5);
        safeSetText('honorTeacherName', currentTeacherName);
        safeSetText('honorTeacherSignature', currentTeacherName);
        cards.innerHTML = top5.length ? '' : '<div class="col-12 py-5 text-muted">គ្មានទិន្នន័យ...</div>';
        const orders = [2, 1, 3, 4, 5];
        top5.forEach((r, idx) => {
            const rank = idx + 1;
            cards.innerHTML += `<div class="col-md-4 col-6 mb-4 order-md-${orders[idx]}"><div class="honor-card honor-rank-${rank} animate__animated animate__zoomIn"><div class="rank-badge bg-rank-${rank<=3?rank:'other'}">ទី${rank}</div><div class="honor-name muol">${r.querySelector('td:nth-child(4)').textContent}</div><div class="fs-4 my-2"><span class="badge bg-pink-primary">${r.querySelector('.grade-cell').textContent.split(' ')[0]}</span></div><div class="pt-2 border-top">Avg: ${r.querySelector('.average-cell').textContent}</div></div></div>`;
        });
    }

    function populateCertificates() {
        const body = document.getElementById('certificateStudentList');
        if (!body) return;
        const top10 = Array.from(els.studentTableBody.querySelectorAll('tr')).filter(r => r.dataset.scorePct !== '').sort((a,b) => b.dataset.scorePct - a.dataset.scorePct).slice(0, 10);
        body.innerHTML = top10.map((r, i) => `<tr><td>${i+1}</td><td class="muol">${r.querySelector('td:nth-child(4)').textContent}</td><td class="fw-bold text-success">${parseFloat(r.dataset.scorePct).toFixed(1)}%</td><td><button class="btn btn-xs btn-outline-info me-1" onclick="previewCertificate('${r.dataset.sid}')"><i class="fi fi-rr-eye"></i></button><button class="btn btn-xs btn-pink-primary" onclick="printCertificate('${r.dataset.sid}')"><i class="fi fi-rr-print"></i></button></td></tr>`).join('');
        if (top10[0]) previewCertificate(top10[0].dataset.sid);
    }

    window.previewCertificate = function(sid) {
        const s = allStudents.find(x => x.id === sid);
        const tr = els.studentTableBody.querySelector(`tr[data-sid="${sid}"]`);
        if (!s || !tr) return;
        safeSetText('certStudentName', tr.querySelector('td:nth-child(4)').textContent);
        safeSetText('certStudentGender', tr.querySelector('td:nth-child(5)').textContent);
        safeSetText('certStudentRank', tr.querySelector('.rank-cell').textContent.replace('ទី', ''));
        safeSetText('certStudentClass', s.classRoom || s.grade || '...');
        safeSetText('certStudentPeriod', currentSelectedMonth);
        safeSetText('certCurrentDate', `ថ្ងៃទី ${new Date().getDate()} ខែ ${MONTHS_LIST[new Date().getMonth()]} ឆ្នាំ ${new Date().getFullYear()}`);
        document.getElementById('uiCertificatePreview').innerHTML = document.getElementById('printableCertificate').innerHTML;
    };

    window.printCertificate = (sid) => { previewCertificate(sid); document.body.classList.add('printing-certificate'); window.print(); setTimeout(() => document.body.classList.remove('printing-certificate'), 500); };

    // === 11. REPORTS & MONTH CONFIG ===

    window.renderTotalScores = function() {
        const body = document.getElementById('totalScoresTableBody');
        const selClass = els.summaryClassSelect.value;
        if (!body) return;
        body.innerHTML = '';
        const filtered = allStudents.filter(s => s.teacherName === currentTeacherName && s.status !== 'dropped' && (!selClass || (s.classRoom || s.class || s.grade) === selClass));
        filtered.forEach((s, idx) => {
            let rowTotal = 0, mCount = 0, cells = '';
            MONTHS_LIST.forEach(m => {
                const ms = s.monthlyScores?.[m];
                const t = ms ? (parseFloat(ms.attendance||0)+parseFloat(ms.homework||0)+parseFloat(ms.discipline||0)+parseFloat(ms.actionClass||0)+parseFloat(ms.book||0)+parseFloat(ms.exam||0)) : 0;
                cells += `<td class="text-center small">${t > 0 ? t.toFixed(1) : '-'}</td>`;
                if (t > 0) { rowTotal += t; mCount++; }
            });
            body.innerHTML += `<tr><td>${idx+1}</td><td class="text-start fw-bold">${(s.englishLastName||'').toUpperCase()} ${(s.englishFirstName||'').toUpperCase()}</td><td>${s.gender==='Female'?'ស្រី':'ប្រុស'}</td>${cells}<td class="fw-bold bg-light">${rowTotal.toFixed(1)}</td><td class="fw-bold bg-soft-avg">${mCount>0 ? (rowTotal/mCount).toFixed(1)+'%' : '-'}</td></tr>`;
        });
    };

    window.renderTrimesterReport = function() {
        const body = document.getElementById('trimesterReportTableBody');
        const trimester = document.getElementById('reportTrimesterSelect').value;
        const selClass = els.summaryClassSelect.value;
        if (!body) return;

        const trimesters = {
            'T1': ['September', 'October', 'November'],
            'T2': ['December', 'January', 'February'],
            'T3': ['March', 'April', 'May']
        };
        const months = trimesters[trimester] || trimesters['T3'];
        
        document.getElementById('reportPeriodName').textContent = trimester === 'T1' ? 'Trimester I' : trimester === 'T2' ? 'Trimester II' : 'Trimester III';
        document.getElementById('reportMonthSubHeader').innerHTML = months.map(m => `<th class="vertical-th"><span class="vertical-text">${m}</span></th>`).join('');

        const filtered = allStudents.filter(s => s.teacherName === currentTeacherName && s.status !== 'dropped' && (!selClass || (s.classRoom || s.class || s.grade) === selClass));
        
        const studentsWithStats = filtered.map(s => {
            let total = 0, count = 0;
            let mScores = months.map(m => {
                const ms = s.monthlyScores?.[m];
                const t = ms ? (parseFloat(ms.attendance||0)+parseFloat(ms.homework||0)+parseFloat(ms.discipline||0)+parseFloat(ms.actionClass||0)+parseFloat(ms.book||0)+parseFloat(ms.exam||0)) : 0;
                if (t > 0) { total += t; count++; }
                return t;
            });
            const avg = count > 0 ? total / count : 0;
            return { ...s, mScores, total, avg };
        }).sort((a, b) => b.avg - a.avg);

        let currentRank = 0;
        let lastAvg = -1;
        body.innerHTML = '';
        studentsWithStats.forEach((s, idx) => {
            if (s.avg !== lastAvg) {
                currentRank = idx + 1;
            }
            lastAvg = s.avg;
            
            const displayRank = s.avg > 0 ? currentRank : '-';
            const res = s.avg >= 50 ? 'Pass' : s.avg > 0 ? 'Fail' : '-';
            const gradeInfo = getGradeAndClass(s.avg);
            
            // Handle A+ if needed (e.g. > 95)
            let gradeHtml = `<span class="grade-box ${gradeInfo.grade==='F'?'grade-f':'grade-a'}">${gradeInfo.grade || '-'}</span>`;
            if (s.avg >= 98) {
                gradeHtml = `<span class="grade-box grade-aplus">A+</span>`;
            } else if (gradeInfo.grade === 'A') {
                gradeHtml = `<span class="grade-box grade-a">A</span>`;
            } else if (gradeInfo.grade === 'B') {
                gradeHtml = `<span class="grade-box grade-b">B</span>`;
            } else if (gradeInfo.grade === 'C') {
                gradeHtml = `<span class="grade-box grade-c">C</span>`;
            } else if (gradeInfo.grade === 'D') {
                gradeHtml = `<span class="grade-box grade-d">D</span>`;
            } else if (gradeInfo.grade === 'F') {
                gradeHtml = `<span class="grade-box grade-f">F</span>`;
            }

            if (idx === 0) {
                safeSetText('reportLevelDisplay', s.classRoom || s.grade || 'K2');
                safeSetText('reportRoomDisplay', s.room || 'LAB1');
                safeSetText('reportTimeDisplay', s.studyTime || '5:00PM-6:00PM');
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><span class="badge bg-light text-dark">${s.displayId || s.studentID || ''}</span></td>
                <td class="text-start fw-bold">${(s.englishLastName||'').toUpperCase()} ${(s.englishFirstName||'').toUpperCase()}</td>
                <td>${s.gender==='Female'?'F':'M'}</td>
                ${s.mScores.map(val => `<td>${val > 0 ? val.toFixed(1) : '-'}</td>`).join('')}
                <td class="fw-bold">${s.total.toFixed(1)}</td>
                <td class="fw-bold">${s.avg.toFixed(1)}</td>
                <td><span class="${res === 'Pass' ? 'res-pass' : 'res-fail'}">${res}</span></td>
                <td>${displayRank}</td>
                <td>${gradeHtml}</td>
            `;
            body.appendChild(tr);
        });
        
        if (studentsWithStats.length === 0) {
            body.innerHTML = '<tr><td colspan="12" class="py-5 text-muted">មិនមានទិន្នន័យសម្រាប់ថ្នាក់នេះទេ</td></tr>';
        }
    };

    async function loadMonthConfig() {
        const snap = await firebase.database().ref('settings/monthConfig').once('value');
        const data = snap.val();
        window.monthConfigData = data ? Object.values(data).sort((a,b) => a.code.localeCompare(b.code)) : [];
        renderMonthConfigUI();
    }

    function renderMonthConfigUI() {
        const tbody = document.getElementById('monthConfigTableBody');
        if (!tbody) return;
        tbody.innerHTML = window.monthConfigData.map((m, idx) => `<tr><td><span class="code-badge">${m.code}</span></td><td><input type="text" class="month-name-input" value="${m.name}" onchange="window.monthConfigData[${idx}].name=this.value"></td><td><select class="config-select" onchange="window.monthConfigData[${idx}].rank=this.value"><option value="1" ${m.rank==='1'?'selected':''}>1</option><option value="2" ${m.rank==='2'?'selected':''}>2</option></select></td><td>${m.active ? `<button class="btn-status-active">សកម្ម</button>` : `<button class="btn-status-inactive" onclick="window.setActiveMonth(${idx})">ជ្រើសរើស</button>`}</td><td><button class="btn-delete-row" onclick="window.deleteMonthRow(${idx})"><i class="fi fi-rr-trash"></i></button></td></tr>`).join('');
        refreshDropdowns();
    }

    window.setActiveMonth = (idx) => { window.monthConfigData.forEach((m, i) => m.active = (i === idx)); renderMonthConfigUI(); };
    window.addNewMonthRow = () => { window.monthConfigData.push({ code: (window.monthConfigData.length+1).toString().padStart(2,'0'), name: 'New Month', rank: '1', active: false }); renderMonthConfigUI(); };
    window.deleteMonthRow = (idx) => { window.monthConfigData.splice(idx, 1); renderMonthConfigUI(); };
    window.saveMonthSettings = async () => { const up = {}; window.monthConfigData.forEach(m => up[m.code] = m); await firebase.database().ref('settings/monthConfig').set(up); Swal.fire({ icon: 'success', title: 'Saved!', timer: 800 }); loadMonthConfig(); bootstrap.Modal.getInstance(document.getElementById('monthSettingsModal')).hide(); };

    function refreshDropdowns() {
        [els.monthSelect, els.dashMonthSelect].forEach(s => {
            if (!s) return;
            const cur = s.value; s.innerHTML = '';
            window.monthConfigData.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.name; opt.textContent = m.name;
                if (m.active) { opt.selected = true; currentSelectedMonth = m.name; }
                s.appendChild(opt);
            });
            if (cur && !window.monthConfigData.find(m => m.active)) s.value = cur;
        });
    }

    function initSettingsPage() { safeSetText('settingsTeacherName', currentTeacherName); safeSetText('settingsStudentCount', allStudents.filter(s => s.teacherName === currentTeacherName).length + ' នាក់'); }
    window.updateTeacherSettings = async () => { const next = document.getElementById('newCode').value; if (next !== document.getElementById('confirmNewCode').value) return Swal.fire('Error', 'Mismatch', 'error'); await firebase.database().ref(`teachers/${currentTeacherName}`).update({ code: next }); Swal.fire('Success', 'Updated', 'success'); };

    // Core Event Bindings
    els.monthSelect.onchange = (e) => { currentSelectedMonth = e.target.value; if (els.dashMonthSelect) els.dashMonthSelect.value = currentSelectedMonth; renderScoreTable(); };
    if (els.dashMonthSelect) els.dashMonthSelect.onchange = (e) => { currentSelectedMonth = e.target.value; els.monthSelect.value = currentSelectedMonth; renderScoreTable(); };
    els.periodSelect.onchange = (e) => { currentPeriod = e.target.value; document.getElementById('monthSelectContainer').classList.toggle('d-none', currentPeriod !== 'monthly'); renderScoreTable(); };
    els.classSelect.onchange = renderScoreTable;
    if (els.summaryClassSelect) els.summaryClassSelect.onchange = renderTotalScoresSummary;

    document.getElementById('togglePassword').onclick = function() {
        const t = els.teacherSecret.type === 'password' ? 'text' : 'password';
        els.teacherSecret.type = t;
        this.querySelector('i').className = t === 'password' ? 'fi fi-rr-eye' : 'fi fi-rr-eye-crossed';
    };

    initData();
});
