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
                
                // Avatar Elements
                const avatarImg = document.getElementById('user-avatar-img');
                const avatarPlaceholder = document.getElementById('user-avatar-placeholder');
                const avatarContainer = document.getElementById('user-avatar-container');
                const avatarInput = document.getElementById('user-avatar-input');
                const avatarOverlay = document.getElementById('avatar-upload-overlay');

                const displayName = userData && userData.name ? userData.name : user.email.split('@')[0];

                if (nameEl) nameEl.textContent = displayName;
                if (emailEl) {
                    emailEl.textContent = user.email;
                    emailEl.title = user.email;
                }

                // Update Avatar
                if (userData && userData.avatar) {
                    if (avatarImg) {
                        avatarImg.src = userData.avatar;
                        avatarImg.style.display = 'block';
                    }
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                }

                // Setup Avatar Upload
                if (avatarContainer && avatarInput && !avatarContainer.dataset.listenerSet) {
                    avatarContainer.addEventListener('mouseover', () => {
                        if (avatarOverlay) avatarOverlay.style.display = 'flex';
                    });
                    avatarContainer.addEventListener('mouseout', () => {
                        if (avatarOverlay) avatarOverlay.style.display = 'none';
                    });
                    avatarContainer.addEventListener('click', () => avatarInput.click());
                    
                    avatarInput.addEventListener('change', async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        // Check if file size exceeds 1MB
                        if (file.size > 1 * 1024 * 1024) {
                            Swal.fire('បញ្ហាទំហំរូបភាព', 'សូមជ្រើសរើសរូបភាពដែលមានទំហំមិនលើសពី 1MB!', 'warning');
                            e.target.value = '';
                            return;
                        }

                        try {
                            // Show loading state
                            if (avatarPlaceholder) avatarPlaceholder.className = 'fi fi-rr-refresh fa-spin text-primary fa-2x';
                            
                            // 1. Compress Image (Limit to 400px for small avatars)
                            const compressedFile = await window.compressImage(file, 400, 0.7);
                            
                            // 2. Upload to Cloudflare
                            const prefix = `User_${user.email.split('@')[0]}`;
                            const avatarUrl = await window.uploadToFirebase(compressedFile, prefix);
                            
                            if (avatarUrl) {
                                // Delete old avatar from Cloudflare if it exists
                                const oldAvatar = userData ? userData.avatar : null;
                                if (oldAvatar && window.deleteFromFirebase && oldAvatar !== avatarUrl) {
                                    window.deleteFromFirebase(oldAvatar).catch(e => console.error("Failed to delete old avatar", e));
                                }

                                // Update Database
                                await firebase.database().ref('users/' + user.uid).update({ avatar: avatarUrl });
                                
                                // Update UI
                                if (avatarImg) {
                                    avatarImg.src = avatarUrl;
                                    avatarImg.style.display = 'block';
                                }
                                if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                                
                                Swal.fire({
                                    icon: 'success',
                                    title: 'អាប់ដេតជោគជ័យ',
                                    text: 'រូបភាព Profile ត្រូវបានផ្លាស់ប្តូរ!',
                                    timer: 2000,
                                    showConfirmButton: false
                                });
                            }
                        } catch (err) {
                            console.error("Avatar upload failed:", err);
                            Swal.fire('Error', 'បញ្ជូនរូបភាពមិនជោគជ័យ: ' + err.message, 'error');
                        } finally {
                            if (avatarPlaceholder && (!userData || !userData.avatar)) {
                                avatarPlaceholder.className = 'fi fi-rr-user-circle text-primary fa-2x';
                            }
                        }
                    });
                    avatarContainer.dataset.listenerSet = "true";
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
