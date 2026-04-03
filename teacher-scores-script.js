document.addEventListener('DOMContentLoaded', function () {
    const teacherLoginForm = document.getElementById('teacherLoginForm');
    const loginSection = document.getElementById('login-section');
    const scoreSection = document.getElementById('score-section');
    const teacherSelect = document.getElementById('teacherSelect');
    const teacherSecret = document.getElementById('teacherSecret');
    
    const displayTeacherName = document.getElementById('displayTeacherName');
    const displayDate = document.getElementById('displayDate');
    const studentScoreTableBody = document.getElementById('studentScoreTableBody');
    
    const totalPassedElem = document.getElementById('totalPassed');
    const totalFailedElem = document.getElementById('totalFailed');

    const togglePasswordBtn = document.getElementById('togglePassword');
    const monthSelect = document.getElementById('monthSelect');
    const monthSelectContainer = document.getElementById('monthSelectContainer');

    // Print Header Spans
    const printMonth = document.getElementById('print-month');
    const printLevel = document.getElementById('print-level');
    const printRoom = document.getElementById('print-room');
    const printTime = document.getElementById('print-time');
    
    // Toggle Password Visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function () {
            const type = teacherSecret.getAttribute('type') === 'password' ? 'text' : 'password';
            teacherSecret.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fi-rr-eye');
            this.querySelector('i').classList.toggle('fi-rr-eye-crossed');
        });
    }

    let allStudents = [];
    let uniqueTeachers = [];

    // 1. Fetch ALL Students and Teachers data
    async function initTeacherList() {
        try {
            // Get teachers' custom passwords if any
            const teacherSettingsSnapshot = await firebase.database().ref('teachers').once('value');
            window.teacherSettings = teacherSettingsSnapshot.val() || {};

            const snapshot = await firebase.database().ref('students').once('value');
            const data = snapshot.val();
            
            if (data) {
                allStudents = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                
                const teacherSet = new Set();
                allStudents.forEach(s => {
                    if (s.teacherName && s.teacherName.trim() !== '') {
                        teacherSet.add(s.teacherName.trim());
                    }
                });
                
                uniqueTeachers = Array.from(teacherSet).sort();
                
                teacherSelect.innerHTML = '<option value="" disabled selected>-- ជ្រើសរើសគ្រូ --</option>';
                uniqueTeachers.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    teacherSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error fetching teachers:", error);
        }
    }

    initTeacherList();

    // Handle Teacher Login
    teacherLoginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        const selectedTeacher = teacherSelect.value;
        const secretInput = teacherSecret.value;
        
        // Dynamic "Secret Code" logic: 
        // 1. Look in 'teachers' node in Firebase
        // 2. Default to '1234'
        const storedTeacherData = window.teacherSettings ? window.teacherSettings[selectedTeacher] : null;
        const correctSecret = (storedTeacherData && storedTeacherData.code) ? storedTeacherData.code.toString() : '1234';
        
        if (selectedTeacher && secretInput === correctSecret) {
            loginSection.classList.add('d-none');
            scoreSection.classList.remove('d-none');
            
            displayTeacherName.textContent = selectedTeacher;
            updateCurrentDate();
            renderTeacherStudents(selectedTeacher);
            
            Swal.fire({
                icon: 'success',
                title: 'ជោគជ័យ',
                text: 'សូមស្វាគមន៍លោកគ្រូ/អ្នកគ្រូ ' + selectedTeacher,
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'បរាជ័យ',
                text: 'លេខកូដសម្ងាត់មិនត្រឹមត្រូវទេ!',
                footer: '<span class="text-muted small">ចំណាំ៖ ប្រសិនបើលោកគ្រូមិនទាន់ប្តូរលេខកូដ សូមប្រើ 1234</span>'
            });
        }
    });

    function updateCurrentDate() {
        const now = new Date();
        const khTime = new Intl.DateTimeFormat('km-KH', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        }).format(now);
        displayDate.textContent = khTime;
    }

    const scoreTableHeader = document.getElementById('scoreTableHeader');
    const periodSelect = document.getElementById('periodSelect');
    
    let currentTeacherName = '';
    let currentPeriod = 'monthly'; // default

    // Period Change Switch
    periodSelect.addEventListener('change', function() {
        currentPeriod = this.value;
        if (currentPeriod === 'monthly') {
            monthSelectContainer.classList.remove('d-none');
        } else {
            monthSelectContainer.classList.add('d-none');
        }
        renderTeacherStudents(currentTeacherName);
    });

    // Month Change Switch
    monthSelect.addEventListener('change', function() {
        renderTeacherStudents(currentTeacherName);
    });

    // Monthly score max per category (total = 100)
    const MONTHLY_MAX = {
        attendance:  10,
        homework:    10,
        discipline:  15,
        actionClass: 10,
        book:        15,
        exam:        40
    };

    function renderTableHeader() {
        if (currentPeriod === 'monthly') {
            scoreTableHeader.innerHTML = `
                <tr>
                    <th class="action-column" style="width: 40px;"><input type="checkbox" id="selectAllStudents" class="form-check-input"></th>
                    <th style="width: 45px;">N.O</th>
                    <th style="width: 75px;">Student ID</th>
                    <th style="width: 155px;">Student Name</th>
                    <th style="width: 38px;">Sex</th>
                    <th class="vertical-th" data-type="score">Attendance<br><small class="fw-normal opacity-75">/10</small></th>
                    <th class="vertical-th" data-type="score">Homework<br><small class="fw-normal opacity-75">/10</small></th>
                    <th class="vertical-th" data-type="score">Discipline<br><small class="fw-normal opacity-75">/15</small></th>
                    <th class="vertical-th" data-type="score">Action Class<br><small class="fw-normal opacity-75">/10</small></th>
                    <th class="vertical-th" data-type="score">Book<br><small class="fw-normal opacity-75">/15</small></th>
                    <th class="vertical-th" data-type="score">Exam<br><small class="fw-normal opacity-75">/40</small></th>
                    <th class="vertical-th">Total<br><small class="fw-normal opacity-75">/100</small></th>
                    <th class="vertical-th">Average<br><small class="fw-normal opacity-75">%</small></th>
                    <th class="vertical-th">Result</th>
                    <th class="vertical-th">Rank</th>
                    <th class="vertical-th">Grade</th>
                    <th class="action-column" style="width: 120px;">Action</th>
                </tr>
            `;
            
            // Re-bind Select All
            setTimeout(() => {
                const selectAll = document.getElementById('selectAllStudents');
                if (selectAll) {
                    selectAll.onclick = (e) => {
                        const checks = document.querySelectorAll('.student-checkbox');
                        checks.forEach(c => c.checked = e.target.checked);
                    };
                }
            }, 100);
        } else {
            // Semester 1 & 2 share similar columns
            const semNum = currentPeriod === 'semester1' ? '1' : '2';
            scoreTableHeader.innerHTML = `
                <tr>
                    <th style="width: 45px;">N.O</th>
                    <th style="width: 90px;">Student ID</th>
                    <th style="width: 90px;">Student Name</th>
                    <th style="width: 50px;">Sex</th>
                    <th style="width: 90px;">Monthly Avg</th>
                    <th style="width: 90px;">Semester ${semNum} Exam</th>
                    <th style="width: 70px;">Total</th>
                    <th style="width: 70px;">Average</th>
                    <th style="width: 70px;">Result</th>
                    <th style="width: 60px;">Rank</th>
                    <th style="width: 60px;">Grade</th>
                </tr>
            `;
        }
    }

    function renderTeacherStudents(teacherName) {
        currentTeacherName = teacherName;
        studentScoreTableBody.innerHTML = '';
        renderTableHeader();
        
        // Filter students for THIS teacher
        const filteredStudents = allStudents.filter(s => 
            s.teacherName === teacherName && 
            s.status !== 'dropped' && 
            s.status !== 'completed'
        );

        if (filteredStudents.length === 0) {
            studentScoreTableBody.innerHTML = '<tr><td colspan="15" class="text-center py-4 text-muted">មិនមានសិស្សក្នុងបញ្ជីរបស់លោកគ្រូ/អ្នកគ្រូទេ</td></tr>';
            return;
        }

        // Update Print Header Info
        const selectedMonth = monthSelect.value;
        if (printMonth) printMonth.textContent = selectedMonth || '........';

        // Get Level/Room/Time from first student if available
        if (filteredStudents.length > 0) {
            const s = filteredStudents[0];
            if (printLevel) printLevel.textContent = s.class || 'K2';
            if (printRoom) printRoom.textContent = s.room || 'LAB1';
            if (printTime) printTime.textContent = s.time || '5:00PM-6:00PM';
        }
        
        filteredStudents.forEach((student, idx) => {
            const tr = document.createElement('tr');
            const studentName = `${(student.englishLastName || '').toUpperCase()} ${(student.englishFirstName || '').toUpperCase()}`;
            
            if (currentPeriod === 'monthly') {
                const selectedMonth = monthSelect.value;
                const ms = (student.monthlyScores && selectedMonth) ? (student.monthlyScores[selectedMonth] || {}) : {};
                tr.innerHTML = `
                    <td class="action-column"><input type="checkbox" class="form-check-input student-checkbox" data-sid="${student.id}"></td>
                    <td>${idx + 1}</td>
                    <td><span class="badge bg-light text-dark border">${student.displayId || student.studentID || 'N/A'}</span></td>
                    <td class="text-start fw-bold">${studentName}</td>
                    <td>${student.gender === 'Female' ? 'ស្រី' : 'ប្រុស'}</td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${ms.attendance || ''}" data-sid="${student.id}" data-key="attendance" min="0" max="10" step="0.5"></td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${ms.homework || ''}" data-sid="${student.id}" data-key="homework" min="0" max="10" step="0.5"></td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${ms.discipline || ''}" data-sid="${student.id}" data-key="discipline" min="0" max="15" step="0.5"></td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${ms.actionClass || ''}" data-sid="${student.id}" data-key="actionClass" min="0" max="10" step="0.5"></td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${ms.book || ''}" data-sid="${student.id}" data-key="book" min="0" max="15" step="0.5"></td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${ms.exam || ''}" data-sid="${student.id}" data-key="exam" min="0" max="40" step="0.5"></td>
                    <td class="total-cell fw-bold">-</td>
                    <td class="average-cell">-</td>
                    <td class="result-cell fw-bold"></td>
                    <td class="rank-cell">-</td>
                    <td class="grade-cell fw-bold"></td>
                    <td class="action-column">
                        <div class="d-flex gap-1 justify-content-center">
                            <button class="btn btn-sm btn-success p-1" onclick="saveSingleRow('${student.id}')" title="Save Row">
                                <i class="fi fi-rr-disk" style="font-size: 0.8rem;"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary p-1" onclick="openEditScoreModal('${student.id}')" title="Edit Scores">
                                <i class="fi fi-rr-edit" style="font-size: 0.8rem;"></i>
                            </button>
                        </div>
                    </td>
                `;
            } else {
                // Semester 1 or 2
                const semData = student[currentPeriod] || { monthlyAvg: 0, exam: 0 };
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td><span class="badge bg-light text-dark border">${student.displayId || student.studentID || 'N/A'}</span></td>
                    <td class="text-start fw-bold">${(student.englishLastName || '').toUpperCase()} ${(student.englishFirstName || '').toUpperCase()}</td>
                    <td>${student.gender === 'Female' ? 'ស្រី' : 'ប្រុស'}</td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${semData.monthlyAvg || ''}" data-sid="${student.id}" data-type="monthlyAvg" min="0" max="100"></td>
                    <td><input type="number" class="score-input form-control form-control-sm text-center" value="${semData.exam || ''}" data-sid="${student.id}" data-type="exam" min="0" max="100"></td>
                    <td class="total-cell fw-bold">0</td>
                    <td class="average-cell">0%</td>
                    <td class="result-cell fw-bold"></td>
                    <td class="rank-cell">0</td>
                    <td class="grade-cell fw-bold"></td>
                    <td class="action-column">
                        <div class="d-flex gap-1 justify-content-center">
                            <button class="btn btn-sm btn-outline-primary p-1" onclick="openEditScoreModal('${student.id}')" title="Edit Scores">
                                <i class="fi fi-rr-edit" style="font-size: 0.8rem;"></i>
                            </button>
                        </div>
                    </td>
                `;
            }
            
            studentScoreTableBody.appendChild(tr);
            calculateRow(tr);
        });

        // Event for inputs
        document.querySelectorAll('.score-input').forEach(input => {
            input.addEventListener('input', function() {
                calculateRow(this.closest('tr'));
                updateSummary();
                updateRanks();
            });
        });
        
        updateSummary();
        updateRanks();
    }

    function calculateRow(tr) {
        const inputs = tr.querySelectorAll('.score-input');
        let total = 0;
        let filledCount = 0;

        inputs.forEach(input => {
            const val = input.value.trim();
            if (val !== '') {
                total += parseFloat(val) || 0;
                filledCount++;
            }
        });

        const hasData = filledCount > 0;

        // scorePct: used for Grade / Result / Rank (percentage out of 100)
        // avgDisplay: displayed in Average column (mean of the 6 or 2 scores)
        let scorePct   = 0;
        let avgDisplay = '-';

        if (hasData) {
            if (currentPeriod === 'monthly') {
                scorePct   = total;              // total already out of 100
                avgDisplay = (total / 6).toFixed(2);  // mean of 6 categories
            } else {
                scorePct   = total / 2;          // semester: avg of 2 inputs
                avgDisplay = scorePct.toFixed(2);
            }
        }

        const totalDisplay = hasData ? +total.toFixed(2) : '-';

        tr.querySelector('.total-cell').textContent   = totalDisplay;
        tr.querySelector('.average-cell').textContent = avgDisplay;

        // --- Grade (based on % score) ---
        const gradeCell = tr.querySelector('.grade-cell');
        let grade = '';
        if (hasData) {
            if (scorePct >= 96)      grade = 'A+';
            else if (scorePct >= 90) grade = 'A';
            else if (scorePct >= 80) grade = 'B';
            else if (scorePct >= 70) grade = 'C';
            else if (scorePct >= 50) grade = 'D';
            else                     grade = 'F';
        }
        gradeCell.textContent = grade;
        gradeCell.className = 'grade-cell fw-bold';
        if      (grade === 'A+' || grade === 'A') gradeCell.classList.add('text-success');
        else if (grade === 'F')                   gradeCell.classList.add('text-danger');
        else if (grade === 'D')                   gradeCell.classList.add('text-warning');
        else if (grade !== '')                    gradeCell.classList.add('text-primary');

        // --- Result ---
        const resultCell = tr.querySelector('.result-cell');
        if (!hasData) {
            resultCell.textContent = '';
            resultCell.className = 'result-cell fw-bold';
        } else if (scorePct >= 50) {
            resultCell.textContent = 'Pass';
            resultCell.className = 'result-cell fw-bold pass-cell text-center';
        } else {
            resultCell.textContent = 'Fail';
            resultCell.className = 'result-cell fw-bold fail-cell text-center';
        }

        // --- Rank placeholder (real ranks set by updateRanks) ---
        const rankCell = tr.querySelector('.rank-cell');
        if (!hasData) rankCell.textContent = '-';

        // Dynamic Styling for Results and Grades
        const currentResult = resultCell.textContent;
        resultCell.classList.remove('pass-cell', 'fail-cell');
        gradeCell.classList.remove('grade-a', 'grade-f');
        
        if (currentResult === 'ជាប់') resultCell.classList.add('pass-cell');
        else if (currentResult === 'ធ្លាក់') resultCell.classList.add('fail-cell');

        if (grade === 'F') gradeCell.classList.add('grade-f');
        else if (grade === 'A' || grade === 'A+') gradeCell.classList.add('grade-a');

        // Store scorePct for rank sorting
        tr.dataset.scorePct = hasData ? scorePct : '';

        // Tag row for print hiding if no data exists
        if (!hasData) {
            tr.classList.add('empty-row-print');
        } else {
            tr.classList.remove('empty-row-print');
        }
    }

    function updateRanks() {
        const rows = Array.from(studentScoreTableBody.querySelectorAll('tr'));
        // Use stored scorePct from dataset for accurate sorting
        const rowData = rows
            .map(tr => ({ tr, pct: parseFloat(tr.dataset.scorePct) }))
            .filter(d => !isNaN(d.pct) && d.pct > 0);

        rowData.sort((a, b) => b.pct - a.pct);

        let currentRank = 1;
        for (let i = 0; i < rowData.length; i++) {
            if (i > 0 && rowData[i].pct < rowData[i - 1].pct) {
                currentRank = i + 1;
            }
            rowData[i].tr.querySelector('.rank-cell').textContent = currentRank;
        }
    }

    function updateSummary() {
        const rows = Array.from(studentScoreTableBody.querySelectorAll('tr'));
        let passed = 0;
        let failed = 0;
        let lastNo = 0;
        let lastName = '...';
        
        // Accurate Statistics from current table data
        rows.forEach((tr, idx) => {
            const resultCell = tr.querySelector('.result-cell');
            if (resultCell && resultCell.textContent) {
                const res = resultCell.textContent;
                // Only count students who actually have a result (not empty)
                const hasScore = tr.dataset.scorePct !== '';
                if (hasScore) {
                    if (res === 'ជាប់') passed++;
                    else if (res === 'ធ្លាក់') failed++;
                    
                    lastNo = idx + 1;
                    const nameCell = tr.querySelector('td:nth-child(3)');
                    if (nameCell) lastName = nameCell.textContent;
                }
            }
        });

        // Gender Calculation for the current teacher's class
        let maleCount = 0;
        let femaleCount = 0;
        const currentClassStudents = allStudents.filter(s => 
            s.teacherName === currentTeacherName && s.status !== 'dropped' && s.status !== 'completed'
        );
        currentClassStudents.forEach(s => {
            if (s.gender === 'Male') maleCount++;
            else if (s.gender === 'Female') femaleCount++;
        });

        // Update UI
        totalPassedElem.textContent = passed;
        totalFailedElem.textContent = failed;

        // Populate Print Spans
        const el = (id) => document.getElementById(id);
        if (el('print-passed')) el('print-passed').textContent = passed;
        if (el('print-failed')) el('print-failed').textContent = failed;
        if (el('print-male-count')) el('print-male-count').textContent = maleCount;
        if (el('print-female-count')) el('print-female-count').textContent = femaleCount;
        if (el('print-end-no')) el('print-end-no').textContent = lastNo;
        if (el('print-end-name')) el('print-end-name').textContent = lastNo > 0 ? lastName : '...';

        // Refresh Honor Roll
        updateHonorRoll();
    }

    window.openEditScoreModal = function(sid) {
        const student = allStudents.find(s => s.id === sid);
        if (!student) return;

        document.getElementById('modalSid').value = sid;
        document.getElementById('modalStudentName').textContent = (student.englishLastName || '') + ' ' + (student.englishFirstName || '');
        document.getElementById('modalStudentId').textContent = `ID: ${student.displayId || student.studentID}`;
        
        const container = document.getElementById('modalScoreInputs');
        container.innerHTML = '';

        if (currentPeriod === 'monthly') {
            const selectedMonth = monthSelect.value;
            if (!selectedMonth) { Swal.fire('Error', 'Please select a month first', 'error'); return; }
            const ms = (student.monthlyScores && student.monthlyScores[selectedMonth]) ? student.monthlyScores[selectedMonth] : {};
            
            const fields = [
                { label: 'អវត្តមាន/វត្តមាន (Attendance)', key: 'attendance', max: 10 },
                { label: 'កិច្ចការផ្ទះ (Homework)', key: 'homework', max: 10 },
                { label: 'វិន័យ (Discipline)', key: 'discipline', max: 15 },
                { label: 'Action Class', key: 'actionClass', max: 10 },
                { label: 'សៀវភៅ (Book)', key: 'book', max: 15 },
                { label: 'ការប្រឡង (Exam)', key: 'exam', max: 40 }
            ];

            fields.forEach(f => {
                container.innerHTML += `
                    <div class="col-md-6 col-lg-4">
                        <label class="form-label small fw-bold">${f.label} (/${f.max})</label>
                        <input type="number" class="form-control modal-score-input" data-key="${f.key}" value="${ms[f.key] || ''}" min="0" max="${f.max}" step="0.5" oninput="calculateModalLive()">
                    </div>
                `;
            });
        } else {
            const semData = student[currentPeriod] || {};
            container.innerHTML = `
                <div class="col-md-6">
                    <label class="form-label small fw-bold">មធ្យមភាគប្រចាំខែ (Monthly Avg /100)</label>
                    <input type="number" class="form-control modal-score-input" data-key="monthlyAvg" value="${semData.monthlyAvg || ''}" min="0" max="100" oninput="calculateModalLive()">
                </div>
                <div class="col-md-6">
                    <label class="form-label small fw-bold">ពិន្ទុប្រឡង (Exam Score /100)</label>
                    <input type="number" class="form-control modal-score-input" data-key="exam" value="${semData.exam || ''}" min="0" max="100" oninput="calculateModalLive()">
                </div>
            `;
        }

        setTimeout(() => calculateModalLive(), 100);
        new bootstrap.Modal(document.getElementById('editScoreModal')).show();
    };

    window.calculateModalLive = function() {
        const inputs = document.querySelectorAll('.modal-score-input');
        let total = 0;
        let scorePct = 0;
        
        if (currentPeriod === 'monthly') {
            inputs.forEach(i => { total += parseFloat(i.value) || 0; });
            scorePct = total;
        } else {
            let mAvg = 0, exam = 0;
            inputs.forEach(i => {
                if (i.dataset.key === 'monthlyAvg') mAvg = parseFloat(i.value) || 0;
                if (i.dataset.key === 'exam') exam = parseFloat(i.value) || 0;
            });
            scorePct = (mAvg + exam) / 2;
            total = scorePct; // Just for display
        }

        let grade = '-';
        if (scorePct >= 96) grade = 'A+';
        else if (scorePct >= 90) grade = 'A';
        else if (scorePct >= 80) grade = 'B';
        else if (scorePct >= 70) grade = 'C';
        else if (scorePct >= 50) grade = 'D';
        else grade = 'F';

        document.getElementById('modalLiveTotal').textContent = total.toFixed(2);
        document.getElementById('modalLiveGrade').textContent = grade;
    };

    window.saveModalScores = async function() {
        const sid = document.getElementById('modalSid').value;
        const inputs = document.querySelectorAll('.modal-score-input');
        const data = {};
        
        inputs.forEach(i => {
            data[i.dataset.key] = parseFloat(i.value) || 0;
        });
        
        data.updatedAt = firebase.database.ServerValue.TIMESTAMP;
        data.teacher = currentTeacherName;

        try {
            if (currentPeriod === 'monthly') {
                const month = monthSelect.value;
                await firebase.database().ref(`students/${sid}/monthlyScores/${month}`).update(data);
            } else {
                await firebase.database().ref(`students/${sid}/${currentPeriod}`).update(data);
            }
            
            bootstrap.Modal.getInstance(document.getElementById('editScoreModal')).hide();
            Swal.fire({ icon: 'success', title: 'រក្សាទុកជោគជ័យ', timer: 1000, showConfirmButton: false });
            
            // Re-render table to show new values
            renderTeacherStudents(currentTeacherName);
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    };

    function updateHonorRoll() {
        const honorRollSection = document.getElementById('honorRollSection');
        const honorRollCards = document.getElementById('honorRollCards');
        const honorTeacherName = document.getElementById('honorTeacherName');
        
        honorTeacherName.textContent = currentTeacherName;
        honorRollCards.innerHTML = '';

        // Extract students who have results from the DOM table
        const rows = Array.from(studentScoreTableBody.querySelectorAll('tr'));
        const topStudents = rows
            .map(tr => {
                const rankText = tr.querySelector('.rank-cell').textContent;
                const rank = parseInt(rankText) || 999;
                return {
                    name: tr.querySelector('td:nth-child(3)').textContent,
                    id: tr.querySelector('td:nth-child(2)').textContent,
                    rank: rank,
                    avg: tr.querySelector('.average-cell').textContent,
                    grade: tr.querySelector('.grade-cell').textContent,
                    sex: tr.querySelector('td:nth-child(4)').textContent
                };
            })
            .filter(s => s.rank >= 1 && s.rank <= 5)
            .sort((a, b) => a.rank - b.rank);

        if (topStudents.length === 0) {
            honorRollSection.style.display = 'none';
            return;
        }

        honorRollSection.style.display = 'block';
        topStudents.forEach(s => {
            const rankClass = s.rank <= 3 ? `honor-rank-${s.rank}` : '';
            const badgeClass = s.rank <= 3 ? `bg-rank-${s.rank}` : 'bg-rank-other';
            const icon = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : '🎖️';
            
            honorRollCards.innerHTML += `
                <div class="col-md-2 col-6">
                    <div class="honor-card ${rankClass} animate__animated animate__zoomIn">
                        <div class="rank-badge ${badgeClass}">${s.rank}</div>
                        <div class="fw-bold text-truncate" style="font-size: 0.85rem;" title="${s.name}">${s.name}</div>
                        <div class="text-muted" style="font-size: 0.7rem;">${s.sex} | ${s.avg}</div>
                        <div class="mt-2 text-pink-primary fw-bold">${icon} ${s.grade}</div>
                    </div>
                </div>
            `;
        });
    }

    window.deleteStudentScores = async function(id) {
        const student = allStudents.find(s => s.id === id);
        if (!student) return;

        const result = await Swal.fire({
            title: 'តើអ្នកច្បាស់ទេ?',
            text: `តើអ្នកចង់លុបពិន្ទុរបស់សិស្ស ${student.englishLastName || ''} ចេញពីប្រព័ន្ធមែនទេ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'បាទ លុបចោល!',
            cancelButtonText: 'បោះបង់'
        });

        if (result.isConfirmed) {
            try {
                if (currentPeriod === 'monthly') {
                    const month = monthSelect.value;
                    if (!month) {
                        Swal.fire('Warning', 'សូមជ្រើសរើសខែមុននឹងលុប!', 'warning');
                        return;
                    }
                    await firebase.database().ref(`students/${id}/monthlyScores/${month}`).remove();
                } else {
                    await firebase.database().ref(`students/${id}/${currentPeriod}`).remove();
                }
                Swal.fire('ជោគជ័យ!', 'ពិន្ទុត្រូវបានលុបចេញពីប្រព័ន្ធ។', 'success');
                // Refresh data
                const teacherSelect = document.getElementById('teacherSelect');
                renderTeacherStudents(teacherSelect.value);
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    };

    window.saveSingleRow = function(sid) {
        const row = Array.from(studentScoreTableBody.querySelectorAll('tr')).find(tr => {
            const input = tr.querySelector('.score-input');
            return input && input.getAttribute('data-sid') === sid;
        });
        if (!row) return;

        const inputs = row.querySelectorAll('.score-input');
        const updates = {};
        
        if (currentPeriod === 'monthly') {
            const selectedMonth = monthSelect.value;
            if (!selectedMonth) { Swal.fire('Warning', 'សូមជ្រើសរើសខែ', 'warning'); return; }
            
            const data = {};
            inputs.forEach(i => { data[i.dataset.key] = parseFloat(i.value) || 0; });
            data.updatedAt = firebase.database.ServerValue.TIMESTAMP;
            data.teacher = currentTeacherName;
            updates[`/students/${sid}/monthlyScores/${selectedMonth}`] = data;
        } else {
            const data = {};
            inputs.forEach(i => { data[i.dataset.key] = parseFloat(i.value) || 0; });
            data.updatedAt = firebase.database.ServerValue.TIMESTAMP;
            data.teacher = currentTeacherName;
            updates[`/students/${sid}/${currentPeriod}`] = data;
        }

        firebase.database().ref().update(updates)
            .then(() => Swal.fire({ icon: 'success', title: 'Saved!', timer: 800, showConfirmButton: false }))
            .catch(e => Swal.fire('Error', e.message, 'error'));
    };

    window.saveSelectedScores = function() {
        const selectedChecks = Array.from(document.querySelectorAll('.student-checkbox:checked'));
        if (selectedChecks.length === 0) { Swal.fire('Notice', 'សូមជ្រើសរើសសិស្សយ៉ាងហោចម្នាក់!', 'info'); return; }

        const updates = {};
        let hasError = false;

        selectedChecks.forEach(check => {
            const sid = check.dataset.sid;
            const row = check.closest('tr');
            const inputs = row.querySelectorAll('.score-input');
            
            if (currentPeriod === 'monthly') {
                const selectedMonth = monthSelect.value;
                if (!selectedMonth) { hasError = true; return; }
                const data = {};
                inputs.forEach(i => { data[i.dataset.key] = parseFloat(i.value) || 0; });
                data.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                data.teacher = currentTeacherName;
                updates[`/students/${sid}/monthlyScores/${selectedMonth}`] = data;
            } else {
                const data = {};
                inputs.forEach(i => { data[i.dataset.key] = parseFloat(i.value) || 0; });
                data.updatedAt = firebase.database.ServerValue.TIMESTAMP;
                data.teacher = currentTeacherName;
                updates[`/students/${sid}/${currentPeriod}`] = data;
            }
        });

        if (hasError) { Swal.fire('Warning', 'សូមជ្រើសរើសខែមករា!', 'warning'); return; }

        Swal.fire({ title: 'Saving...', didOpen: () => Swal.showLoading() });
        firebase.database().ref().update(updates)
            .then(() => Swal.fire({ icon: 'success', title: 'Bulk Saved!', timer: 1000, showConfirmButton: false }))
            .catch(e => Swal.fire('Error', e.message, 'error'));
    };

    window.saveScores = function() {
        const rows = Array.from(studentScoreTableBody.querySelectorAll('tr'));
        const updates = {};
        
        rows.forEach(tr => {
            const inputs = tr.querySelectorAll('.score-input');
            const studentId = inputs[0].getAttribute('data-sid');
            
            if (currentPeriod === 'monthly') {
                const selectedMonth = monthSelect.value;
                if (!selectedMonth) {
                    Swal.fire({ icon: 'warning', title: 'សូមជ្រើសរើសខែ', text: 'សូមជ្រើសរើសខែមុននឹងរក្សាទុកពិន្ទុ!' });
                    return;
                }

                const attendance  = parseFloat(inputs[0].value) || 0;
                const homework    = parseFloat(inputs[1].value) || 0;
                const discipline  = parseFloat(inputs[2].value) || 0;
                const actionClass = parseFloat(inputs[3].value) || 0;
                const book        = parseFloat(inputs[4].value) || 0;
                const exam        = parseFloat(inputs[5].value) || 0;
                
                updates[`/students/${studentId}/monthlyScores/${selectedMonth}`] = {
                    attendance, homework, discipline, actionClass, book, exam,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    teacher: currentTeacherName
                };
            } else {
                const monthlyAvg = parseFloat(inputs[0].value) || 0;
                const exam = parseFloat(inputs[1].value) || 0;
                
                updates[`/students/${studentId}/${currentPeriod}`] = {
                    monthlyAvg, exam,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    teacher: currentTeacherName
                };
            }
        });

        Swal.fire({
            title: 'កំពុងរក្សាទុក...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        firebase.database().ref().update(updates)
            .then(() => {
                Swal.fire({ icon: 'success', title: 'រក្សាទុកជោគជ័យ', timer: 1500, showConfirmButton: false });
            })
            .catch(error => {
                Swal.fire({ icon: 'error', title: 'កំហុស', text: error.message });
            });
    };
});
