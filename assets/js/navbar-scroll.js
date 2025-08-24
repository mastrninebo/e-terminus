// assets/js/navbar-scroll.js
document.addEventListener('DOMContentLoaded', function() {
    // Navbar scroll behavior
    const navbar = document.querySelector('.navbar');
    let lastScrollTop = 0;
    let scrollTimeout;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add shadow when scrolled
        if (scrollTop > 10) {
            navbar.classList.add('navbar-scrolled');
        } else {
            navbar.classList.remove('navbar-scrolled');
        }
        
        // Show/hide navbar based on scroll direction
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down - hide navbar
            navbar.classList.add('navbar-hidden');
        } else {
            // Scrolling up - show navbar
            navbar.classList.remove('navbar-hidden');
        }
        
        // Update last scroll position
        lastScrollTop = scrollTop;
        
        // Clear timeout if it exists
        clearTimeout(scrollTimeout);
        
        // Set timeout to show navbar after scrolling stops
        scrollTimeout = setTimeout(function() {
            navbar.classList.remove('navbar-hidden');
        }, 3000); // Show navbar after 3 seconds of inactivity
    });
});