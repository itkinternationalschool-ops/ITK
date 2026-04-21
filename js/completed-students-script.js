// completed-students-script.js
// Script for managing completed/graduated students

let completedTable;
let allCompletedStudents = [];

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('Completed Students Page Loaded');
    showLoading();
    loadCompletedStudents();
});

// Show loading overlay
function showLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'flex';
        void loader.offsetWidth;
        loader.classList.remove('hidden');
    }
}

// Hide loading overlay
function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => {
            if (loader.classList.contains('hidden')) {
                loader.style.display = 'none';
            }
        }, 500);
    }
}

// Load completed students from Firebase
function loadCompletedStudents() {
    const studentsRef = firebase.database().ref('students');

    studentsRef.once('value', (snapshot) => {
        allCompletedStudents = [];

        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const student = childSnapshot.val();
                const studentKey = childSnapshot.key;

                // Only include students with status 'graduated'
                if (student.status === 'graduated') {
                    allCompletedStudents.push({
                        key: studentKey,
                        ...student
                    });
                }
            });
        }

        console.log('Loaded completed students:', allCompletedStudents.length);
        updateStatistics();
        populateTable();
        hideLoading();
    }, (error) => {
        console.error('Error loading completed students:', error);
        hideLoading();
        Swal.fire({
            icon: 'error',
            title: 'កំហុស!',
            text: 'មិនអាចផ្ទុកទិន្នន័យបានទេ: ' + error.message,
            confirmButtonText: 'យល់ព្រម'
        });
    });
}

// Update statistics
function updateStatistics() {
    document.getElementById('totalCompleted').textContent = allCompletedStudents.length;
}

