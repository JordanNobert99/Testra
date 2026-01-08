import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('User dashboard loaded');

    // Check if user is authenticated
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Not logged in, redirect to login
            window.location.href = 'login.html';
            return;
        }

        // Get user data from Firestore
        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();

                // Check if user is actually a regular user (not admin)
                if (userData.role === 'admin') {
                    console.log('User is admin, redirecting...');
                    window.location.href = 'admin-dashboard.html';
                    return;
                }

                // Update UI with user info
                document.getElementById('userName').textContent = userData.displayName || 'User';

                // Hide loading state
                document.querySelector('.loading').style.display = 'none';

                console.log('User dashboard ready for:', userData.displayName);
            } else {
                console.error('User document not found');
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            window.location.href = 'login.html';
        }
    });

    // Handle logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                await signOut(auth);
                console.log('User signed out');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Please try again.');
            }
        });
    }

    // Handle mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Handle navigation
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked item
            item.classList.add('active');

            // Get page name
            const page = item.dataset.page;

            // Update page title
            const titles = {
                'home': 'Welcome Back',
                'services': 'Our Services',
                'request-quote': 'Request a Quote',
                'my-quotes': 'My Quotes',
                'my-projects': 'My Projects',
                'messages': 'Messages',
                'account': 'My Account',
                'support': 'Support'
            };

            document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

            // Load page content (we'll implement this later)
            loadPage(page);
        });
    });

    // Placeholder function to load page content
    function loadPage(page) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="page-placeholder">
                <i class="fas fa-tools"></i>
                <h2>${page.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Page</h2>
                <p>This page is under construction.</p>
            </div>
        `;
    }
});