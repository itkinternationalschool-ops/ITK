// --- GLOBAL LOADER INJECTION (Project-Wide) ---
(function () {
  // Prevent duplicate loader
  if (document.getElementById('global-loader')) return;

  const loaderHTML = `
    <div id="global-loader">
        <div class="loader-logo-container">
            <div class="loader-ring"></div>
            <img src="img/1.jpg" onerror="this.src='img/logo.jpg'" class="loader-logo" alt="Loading...">
        </div>
        <div class="loader-text">កំពុងដំណើរការ...</div>
    </div>
    `;

  function injectLoader() {
    if (document.body && !document.getElementById('global-loader')) {
      document.body.insertAdjacentHTML('afterbegin', loaderHTML);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLoader);
  } else {
    injectLoader();
  }

  // Hide when window fully loads
  window.addEventListener('load', () => {
    const loader = document.getElementById('global-loader');
    if (loader) {
      // Minimum show time to prevent flicker
      setTimeout(() => {
        loader.classList.add('hidden');
        // Optional: Remove from DOM after transition to free memory/clicks
        setTimeout(() => {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 1000);
      }, 800);
    }
  });

  // Fallback: If window.load doesn't fire (rare), hide after 5 seconds security
  setTimeout(() => {
    const loader = document.getElementById('global-loader');
    if (loader && !loader.classList.contains('hidden')) {
      loader.classList.add('hidden');
    }
  }, 5000);
})();
// ----------------------------------------------

const usernameRef = document.getElementById("username");
const passwordRef = document.getElementById("password");
const loginForm = document.getElementById('loginForm');
const togglePassword = document.getElementById('togglePassword');

// Toggle Password Visibility
if (togglePassword) {
  togglePassword.addEventListener('click', function (e) {
    const type = passwordRef.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordRef.setAttribute('type', type);
    this.classList.toggle('fi-rr-eye-crossed');
    this.classList.toggle('fi-rr-eye');
  });
}

// Prevent Khmer Input in Password
if (passwordRef) {
  passwordRef.addEventListener('input', function (e) {
    const khmerRegex = /[\u1780-\u17FF\u19E0-\u19FF]/g;
    if (khmerRegex.test(this.value)) {
      this.value = this.value.replace(khmerRegex, '');
      // Shake animation
      this.parentElement.style.animation = "shake 0.5s ease";
      setTimeout(() => { this.parentElement.style.animation = "none"; }, 500);
      showCustomAlert("ពាក្យសម្ងាត់មិនអាចប្រើអក្សរ ឬលេខខ្មែរបានទេ!");
    }
  });
}

// Login Logic
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = usernameRef.value.trim();
    const password = passwordRef.value;

    if (!email || !password) {
      showCustomAlert("សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់!");
      return;
    }

    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn ? loginBtn.innerText : "Login";
    if (loginBtn) {
      loginBtn.innerText = "កំពុងចូល...";
      loginBtn.disabled = true;
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        console.log("Logged in:", userCredential.user);
        window.location.href = "index.html";
      })
      .catch((error) => {
        console.error("Login error:", error);
        let errorMessage = "មានបញ្ហាកក្នុងការចូលប្រើប្រាស់។";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
          errorMessage = "អ៊ីមែល ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវ!";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ!";
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = "ការព្យាយាមចូលច្រើនដងពេក។ សូមរង់ចាំមួយសន្ទុះ!";
        } else {
          errorMessage = "មានបញ្ហាកក្នុងការចូល៖ " + error.message;
        }

        showCustomAlert(errorMessage);
        if (loginBtn) {
          loginBtn.innerText = originalText;
          loginBtn.disabled = false;
        }
      });
  });
}

function showCustomAlert(message) {
  const alertBox = document.getElementById("customAlert");
  if (!alertBox) return;
  alertBox.innerText = message;
  alertBox.style.display = "block";
  setTimeout(() => {
    alertBox.style.display = "none";
  }, 3000);
}

// Check auth state
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // window.location.href = "index.html";
  }
});