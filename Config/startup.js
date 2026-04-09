function navigateTo(targetId) {
    // 1. Find every element that has the "page" class
    const allPages = document.querySelectorAll('.page');

    // 2. Loop through them and hide every single one
    allPages.forEach(page => {
        page.classList.add('hidden');
    });

    // 3. Find the specific page we want to see by its ID
    const targetPage = document.getElementById(targetId);

    // 4. Show that specific page
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        console.error("Screen not found: " + targetId);
    }
}