import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Sample notifications data (will be replaced with Firestore later)
let notifications = [
    {
        id: 1,
        type: 'info',
        title: 'New Appointment Request',
        message: 'Drug test appointment from SureHire',
        time: '5 minutes ago',
        read: false
    },
    {
        id: 2,
        type: 'warning',
        title: 'Low Inventory Alert',
        message: '10-panel test kits below threshold',
        time: '1 hour ago',
        read: false
    },
    {
        id: 3,
        type: 'success',
        title: 'Payment Received',
        message: 'Invoice #1234 paid successfully',
        time: '2 hours ago',
        read: false
    }
];

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin dashboard loaded');
    
    // Check if user is authenticated and is admin
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                if (userData.role !== 'admin') {
                    console.log('User is not admin, redirecting...');
                    window.location.href = 'user-dashboard.html';
                    return;
                }
                
                document.getElementById('userName').textContent = userData.displayName || 'Admin';
                document.querySelector('.loading').style.display = 'none';
                
                // Initialize notifications
                initializeNotifications();
                
                console.log('Admin dashboard ready for:', userData.displayName);
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
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const page = item.dataset.page;
            
            const titles = {
                'overview': 'Dashboard Overview',
                'calendar': 'Calendar',
                'appointments': 'Appointments',
                'quotes': 'Quotes',
                'clients': 'Clients',
                'companies': 'Companies',
                'inventory': 'Inventory',
                'invoices': 'Invoices',
                'email': 'Email',
                'reports': 'Reports',
                'settings': 'Settings'
            };
            
            document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
            loadPage(page);
        });
    });
    
    function loadPage(page) {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="page-placeholder">
                <i class="fas fa-tools"></i>
                <h2>${page.charAt(0).toUpperCase() + page.slice(1)} Page</h2>
                <p>This page is under construction.</p>
            </div>
        `;
    }
});

// Initialize notifications system
function initializeNotifications() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const badge = notificationsBtn.querySelector('.badge');
    
    // Create notifications dropdown
    createNotificationsDropdown();
    
    // Update badge count
    updateNotificationBadge();
    
    // Toggle dropdown on click
    notificationsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.querySelector('.notifications-dropdown');
        dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.querySelector('.notifications-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// Create notifications dropdown HTML
function createNotificationsDropdown() {
    const existingDropdown = document.querySelector('.notifications-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }
    
    const dropdown = document.createElement('div');
    dropdown.className = 'notifications-dropdown';
    
    const unreadCount = notifications.filter(n => !n.read).length;
    
    dropdown.innerHTML = `
        <div class="notifications-header">
            <h3>Notifications</h3>
            ${unreadCount > 0 ? '<a href="#" class="mark-all-read" onclick="markAllAsRead(event)">Mark all as read</a>' : ''}
        </div>
        <div class="notifications-list">
            ${notifications.length > 0 ? renderNotifications() : '<div class="notifications-empty"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>'}
        </div>
        <div class="notifications-footer">
            <a href="#" class="view-all-notifications" onclick="viewAllNotifications(event)">View all notifications</a>
        </div>
    `;
    
    document.querySelector('.topbar').appendChild(dropdown);
}

// Render notification items
function renderNotifications() {
    return notifications.map(notification => `
        <div class="notification-item ${!notification.read ? 'unread' : ''}" onclick="handleNotificationClick(${notification.id})">
            <div class="notification-icon ${notification.type}">
                <i class="fas fa-${getIconForType(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${notification.time}</div>
            </div>
            ${!notification.read ? '<div class="notification-badge"></div>' : ''}
        </div>
    `).join('');
}

// Get icon based on notification type
function getIconForType(type) {
    const icons = {
        'info': 'info-circle',
        'success': 'check-circle',
        'warning': 'exclamation-triangle',
        'error': 'exclamation-circle'
    };
    return icons[type] || 'bell';
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.querySelector('#notificationsBtn .badge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

// Handle notification click
window.handleNotificationClick = function(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        createNotificationsDropdown();
        updateNotificationBadge();
    }
    
    // Navigate based on notification type
    console.log('Notification clicked:', notificationId);
    // Add navigation logic here
};

// Mark all notifications as read
window.markAllAsRead = function(event) {
    event.preventDefault();
    notifications.forEach(n => n.read = true);
    createNotificationsDropdown();
    updateNotificationBadge();
};

// View all notifications
window.viewAllNotifications = function(event) {
    event.preventDefault();
    document.querySelector('.notifications-dropdown').classList.remove('show');
    // Navigate to notifications page
    console.log('View all notifications');
};