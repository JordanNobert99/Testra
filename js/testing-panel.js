import { db } from './firebase-config.js';
import { collection, query, where, addDoc, getDocs, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUserId = null;

// Initialize the Testing Panel
export function initializeTestingPanel(userId) {
    console.log('?? Initializing Testing Panel for user:', userId);
    currentUserId = userId;
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial stats
    loadNotificationStats();
}

// Setup all event listeners
function setupEventListeners() {
    // Form submission
    const form = document.getElementById('createNotificationForm');
    if (form) {
        form.addEventListener('submit', handleCreateNotification);
    }
}

// Handle create notification form submission
async function handleCreateNotification(e) {
    e.preventDefault();
    
    const userId = document.getElementById('testUserId').value.trim() || currentUserId;
    const type = document.getElementById('testType').value;
    const title = document.getElementById('testTitle').value;
    const message = document.getElementById('testMessage').value;
    
    console.log('?? Creating notification for user:', userId);
    
    try {
        const docRef = await addDoc(collection(db, 'notifications'), {
            userId: userId,
            type: type,
            title: title,
            message: message,
            read: false,
            createdAt: Timestamp.now()
        });
        
        console.log('? Notification created with ID:', docRef.id);
        showSuccess('Notification created successfully!');
        
        // Reset form
        document.getElementById('testTitle').value = '';
        document.getElementById('testMessage').value = '';
        
        // Refresh stats
        loadNotificationStats();
    } catch (error) {
        console.error('? Error creating notification:', error);
        showError('Error creating notification: ' + error.message);
    }
}

// Send quick test notification
export async function sendQuickTest(type) {
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
    
    console.log(`?? Sending ${type} test notification...`);
    
    try {
        const docRef = await addDoc(collection(db, 'notifications'), {
            userId: currentUserId,
            type: type,
            title: messages[type].title,
            message: messages[type].message,
            read: false,
            createdAt: Timestamp.now()
        });
        
        console.log(`? ${type} test notification created:`, docRef.id);
        loadNotificationStats();
    } catch (error) {
        console.error('? Error sending test notification:', error);
        showError('Error: ' + error.message);
    }
}

// Send bulk test notifications
export async function sendBulkTest() {
    const testNotifications = [
        { type: 'info', title: 'New Appointment', message: 'Drug test scheduled for tomorrow at 10 AM' },
        { type: 'success', title: 'Payment Received', message: 'Invoice #2024-001 has been paid' },
        { type: 'warning', title: 'Low Inventory', message: '10-panel drug tests running low' },
        { type: 'info', title: 'Quote Request', message: 'New website design quote request received' },
        { type: 'success', title: 'Project Complete', message: 'Website deployment completed successfully' }
    ];
    
    console.log('?? Sending 5 bulk test notifications...');
    
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
        
        console.log('? 5 test notifications created!');
        showSuccess('5 test notifications created!');
        loadNotificationStats();
    } catch (error) {
        console.error('? Error sending bulk notifications:', error);
        showError('Error: ' + error.message);
    }
}

// Load notification statistics
export async function loadNotificationStats() {
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
        
        console.log('?? Stats updated - Total:', total, 'Unread:', unread);
    } catch (error) {
        console.error('? Error loading stats:', error);
    }
}

// Delete all user's notifications
export async function deleteAllMyNotifications() {
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
        
        console.log(`? Deleted ${snapshot.size} notifications`);
        showSuccess(`Deleted ${snapshot.size} notifications`);
        loadNotificationStats();
    } catch (error) {
        console.error('? Error deleting notifications:', error);
        showError('Error: ' + error.message);
    }
}

// Show Firestore index setup instructions
export function createFirestoreIndex() {
    alert(`?? Firestore Index Setup

If you get an error about missing indexes, follow these steps:

1. Go to Firebase Console ? Firestore Database ? Indexes
2. Click "Create Index"
3. Collection ID: notifications
4. Fields to index:
   - userId (Ascending)
   - createdAt (Descending)
5. Click "Create"

Or click the link in the browser console when you get the error - Firebase will auto-generate the index for you!`);
}

// Load all users for testing
export async function loadAllUsers() {
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
                        <strong>${escapeHtml(userData.displayName || 'Unknown')}</strong>
                        <small>${escapeHtml(userData.email)}</small>
                        <span class="role-badge role-${userData.role}">${userData.role}</span>
                    </div>
                    <button class="btn-small" data-user-id="${doc.id}" data-user-name="${escapeHtml(userData.displayName)}">
                        <i class="fas fa-bell"></i> Send
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        usersList.innerHTML = html;
        
        // Attach event listeners to send buttons
        attachSendButtonListeners();
    } catch (error) {
        console.error('? Error loading users:', error);
        showError('Error loading users: ' + error.message);
    }
}

// Attach event listeners to send buttons
function attachSendButtonListeners() {
    document.querySelectorAll('.user-item .btn-small').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.getAttribute('data-user-id');
            const userName = e.currentTarget.getAttribute('data-user-name');
            sendToUser(userId, userName);
        });
    });
}

// Send notification to specific user
async function sendToUser(userId, userName) {
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
        
        showSuccess(`Notification sent to ${userName}!`);
    } catch (error) {
        console.error('? Error sending notification:', error);
        showError('Error: ' + error.message);
    }
}

// Utility Functions

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Show success message
function showSuccess(message) {
    alert('? ' + message);
}

// Show error message
function showError(message) {
    alert('? ' + message);
}