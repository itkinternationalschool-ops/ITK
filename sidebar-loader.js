/**
 * sidebar-loader.js
 * Loads the sidebar dynamically without using fetch() to avoid CORS issues on file:// protocol.
 */

const SIDEBAR_HTML = `
<div id="sidebar">
    <div class="sidebar-header">
        <a href="index.html">
            <img src="img/logo.jpg" alt="School Logo" id="sidebar-logo">
        </a>
        <span class="sidebar-title-text" style="color: white; font-family: 'Khmer OS Battambang', serif;">
            ប្រព័ន្ធគ្រប់គ្រងសាលា
        </span>
    </div>

    <nav class="nav flex-column">
        <a class="nav-link" href="index.html">
            <i class="fi fi-rr-apps"></i> ផ្ទាំងគ្រប់គ្រង
        </a>
        <a class="nav-link" href="registration.html">
            <i class="fi fi-rr-user-add"></i> ការចុះឈ្មោះសិស្ស
        </a>
        <a class="nav-link" href="data-tracking.html">
            <i class="fi fi-rr-users-alt"></i> បញ្ជីទិន្នន័យសិស្ស
        </a>
        <a class="nav-link" href="income-expense.html">
            <i class="fi fi-rr-receipt"></i> ចំណូលចំណាយ
        </a>
        <a class="nav-link" href="inventory.html">
            <i class="fi fi-rr-box-alt"></i> ស្តុកសម្ភារៈ
        </a>
        <a class="nav-link" href="user-management.html">
            <i class="fi fi-rr-shield-check"></i> គ្រប់គ្រងអ្នកប្រើប្រាស់
        </a>
        <a class="nav-link" href="dropout-students.html">
            <i class="fi fi-rr-user-remove"></i> សិស្សបោះបង់ការសិក្សា
        </a>
        <a class="nav-link" href="completed-students.html">
            <i class="fi fi-rr-graduation-cap"></i> សិស្សបញ្ចប់ការសិក្សា
        </a>
        <a class="nav-link" href="teacher-scores.html">
            <i class="fi fi-rr-edit"></i> បញ្ចូលពិន្ទុប្រចាំខែ
        </a>
    </nav>

    <hr class="sidebar-divider my-2 mx-3" style="border-top: 1px solid rgba(255,255,255,0.3);">

    <!-- User Profile Section -->
    <div class="px-3 py-3 text-white border-top border-bottom border-white-10" style="background: rgba(0,0,0,0.05);">
        <div class="text-center">
            <div class="bg-white rounded-circle d-inline-flex align-items-center justify-content-center mb-2 shadow-sm"
                style="width: 50px; height: 50px;">
                <i class="fi fi-rr-user-circle text-primary fa-2x"></i>
            </div>
            <div style="font-size: 0.85rem;">
                <div class="fw-bold text-truncate mb-1" id="user-display-name" style="font-size: 1rem;">...
                </div>
                <div class="text-white-50 text-truncate mb-2" id="user-display-email" style="font-size: 0.75rem;">
                    ...</div>
                <div class="badge bg-warning text-dark fw-normal" id="user-role-badge">...</div>
            </div>
        </div>
    </div>

    <a href="#" class="nav-link text-warning mt-1" onclick="handleLogout(event)">
        <i class="fi fi-rr-sign-out-alt"></i> ចាកចេញ
    </a>
</div>
`;

document.addEventListener("DOMContentLoaded", function () {
    const existingSidebar = document.getElementById('sidebar');
    const wrapper = document.getElementById('wrapper');

    // Inject HTML
    if (existingSidebar) {
        existingSidebar.outerHTML = SIDEBAR_HTML;
    } else if (wrapper) {
        wrapper.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
    } else {
        document.body.insertAdjacentHTML('afterbegin', SIDEBAR_HTML);
    }

    // Highlight active link
    const path = window.location.pathname;
    const page = path.split("/").pop() || 'index.html';

    const links = document.querySelectorAll('#sidebar .nav-link');
    links.forEach(link => {
        const href = link.getAttribute('href');
        // Handle "index.html" mapping to root or explicit index
        if (href === page || (page === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Dispatch event saying sidebar is ready
    const event = new Event('sidebarLoaded');
    document.dispatchEvent(event);

    // Re-run mobile nav init if available
    if (window.initMobileNav) {
        window.initMobileNav();
    }
});
