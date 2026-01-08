import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, writeBatch, addDoc, getDocs, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Notifications array (populated from Firestore)
let notifications = [];
let currentUserId = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin dashboard loaded');
    
    // Check if user is authenticated and is admin
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        currentUserId = user.uid;
        console.log('✅ Current user ID:', currentUserId);
        
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
                initializeNotifications(user.uid);
                
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
                'settings': 'Settings',
                'test': 'Testing Panel'
            };
            
            document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
            loadPage(page);
        });
    });
    
    async function loadPage(page) {
        const contentArea = document.getElementById('contentArea');
        
        if (page === 'test') {
            await loadTestingPanel();
        } else {
            contentArea.innerHTML = `
                <div class="page-placeholder">
                    <i class="fas fa-tools"></i>
                    <h2>${page.charAt(0).toUpperCase() + page.slice(1)} Page</h2>
                    <p>This page is under construction.</p>
                </div>
            `;
        }
    }
});

// Initialize notifications system
function initializeNotifications(userId) {
    console.log('🔔 Initializing notifications for user:', userId);
    
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
        console.log('Dropdown toggled, notifications count:', notifications.length);
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
    
    onSnapshot(q, 
        (snapshot) => {
            console.log('📩 Notification snapshot received:', snapshot.size, 'documents');
            
            notifications = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('  - Notification:', doc.id, data.title);
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
        }, 
        (error) => {
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
        }
    );
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
                readAt: Timestamp.now()
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
                readAt: Timestamp.now()
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

// ========================================
// TESTING PANEL FUNCTIONALITY
// ========================================

async function loadTestingPanel() {
    const contentArea = document.getElementById('contentArea');
    
    try {
        // Fetch the HTML template
        const response = await fetch('pages/testing-panel.html');
        const html = await response.text();
        
        contentArea.innerHTML = html;
        
        // Attach form handler after HTML is loaded
        const form = document.getElementById('createNotificationForm');
        if (form) {
            form.addEventListener('submit', handleCreateNotification);
        }
        
        // Load initial stats
        loadNotificationStats();
        
        console.log('Testing panel loaded');
    } catch (error) {
        console.error('Error loading testing panel:', error);
        contentArea.innerHTML = `
            <div class="page-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <h2>Error Loading Testing Panel</h2>
                <p>Could not load pages/testing-panel.html</p>
            </div>
        `;
    }
}

// Handle create notification form submission
async function handleCreateNotification(e) {
    e.preventDefault();
    
    const userId = document.getElementById('testUserId').value.trim() || currentUserId;
    const type = document.getElementById('testType').value;
    const title = document.getElementById('testTitle').value;
    const message = document.getElementById('testMessage').value;
    
    console.log('📤 Creating notification for user:', userId);
    
    try {
        const docRef = await addDoc(collection(db, 'notifications'), {
            userId: userId,
            type: type,
            title: title,
            message: message,
            read: false,
            createdAt: Timestamp.now()
        });
        
        console.log('✅ Notification created with ID:', docRef.id);
        alert('✅ Notification created successfully!');
        
        // Reset form
        document.getElementById('testTitle').value = '';
        document.getElementById('testMessage').value = '';
        
        // Refresh stats
        loadNotificationStats();
    } catch (error) {
        console.error('❌ Error creating notification:', error);
        alert('❌ Error creating notification: ' + error.message);
    }
}

// Send quick test notification
window.sendQuickTest = async function(type) {
    const messages = {
        info: {
            title: 'Information Update',
            message: 'This is a test info notification from the testing panel'
        },
        success: {
            title: 'Operation Successful',
            message: 'Test success notification - everything is working correctly'
        },
        warning: {
            title: 'Warning Alert',
            message: 'Test warning notification - please review this carefully'
        },
        error: {
            title: 'Error Detected',
            message: 'Test error notification - this simulates an error condition'
        }
    };
    
    console.log(`📤 Sending ${type} test notification...`);
    
    try {
        const docRef = await addDoc(collection(db, 'notifications'), {
            userId: currentUserId,
            type: type,
            title: messages[type].title,
            message: messages[type].message,
            read: false,
            createdAt: Timestamp.now()
        });
        
        console.log(`✅ ${type} test notification created:`, docRef.id);
        loadNotificationStats();
    } catch (error) {
        console.error('❌ Error sending test notification:', error);
        alert('❌ Error: ' + error.message);
    }
};

// Send bulk test notifications
window.sendBulkTest = async function() {
    const testNotifications = [
        { type: 'info', title: 'New Appointment', message: 'Drug test scheduled for tomorrow at 10 AM' },
        { type: 'success', title: 'Payment Received', message: 'Invoice #2024-001 has been paid' },
        { type: 'warning', title: 'Low Inventory', message: '10-panel drug tests running low' },
        { type: 'info', title: 'Quote Request', message: 'New website design quote request received' },
        { type: 'success', title: 'Project Complete', message: 'Website deployment completed successfully' }
    ];
    
    console.log('📤 Sending 5 bulk test notifications...');
    
    try {
        for (const notif of testNotifications) {
            await addDoc(collection(db, 'notifications'), {
                userId: currentUserId,
                type: notif.type,
                title: notif.title,
                message: notif.message,
                read: false,
                createdAt: Timestamp.now()
            });
        }
        
        console.log('✅ 5 test notifications created!');
        alert('✅ 5 test notifications created!');
        loadNotificationStats();
    } catch (error) {
        console.error('❌ Error sending bulk notifications:', error);
        alert('❌ Error: ' + error.message);
    }
};

// Load notification statistics
window.loadNotificationStats = async function() {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId)
        );
        
        const snapshot = await getDocs(q);
        const total = snapshot.size;
        const unread = snapshot.docs.filter(doc => !doc.data().read).length;
        
        const totalEl = document.getElementById('totalNotifications');
        const unreadEl = document.getElementById('unreadNotifications');
        
        if (totalEl) totalEl.textContent = total;
        if (unreadEl) unreadEl.textContent = unread;
        
        console.log('📊 Stats updated - Total:', total, 'Unread:', unread);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
};

