        // Activate tab switching
        document.addEventListener('DOMContentLoaded', function() {
            var navLinks = [].slice.call(document.querySelectorAll('.nav-link'));
            navLinks.forEach(function(link) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    var tab = new bootstrap.Tab(link);
                    tab.show();
                });
            });
        });