// Populate table with completed students
function populateTable() {
    const tbody = document.getElementById('completedTableBody');
    tbody.innerHTML = '';

    if (allCompletedStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center text-muted py-4">
                    <i class="fi fi-rr-info fs-1 mb-2"></i>
                    <p class="mb-0">មិនមានសិស្សដែលបានបញ្ចប់ការសិក្សាទេ</p>
                </td>
            </tr>
        `;

        // Initialize empty DataTable
        if (completedTable) {
            completedTable.destroy();
        }
        return;
    }

    allCompletedStudents.forEach((student, index) => {
        const row = document.createElement('tr');

        // Get phone number
        const phoneNumber = student.fatherPhone || student.motherPhone || student.personalPhone || 'N/A';

        let fullNameKhmer = (student.lastName || '') + ' ' + (student.firstName || '');
        if (!student.lastName && !student.firstName) fullNameKhmer = 'N/A';

        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${student.displayId || 'N/A'}</strong></td>
            <td><strong>${fullNameKhmer}</strong></td>
            <td>${student.gender || 'N/A'}</td>
            <td>${student.studyLevel || 'N/A'}</td>
            <td>${student.subject || 'N/A'}</td>
            <td>${student.studyTime || 'N/A'}</td>
            <td>${student.teacherName || 'N/A'}</td>
            <td>${phoneNumber}</td>
            <td>${student.endDate || 'N/A'}</td>
            <td><span class="badge-completed">បញ្ចប់ការសិក្សា</span></td>
            <td>
                <div class="action-buttons-table">
                    <button class="btn btn-warning btn-sm text-white" onclick="reenrollStudent('${student.key}')" 
                            title="ចុះឈ្មោះចូលរៀនឡើងវិញ">
                        <i class="fi fi-rr-refresh"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="viewStudent('${student.key}')" 
                            title="មើលព័ត៌មាន">
                        <i class="fi fi-rr-eye"></i>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Initialize or reinitialize DataTable
    if (completedTable) {
        completedTable.destroy();
    }

    completedTable = $('#completedTable').DataTable({
        language: {
            processing: "ដំណើរការ...",
            search: "ស្វែងរក:",
            lengthMenu: "បង្ហាញ _MENU_ ទិន្នន័យ",
            info: "បង្ហាញ _START_ ដល់ _END_ នៃ _TOTAL_ ទិន្នន័យ",
            infoEmpty: "បង្ហាញ 0 ដល់ 0 នៃ 0 ទិន្នន័យ",
            infoFiltered: "(ត្រងចេញពី _MAX_ ទិន្នន័យសរុប)",
            infoPostFix: "",
            loadingRecords: "កំពុងផ្ទុក...",
            zeroRecords: "មិនមានទិន្នន័យ",
            emptyTable: "មិនមានទិន្នន័យនៅក្នុងតារាងនេះទេ",
            paginate: {
                first: "ដំបូង",
                previous: "មុន",
                next: "បន្ទាប់",
                last: "ចុងក្រោយ"
            },
            aria: {
                sortAscending: ": ធ្វើឱ្យសកម្មដើម្បីតម្រៀបជួរឈរតាមលំដាប់ឡើង",
                sortDescending: ": ធ្វើឱ្យសកម្មដើម្បីតម្រៀបជួរឈរតាមលំដាប់ចុះ"
            }
        },
        pageLength: 25,
        order: [[1, 'asc']], // Sort by student ID
        responsive: true,
        autoWidth: false
    });
}

// Re-enroll student (change status from graduated to active)
function reenrollStudent(studentKey) {
    Swal.fire({
        title: 'តើអ្នកប្រាកដទេ?',
        text: 'តើអ្នកចង់ដាក់សិស្សនេះឱ្យត្រឡប់មកសិក្សាវិញមែនទេ? (Active)',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ffc107',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fi fi-rr-check"></i> បាទ/ចាស',
        cancelButtonText: '<i class="fi fi-rr-cross"></i> បោះបង់'
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading();

            // Update student status to 'active'
            // We might also want to clear endDate? user choice. For now keeping it or we can clear it.
            // Let's clear endDate so it doesn't auto-complete again immediately if logic is present.
            firebase.database().ref('students/' + studentKey).update({
                status: 'active',
                endDate: null
            })
                .then(() => {
                    hideLoading();
                    Swal.fire({
                        icon: 'success',
                        title: 'ជោគជ័យ!',
                        text: 'សិស្សត្រូវបានដាក់ឱ្យដំណើរការវិញ។',
                        confirmButtonText: 'យល់ព្រម',
                        timer: 2000
                    });

                    // Reload the data
                    loadCompletedStudents();
                })
                .catch((error) => {
                    hideLoading();
                    console.error('Error re-enrolling student:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'កំហុស!',
                        text: 'មិនអាចធ្វើប្រតិបត្តិការបានទេ: ' + error.message,
                        confirmButtonText: 'យល់ព្រម'
                    });
                });
        }
    });
}

// View student details
function viewStudent(studentKey) {
    const student = allCompletedStudents.find(s => s.key === studentKey);

    if (!student) {
        Swal.fire({
            icon: 'error',
            title: 'កំហុស!',
            text: 'រកមិនឃើញព័ត៌មានសិស្ស',
            confirmButtonText: 'យល់ព្រម'
        });
        return;
    }

    let fullNameKhmer = (student.lastName || '') + ' ' + (student.firstName || '');
    let fullNameEnglish = (student.englishLastName || '') + ' ' + (student.englishFirstName || '');

    // Create detailed student information HTML
    const studentInfo = `
        <div class="text-start">
            <h5 class="border-bottom pb-2 mb-3"><i class="fi fi-rr-user text-primary"></i> ព័ត៌មានផ្ទាល់ខ្លួន</h5>
            <p><strong>អត្តលេខ:</strong> ${student.displayId || 'N/A'}</p>
            <p><strong>ឈ្មោះខ្មែរ:</strong> ${fullNameKhmer}</p>
            <p><strong>ឈ្មោះអង់គ្លេស:</strong> ${fullNameEnglish}</p>
            <p><strong>ភេទ:</strong> ${student.gender || 'N/A'}</p>
            <p><strong>ថ្ងៃខែឆ្នាំកំណើត:</strong> ${student.dob || 'N/A'}</p>
            <p><strong>អាសយដ្ឋាន:</strong> ${student.address || student.studentAddress || 'N/A'}</p>
            
            <h5 class="border-bottom pb-2 mb-3 mt-4"><i class="fi fi-rr-graduation-cap text-success"></i> ព័ត៌មានសិក្សា</h5>
            <p><strong>ថ្នាក់រៀន:</strong> ${student.studyLevel || 'N/A'}</p>
            <p><strong>មុខវិជ្ជា:</strong> ${student.subject || 'N/A'}</p>
            <p><strong>ម៉ោងសិក្សា:</strong> ${student.studyTime || 'N/A'}</p>
            <p><strong>គ្រូបង្រៀន:</strong> ${student.teacherName || 'N/A'}</p>
            <p><strong>ជំនាន់:</strong> ${student.generation || 'N/A'}</p>
            
            <h5 class="border-bottom pb-2 mb-3 mt-4"><i class="fi fi-rr-users text-warning"></i> ព័ត៌មានអាណាព្យាបាល</h5>
            <div class="row">
                <div class="col-md-6">
                    <p class="fw-bold text-primary">ឪពុក:</p>
                    <p><strong>ឈ្មោះ:</strong> ${student.fatherName || 'N/A'}</p>
                    <p><strong>មុខរបរ:</strong> ${student.fatherJob || 'N/A'}</p>
                    <p><strong>លេខទូរស័ព្ទ:</strong> ${student.fatherPhone || 'N/A'}</p>
                </div>
                <div class="col-md-6">
                    <p class="fw-bold text-danger">ម្តាយ:</p>
                    <p><strong>ឈ្មោះ:</strong> ${student.motherName || 'N/A'}</p>
                    <p><strong>មុខរបរ:</strong> ${student.motherJob || 'N/A'}</p>
                    <p><strong>លេខទូរស័ព្ទ:</strong> ${student.motherPhone || 'N/A'}</p>
                </div>
            </div>
            
            <h5 class="border-bottom pb-2 mb-3 mt-4"><i class="fi fi-rr-check-circle text-success"></i> ស្ថានភាព</h5>
            <p><span class="badge-completed">បានបញ្ចប់ការសិក្សានៅថ្ងៃ: ${student.endDate || 'N/A'}</span></p>
        </div>
    `;

    Swal.fire({
        title: 'ព័ត៌មានលម្អិតសិស្ស',
        html: studentInfo,
        width: '800px',
        confirmButtonText: 'បិទ',
        showCancelButton: true,
        cancelButtonText: '<i class="fi fi-rr-refresh"></i> ចូលរៀនវិញ',
        cancelButtonColor: '#ffc107',
        confirmButtonColor: '#6c757d'
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
            reenrollStudent(studentKey);
        }
    });
}

// Handle logout
function handleLogout(event) {
    event.preventDefault();

    Swal.fire({
        title: 'តើអ្នកប្រាកដទេ?',
        text: 'តើអ្នកចង់ចាកចេញពីប្រព័ន្ធមែនទេ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'បាទ/ចាស ចាកចេញ',
        cancelButtonText: 'បោះបង់'
    }).then((result) => {
        if (result.isConfirmed) {
            firebase.auth().signOut().then(() => {
                window.location.href = 'login.html';
            }).catch((error) => {
                console.error('Logout error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'កំហុស!',
                    text: 'មិនអាចចាកចេញបានទេ',
                    confirmButtonText: 'យល់ព្រម'
                });
            });
        }
    });
}