// Delete all user's notifications
window.deleteAllMyNotifications = async function() {
    if (!confirm('Are you sure you want to delete ALL your notifications? This cannot be undone.')) {
        return;
    }
    
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId)
        );
        
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        console.log(`✅ Deleted ${snapshot.size} notifications`);
        alert(`✅ Deleted ${snapshot.size} notifications`);
        loadNotificationStats();
    } catch (error) {
        console.error('Error deleting notifications:', error);
        alert('❌ Error: ' + error.message);
    }
};

// Show Firestore index setup instructions
window.createFirestoreIndex = function() {
    alert(`📋 Firestore Index Setup

If you get an error about missing indexes, follow these steps:

1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Collection ID: notifications
4. Fields to index:
   - userId (Ascending)
   - createdAt (Descending)
5. Click "Create"

Or click the link in the browser console when you get the error - Firebase will auto-generate the index for you!`);
};

// Load all users for testing
window.loadAllUsers = async function() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = document.getElementById('usersList');
        
        if (!usersList) return;
        
        let html = '<div class="users-list">';
        
        usersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            html += `
                <div class="user-item">
                    <div class="user-details">
                        <strong>${userData.displayName || 'Unknown'}</strong>
                        <small>${userData.email}</small>
                        <span class="role-badge role-${userData.role}">${userData.role}</span>
                    </div>
                    <button onclick="sendToUser('${doc.id}', '${userData.displayName}')" class="btn-small">
                        <i class="fas fa-bell"></i> Send
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        usersList.innerHTML = html;
    } catch (error) {
        console.error('Error loading users:', error);
        alert('❌ Error loading users: ' + error.message);
    }
};

// Send notification to specific user
window.sendToUser = async function(userId, userName) {
    const title = prompt(`Enter notification title for ${userName}:`);
    if (!title) return;
    
    const message = prompt('Enter notification message:');
    if (!message) return;
    
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: userId,
            type: 'info',
            title: title,
            message: message,
            read: false,
            createdAt: Timestamp.now()
        });
        
        alert(`✅ Notification sent to ${userName}!`);
    } catch (error) {
        console.error('Error sending notification:', error);
        alert('❌ Error: ' + error.message);
    }
};

// ========================================
// AUTO-CLEANUP: Delete old notifications
// ========================================

// Clean up old read notifications (older than 30 days)
async function cleanupOldNotifications() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUserId),
            where('read', '==', true),
            where('createdAt', '<', Timestamp.fromDate(thirtyDaysAgo))
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            console.log('No old notifications to clean up');
            return;
        }
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`🧹 Cleaned up ${snapshot.size} old notifications`);
    } catch (error) {
        console.error('Error cleaning up notifications:', error);
    }
}

// Run cleanup on dashboard load (optional - run once per day in production)
// Uncomment the line below to enable auto-cleanup
// setTimeout(cleanupOldNotifications, 5000);