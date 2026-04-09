

function navigateTo(targetId) {
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => page.classList.add('hidden'));

    const targetPage = document.getElementById(targetId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        console.error("Screen not found: " + targetId);
    }
}

// 2. Wait for the DOM to load to attach click listeners to swatches
document.addEventListener('DOMContentLoaded', () => {
    const swatches = document.querySelectorAll('.bg-swatch');

    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            // Get the CSS string from the data-css attribute
            const newStyle = swatch.getAttribute('data-css');

            // Apply it to the body
            // We use cssText because it handles the complex gradient strings perfectly
            document.body.style.cssText = newStyle;

            // Save it to localStorage
            localStorage.setItem('userBackground', newStyle);
            
            console.log("New background saved!");
        });
    });
});// 1. Load the background immediately when the script runs
// This prevents the "flash" of the default background on refresh
const savedBg = localStorage.getItem('userBackground');
if (savedBg) {
    document.body.style.cssText = savedBg;
}

function navigateTo(targetId) {
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => page.classList.add('hidden'));

    const targetPage = document.getElementById(targetId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        console.error("Screen not found: " + targetId);
    }
}

// 2. Wait for the DOM to load to attach click listeners to swatches
document.addEventListener('DOMContentLoaded', () => {
    const swatches = document.querySelectorAll('.bg-swatch');

    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            // Get the CSS string from the data-css attribute
            const newStyle = swatch.getAttribute('data-css');

            // Apply it to the body
            // We use cssText because it handles the complex gradient strings perfectly
            document.body.style.cssText = newStyle;

            // Save it to localStorage
            localStorage.setItem('userBackground', newStyle);
            
            console.log("New background saved!");
        });
    });
});