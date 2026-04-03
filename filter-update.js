// Function to update active filters information
function updateActiveFiltersInfo() {
    const activeFiltersText = document.getElementById('activeFiltersText');
    if (!activeFiltersText) return;

    const activeFilters = [];

    if (currentFilter.searchText) {
        activeFilters.push(`🔍 ស្វែងរក: "${currentFilter.searchText}"`);
    }
    if (currentFilter.paymentStatus !== 'all') {
        const statusMap = {
            'paid': '✅ បង់រួច',
            'installment': '⏳ នៅជំណាក់',
            'overdue': '❌ ហួសកំណត់',
            'warning': '⚠️ ជិតដល់កំណត់',
            'pending': '📄 មិនទាន់បង់'
        };
        activeFilters.push(`💰 ${statusMap[currentFilter.paymentStatus]}`);
    }
    if (currentFilter.studyType !== 'all') {
        const typeMap = {
            'cFullTime': '🇨🇳 ចិនពេញម៉ោង',
            'cPartTime': '🇨🇳 ចិនក្រៅម៉ោង',
            'eFullTime': '🇬🇧 អង់គ្លេសពេញម៉ោង',
            'ePartTime': '🇬🇧 អង់គ្លេសក្រៅម៉ោង'
        };
        activeFilters.push(`📚 ${typeMap[currentFilter.studyType]}`);
    }
    if (currentFilter.gender !== 'all') {
        const genderMap = {
            'Male': '👨 ប្រុស',
            'Female': '👩 ស្រី'
        };
        activeFilters.push(`${genderMap[currentFilter.gender]}`);
    }
    if (currentFilter.startDate && currentFilter.endDate) {
        activeFilters.push(`📅 ${currentFilter.startDate} ដល់ ${currentFilter.endDate}`);
    }

    if (activeFilters.length > 0) {
        activeFiltersText.innerHTML = activeFilters.join(' • ');
    } else {
        activeFiltersText.textContent = 'គ្មានតម្រង់សកម្ម';
    }
}

// Add this to applyAllFilters function
function applyAllFilters() {
    if (!allStudentsData || Object.keys(allStudentsData).length === 0) {
        console.warn('No student data available for filtering');
        return;
    }

    // Apply filters
    const filteredStudents = filterStudents(allStudentsData);

    // Render filtered table
    renderFilteredTable(filteredStudents);

    // Update counts
    const totalStudents = Object.keys(allStudentsData).length;
    const filteredCount = filteredStudents.length;

    document.getElementById('filteredCount').textContent = filteredCount;
    document.getElementById('totalCount').textContent = totalStudents;

    // Show filter status
    if (hasActiveFilters()) {
        showAlert(`បានរកឃើញ ${filteredCount} នាក់ ពី ${totalStudents} នាក់សរុប`, 'info', 3000);
    }

    // Update active filters info
    updateActiveFiltersInfo();
}

// Update clearFiltersBtn to include gender
$('#clearFiltersBtn').on('click', function () {
    currentFilter = {
        searchText: '',
        paymentStatus: 'all',
        studyType: 'all',
        gender: 'all',
        startDate: null,
        endDate: null
    };

    // Reset form inputs
    $('#searchByName').val('');
    $('#clearSearchBtn').hide();
    $('#paymentStatusFilter').val('all');
    $('#studyTypeFilter').val('all');
    $('#genderFilter').val('all');
    $('#startDate').val('');
    $('#endDate').val('');

    // Reload all data
    loadStudentData();
    showAlert('បានសម្អាតចម្រាញ់ទាំងអស់', 'success');
    updateActiveFiltersInfo();
});
