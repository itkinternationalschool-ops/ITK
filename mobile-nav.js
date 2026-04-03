/**
 * Mobile Navigation Handler
 * Handles sidebar toggle and overlay functionality for mobile devices
 */

(function () {
    'use strict';

    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }

    function initMobileNav() {
        // Create mobile top bar if it doesn't exist
        createMobileTopBar();

        // Create sidebar overlay if it doesn't exist
        createSidebarOverlay();

        // Initialize event listeners
        initEventListeners();
    }

    function createMobileTopBar() {
        // Check if mobile top bar already exists
        if (document.getElementById('mobile-top-bar')) {
            return;
        }

        const body = document.body;
        const sidebar = document.getElementById('sidebar');

        if (!sidebar) {
            console.warn('Sidebar not found, skipping mobile top bar creation');
            return;
        }

        // Get school name from sidebar or use default
        const sidebarHeader = sidebar.querySelector('.sidebar-header');
        let schoolName = 'ប្រព័ន្ធគ្រប់គ្រងសាលា';
        if (sidebarHeader) {
            const headerText = sidebarHeader.textContent.trim();
            if (headerText) {
                schoolName = headerText;
            }
        }

        // Create mobile top bar
        const mobileTopBar = document.createElement('div');
        mobileTopBar.id = 'mobile-top-bar';
        mobileTopBar.innerHTML = `
            <button class="mobile-toggle-btn" id="mobile-menu-toggle" aria-label="Toggle Menu">
                <i class="fi fi-rr-menu-burger"></i>
            </button>
            <div class="mobile-brand">${schoolName}</div>
        `;

        // Insert at the beginning of body
        body.insertBefore(mobileTopBar, body.firstChild);
    }

    function createSidebarOverlay() {
        // Check if overlay already exists
        if (document.getElementById('sidebar-overlay')) {
            return;
        }

        const sidebar = document.getElementById('sidebar');
        if (!sidebar) {
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';

        // Insert after sidebar
        sidebar.parentNode.insertBefore(overlay, sidebar.nextSibling);
    }

    function initEventListeners() {
        const toggleBtn = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (!toggleBtn || !sidebar || !overlay) {
            return;
        }

        // Toggle sidebar on button click
        toggleBtn.addEventListener('click', function () {
            sidebar.classList.toggle('show');
        });

        // Close sidebar when clicking overlay
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('show');
        });

        // Close sidebar when clicking a nav link (mobile only)
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(function (link) {
            link.addEventListener('click', function () {
                // Only close on mobile
                if (window.innerWidth <= 991.98) {
                    sidebar.classList.remove('show');
                }
            });
        });

        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                // Close sidebar if window is resized to desktop
                if (window.innerWidth > 991.98) {
                    sidebar.classList.remove('show');
                }
            }, 250);
        });

        // Prevent body scroll when sidebar is open on mobile
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.attributeName === 'class') {
                    if (sidebar.classList.contains('show') && window.innerWidth <= 991.98) {
                        document.body.style.overflow = 'hidden';
                    } else {
                        document.body.style.overflow = '';
                    }
                }
            });
        });

        observer.observe(sidebar, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
})();
