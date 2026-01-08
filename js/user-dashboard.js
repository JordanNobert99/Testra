import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Sample notifications data (will be replaced with Firestore)
let notifications = [];

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

                // Initialize notifications
                initializeNotifications(user.uid);

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

// Initialize notifications system
function initializeNotifications(userId) {
    const notificationsBtn = document.getElementById('notificationsBtn');
    
    // Create notifications dropdown
    createNotificationsDropdown();
    
    // Update badge count
    updateNotificationBadge();
    
    // Listen for real-time notifications from Firestore
    listenForNotifications(userId);
    
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

// Listen for real-time notifications from Firestore
function listenForNotifications(userId) {
    console.log('📡 Setting up notification listener for:', userId);
    
    const notificationsRef = collection(db, 'notifications');

    // Limit to last 99 notifications
    const q = query(
        notificationsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(250)
    );
    
    onSnapshot(q, (snapshot) => {
        console.log('📩 Notification snapshot received:', snapshot.size, 'documents');
        
        notifications = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data.type || 'info',
                title: data.title,
                message: data.message,
                time: formatTimestamp(data.createdAt),
                read: data.read || false
            };
        });
        
        console.log('✅ Total notifications loaded:', notifications.length);
        console.log('🔴 Unread count:', notifications.filter(n => !n.read).length);
        
        // Update UI
        createNotificationsDropdown();
        updateNotificationBadge();
    }, (error) => {
        console.error('❌ Error listening to notifications:', error);
        
        // Check if it's an index error
        if (error.message.includes('index')) {
            console.warn('⚠️ Index not ready yet. Please wait or create the index.');
            console.warn('📋 Index needed: Collection: notifications, Fields: userId (Ascending), createdAt (Descending)');
        }
        
        // Show empty state on error
        notifications = [];
        createNotificationsDropdown();
        updateNotificationBadge();
    });
}

// Format Firestore timestamp to relative time
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Just now';
    
    try {
        const now = new Date();
        const notificationDate = timestamp.toDate();
        const diffMs = now - notificationDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return notificationDate.toLocaleDateString();
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'Recently';
    }
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
    console.log('🎨 Dropdown UI updated with', notifications.length, 'notifications');
}

// Render notification items
function renderNotifications() {
    return notifications.map(notification => `
        <div class="notification-item ${!notification.read ? 'unread' : ''}" onclick="handleNotificationClick('${notification.id}')">
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
        // Display "99+" if count exceeds 99, otherwise show actual count
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
        console.log('🔢 Badge updated:', unreadCount, '(displaying:', badge.textContent, ')');
    }
}

// Handle notification click
window.handleNotificationClick = async function(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        // Mark as read in Firestore
        try {
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true,
                readAt: new Date()
            });
            console.log('✅ Marked notification as read:', notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Update locally on error
            notification.read = true;
            createNotificationsDropdown();
            updateNotificationBadge();
        }
    }
    
    // Navigate based on notification type
    console.log('Notification clicked:', notificationId);
    // Add navigation logic here
};

// Mark all notifications as read
window.markAllAsRead = async function(event) {
    event.preventDefault();
    
    const unreadNotifications = notifications.filter(n => !n.read);
    
    if (unreadNotifications.length === 0) return;
    
    try {
        const batch = writeBatch(db);
        
        unreadNotifications.forEach(notification => {
            const notificationRef = doc(db, 'notifications', notification.id);
            batch.update(notificationRef, {
                read: true,
                readAt: new Date()
            });
        });
        
        await batch.commit();
        console.log('✅ All notifications marked as read');
    } catch (error) {
        console.error('Error marking all as read:', error);
        // Update locally on error
        notifications.forEach(n => n.read = true);
        createNotificationsDropdown();
        updateNotificationBadge();
    }
};

// View all notifications
window.viewAllNotifications = function(event) {
    event.preventDefault();
    document.querySelector('.notifications-dropdown').classList.remove('show');
    // Navigate to notifications page
    console.log('View all notifications');
};