/**
 * Mobile Navigation Handler
 * Handles sidebar toggle and overlay functionality for mobile devices
 */

(function () {
    'use strict';

    // Expose to window
    window.initMobileNav = initMobileNav;

    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }

    // Also listen for dynamic sidebar loading
    document.addEventListener('sidebarLoaded', initMobileNav);

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
            // Sidebar might not be loaded yet
            return;
        }

        // Get school name from sidebar or use default
        const sidebarHeader = sidebar.querySelector('.sidebar-header');
        let schoolName = 'សាលាអន្តរជាតិ អាយធី ឃេ';
        if (sidebarHeader) {
            const headerText = sidebarHeader.querySelector('.sidebar-title-text'); // specific selector
            if (headerText) {
                schoolName = headerText.textContent.trim();
            } else {
                schoolName = sidebarHeader.textContent.trim();
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

        // Remove old listeners to avoid duplicates if re-initialized?
        // Ideally we should check if listener attached. 
        // Cloning node is a hacky way to remove listeners. 
        // Let's just rely on idempotent creation of elements. 
        // If elements exist, we return. But listeners on them?
        // createMobileTopBar returns if exists, but we need to re-attach listeners if the button was re-created?
        // No, if button exists, we assume listener exists. 
        // But if sidebar was replaced, we might need to re-attach listeners to sidebar links.

        // Re-attaching to toggleBtn is fine if it wasn't replaced.
        // But to be safe, we can use a flag or just replace the button.

        // Let's assume this is fine for now.

        // Update: use onclick to avoid multiple event listeners piling up
        toggleBtn.onclick = function () {
            sidebar.classList.toggle('show');
        };

        // Close sidebar when clicking overlay
        overlay.onclick = function () {
            sidebar.classList.remove('show');
        };

        // Close sidebar when clicking a nav link (mobile only)
        const navLinks = sidebar.querySelectorAll('.nav-link');
        navLinks.forEach(function (link) {
            link.onclick = function () {
                // Only close on mobile
                if (window.innerWidth <= 991.98) {
                    sidebar.classList.remove('show');
                }
            };
        });

        // Handle window resize
        let resizeTimer;
        window.onresize = function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                // Close sidebar if window is resized to desktop
                if (window.innerWidth > 991.98) {
                    sidebar.classList.remove('show');
                }
            }, 250);
        };

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
