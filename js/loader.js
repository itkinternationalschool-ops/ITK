
document.addEventListener("DOMContentLoaded", function () {
    // Ensure loader exists
    if (!document.getElementById('global-loader')) {
        const loaderHTML = `
        <div id="global-loader">
            <div class="loader-logo-container">
                <img src="img/logo.jpg" alt="Loading..." class="loader-logo">
                <div class="loader-ring"></div>
            </div>
            <p class="loader-text">កំពុងដំណើរការ</p>
        </div>`;
        document.body.insertAdjacentHTML('afterbegin', loaderHTML);
    }
});

window.addEventListener('load', function () {
    const loader = document.getElementById('global-loader');
    if (loader) {
        // Minimum loading time to show off the animation (optional, e.g. 500ms)
        setTimeout(() => {
            loader.classList.add('hidden');

            // Remove from DOM after transition to free up memory
            setTimeout(() => {
                loader.style.display = 'none';
            }, 600); // Matches CSS transition duration
        }, 800);
    }
});

// Fallback to remove loader if something hangs
setTimeout(() => {
    const loader = document.getElementById('global-loader');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
    }
}, 5000);
