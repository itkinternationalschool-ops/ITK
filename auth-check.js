/**
 * auth-check.js
 * Protects pages from unauthorized access.
 */

// Loader logic has been moved to loader.js and explicit HTML injection

document.addEventListener("DOMContentLoaded", () => {
    // Determine if we are on the login page
    const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("login");

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            checkAutoGraduation();
            if (isLoginPage) window.location.href = "index.html";

            // Store data for re-use
            let currentFirebaseUser = user;
            let currentDbData = null;

            const isSuperAdmin = user.email === 'adminitk@gmail.com';

            // DEFINITION RESTORED
            const applyPermissions = (perms) => {
                // Admin bypass
                if (isSuperAdmin) {
                    document.querySelectorAll('.sidebar .nav-link').forEach(l => l.style.display = 'block');
                    return;
                }

                const p = perms || { dashboard: false, registration: true, data: true, inventory: false, incomeExpense: false, userManagement: false };
                const links = {
                    'index.html': p.dashboard,
                    'registration.html': p.registration,
                    'data-tracking.html': p.data,
                    'dropout-students.html': p.data,
                    'completed-students.html': p.data,
                    'inventory.html': p.inventory,
                    'income-expense.html': p.incomeExpense,
                    'user-management.html': p.userManagement
                };

                for (const [page, allowed] of Object.entries(links)) {
                    document.querySelectorAll(`a[href="${page}"]`).forEach(link => {
                        link.style.display = allowed ? '' : 'none';
                    });
                }

                // Current Page Check
                const path = window.location.pathname;
                const currentPage = path.split('/').pop() || 'index.html';
                const pagePermissionMap = {
                    'index.html': 'dashboard',
                    'registration.html': 'registration',
                    'data-tracking.html': 'data',
                    'dropout-students.html': 'data',
                    'completed-students.html': 'data',
                    'inventory.html': 'inventory',
                    'income-expense.html': 'incomeExpense',
                    'user-management.html': 'userManagement'
                };

                const requiredPerm = pagePermissionMap[currentPage];
                if (requiredPerm && requiredPerm !== 'admin_only' && !p[requiredPerm]) {
                    // Basic redirect logic if denied
                    if (p.registration) window.location.href = "registration.html";
                    else if (p.data) window.location.href = "data-tracking.html";
                    else if (p.incomeExpense) window.location.href = "income-expense.html";
                    else if (p.userManagement) window.location.href = "user-management.html";
                    else alert("គណនីរបស់អ្នកមិនមានសិទ្ធិប្រើប្រាស់ណាមួយទេ។ សូមទាក់ទង Admin។");
                }
            };

            const updateProfileUI = (user, userData) => {
                const nameEl = document.getElementById('user-display-name');
                const emailEl = document.getElementById('user-display-email');
                const roleEl = document.getElementById('user-role-badge');

                const displayName = userData && userData.name ? userData.name : user.email.split('@')[0];

                if (nameEl) nameEl.textContent = displayName;
                if (emailEl) {
                    emailEl.textContent = user.email;
                    emailEl.title = user.email;
                }

                // Update Role Badge dynamically
                if (roleEl) {
                    if (isSuperAdmin) {
                        roleEl.textContent = 'Admin (អ្នកគ្រប់គ្រង)';
                        roleEl.className = 'badge bg-warning text-dark mt-1 fw-normal';
                    } else if (userData && userData.role) {
                        const r = userData.role.toLowerCase();
                        roleEl.textContent = r.charAt(0).toUpperCase() + r.slice(1);

                        if (r === 'admin' || r === 'អ្នកគ្រប់គ្រង') {
                            roleEl.className = 'badge bg-warning text-dark mt-1 fw-normal';
                        } else {
                            roleEl.className = 'badge bg-info mt-1 fw-normal';
                        }
                    } else {
                        roleEl.textContent = 'Staff';
                        roleEl.className = 'badge bg-info mt-1 fw-normal';
                    }
                }

                // Re-apply permissions to hide/show new sidebar links
                const perms = userData ? userData.permissions : null;
                applyPermissions(perms);
            };

            // Fetch data from DB
            firebase.database().ref('users/' + user.uid).once('value').then(snapshot => {
                const userData = snapshot.val();
                currentDbData = userData;
                updateProfileUI(user, userData);
            }).catch(err => {
                console.error("Error fetching user data:", err);
                // Fallback
                updateProfileUI(user, null);
            });

            // Listen for Sidebar Reload
            document.addEventListener('sidebarLoaded', () => {
                if (currentFirebaseUser) {
                    if (currentDbData) {
                        updateProfileUI(currentFirebaseUser, currentDbData);
                    } else {
                        // Data might not be loaded yet, simpler fallback or handled by the ongoing fetch
                        const nameEl = document.getElementById('user-display-name');
                        if (nameEl && nameEl.textContent === '...') {
                            // Retry fetch or wait? The main fetch will call updateProfileUI when done.
                            // But if main fetch finished BEFORE sidebar loaded, we satisfy here.
                        }
                    }
                }
            });

        } else {
            console.warn("User not authenticated.");
            if (!isLoginPage) window.location.href = "login.html";
        }
    });
});

function checkAutoGraduation() {
    const today = new Date().toISOString().split('T')[0];
    const db = firebase.database();
    db.ref('students').once('value', snapshot => {
        if (!snapshot.exists()) return;
        snapshot.forEach(child => {
            const s = child.val();
            if (s.status !== 'graduated' && s.endDate && s.endDate <= today) {
                console.log(`Auto-graduating ${s.displayId}`);
                db.ref(`students/${child.key}`).update({ status: 'graduated' });
            }
        });
    });
}

/**
 * Handle Logout
 * Signs out the updated user and redirects to login page.
 */
function handleLogout(event) {
    if (event) event.preventDefault();

    if (confirm("តើអ្នកពិតជាចង់ចាកចេញមែនទេ?")) {
        firebase.auth().signOut().then(() => {
            console.log("User signed out.");
            window.location.href = "login.html";
        }).catch((error) => {
            console.error("Logout Error:", error);
            alert("មានបញ្ហាក្នុងការចាកចេញ។");
        });
    }
}
