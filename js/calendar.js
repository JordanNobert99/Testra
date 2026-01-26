import { db } from './firebase-config.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let appointmentsData = [];
let companiesData = [];
let currentAppointmentId = null;
let currentDate = new Date();

// Initialize the Calendar page
export function initializeCalendarPage() {
    console.log('📅 Initializing Calendar page...');

    // Load companies for dropdown
    loadCompanies();

    // Load appointments data
    loadAppointments();

    // Setup event listeners
    setupEventListeners();

    // Render initial calendar
    renderCalendar();
}

// Setup all event listeners
function setupEventListeners() {
    console.log('⚙️ Setting up calendar event listeners...');

    // Modal controls
    const addAppointmentBtn = document.getElementById('addAppointmentBtn');
    const appointmentModal = document.getElementById('appointmentModal');
    const deleteAppointmentModal = document.getElementById('deleteAppointmentModal');
    const closeAppointmentModal = document.getElementById('closeAppointmentModal');
    const closeDeleteAppointmentModal = document.getElementById('closeDeleteAppointmentModal');
    const cancelAppointmentBtn = document.getElementById('cancelAppointmentBtn');
    const cancelDeleteAppointmentBtn = document.getElementById('cancelDeleteAppointmentBtn');
    const appointmentForm = document.getElementById('appointmentForm');
    const confirmDeleteAppointmentBtn = document.getElementById('confirmDeleteAppointmentBtn');

    // Calendar navigation
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const todayBtn = document.getElementById('todayBtn');

    // Add appointment button
    if (addAppointmentBtn) {
        addAppointmentBtn.addEventListener('click', () => {
            console.log('➕ Add Appointment button clicked');
            openAppointmentModal();
        });
    }

    // Close modal handlers
    if (closeAppointmentModal) closeAppointmentModal.addEventListener('click', () => appointmentModal.classList.remove('show'));
    if (cancelAppointmentBtn) cancelAppointmentBtn.addEventListener('click', () => appointmentModal.classList.remove('show'));
    if (closeDeleteAppointmentModal) closeDeleteAppointmentModal.addEventListener('click', () => deleteAppointmentModal.classList.remove('show'));
    if (cancelDeleteAppointmentBtn) cancelDeleteAppointmentBtn.addEventListener('click', () => deleteAppointmentModal.classList.remove('show'));

    // Close modal on backdrop click
    appointmentModal?.addEventListener('click', (e) => {
        if (e.target === appointmentModal) {
            appointmentModal.classList.remove('show');
        }
    });

    deleteAppointmentModal?.addEventListener('click', (e) => {
        if (e.target === deleteAppointmentModal) {
            deleteAppointmentModal.classList.remove('show');
        }
    });

    // Form submission
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', handleAppointmentSubmit);
    }

    // Delete confirmation
    if (confirmDeleteAppointmentBtn) {
        confirmDeleteAppointmentBtn.addEventListener('click', handleAppointmentDelete);
    }

    // Calendar navigation
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentDate = new Date();
            renderCalendar();
        });
    }

    console.log('✅ Event listeners setup complete');
}

// Load companies from Firestore
async function loadCompanies() {
    try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, orderBy('companyName', 'asc'));

        const snapshot = await getDocs(q);
        companiesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log('✅ Companies loaded for dropdown:', companiesData.length);
        populateCompanyDropdown();
    } catch (error) {
        console.error('❌ Error loading companies:', error);
    }
}

// Populate company dropdown
function populateCompanyDropdown() {
    const companySelect = document.getElementById('appointmentCompany');
    if (!companySelect) return;

    companySelect.innerHTML = '<option value="">Select Company (Optional)</option>';

    companiesData.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.companyName;
        companySelect.appendChild(option);
    });
}

// Load appointments from Firestore with real-time updates
async function loadAppointments() {
    try {
        const appointmentsRef = collection(db, 'appointments');
        const q = query(appointmentsRef, orderBy('appointmentDate', 'asc'));

        onSnapshot(q, (snapshot) => {
            appointmentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Appointments loaded:', appointmentsData.length);
            renderCalendar();
            renderUpcomingAppointments();
            updateCalendarStats();
        }, (error) => {
            console.error('❌ Error loading appointments:', error);
            showError('Error loading appointments: ' + error.message);
        });
    } catch (error) {
        console.error('❌ Error setting up appointments listener:', error);
        showError('Error loading appointments: ' + error.message);
    }
}

// Render calendar grid
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Check if this is today
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayCell.classList.add('today');
        }

        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        // Get appointments for this day
        const dayAppointments = appointmentsData.filter(apt => {
            if (!apt.appointmentDate) return false;

            // Convert Firestore Timestamp to date string
            let aptDateStr;
            if (apt.appointmentDate.toDate) {
                const aptDate = apt.appointmentDate.toDate();
                aptDateStr = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, '0')}-${String(aptDate.getDate()).padStart(2, '0')}`;
            } else {
                aptDateStr = apt.appointmentDate;
            }

            return aptDateStr === currentDateStr;
        });

        // Add appointment indicators
        const appointmentsContainer = document.createElement('div');
        appointmentsContainer.className = 'day-appointments';

        dayAppointments.slice(0, 3).forEach(apt => {
            const aptEl = document.createElement('div');
            aptEl.className = `appointment-indicator service-${apt.serviceType || 'other'}`;
            aptEl.textContent = apt.title;
            aptEl.title = `${apt.title} - ${formatTime(apt.startTime)}`;
            aptEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openAppointmentModal(apt.id);
            });
            appointmentsContainer.appendChild(aptEl);
        });

        if (dayAppointments.length > 3) {
            const moreEl = document.createElement('div');
            moreEl.className = 'appointment-more';
            moreEl.textContent = `+${dayAppointments.length - 3} more`;
            appointmentsContainer.appendChild(moreEl);
        }

        dayCell.appendChild(appointmentsContainer);

        // Click to add appointment
        dayCell.addEventListener('click', () => {
            openAppointmentModal(null, currentDateStr);
        });

        calendarGrid.appendChild(dayCell);
    }
}

// Render upcoming appointments list
function renderUpcomingAppointments() {
    const container = document.getElementById('upcomingAppointments');
    if (!container) return;

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter upcoming appointments (today and future, not cancelled)
    const upcoming = appointmentsData.filter(apt => {
        if (!apt.appointmentDate || apt.status === 'cancelled') return false;

        const aptDate = apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);

        return aptDate >= today;
    }).slice(0, 10); // Show only next 10 appointments

    if (upcoming.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-calendar-times"></i>
                <p>No upcoming appointments</p>
            </div>
        `;
        return;
    }

    container.innerHTML = upcoming.map(apt => {
        const company = companiesData.find(c => c.id === apt.companyId);
        const companyName = company ? company.companyName : 'No Company';

        return `
            <div class="appointment-item service-${apt.serviceType || 'other'}" onclick="window.calendarModule.editAppointment('${apt.id}')">
                <div class="appointment-time">
                    <div class="appointment-date">${formatAppointmentDate(apt.appointmentDate)}</div>
                    <div class="appointment-hour">${formatTime(apt.startTime)}</div>
                </div>
                <div class="appointment-details">
                    <div class="appointment-title">${escapeHtml(apt.title)}</div>
                    <div class="appointment-meta">
                        <span class="service-badge service-${apt.serviceType}">${formatServiceType(apt.serviceType)}</span>
                        <span><i class="fas fa-building"></i> ${escapeHtml(companyName)}</span>
                        ${apt.location ? `<span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(apt.location)}</span>` : ''}
                    </div>
                </div>
                <div class="appointment-status">
                    <span class="status-badge status-${apt.status}">${capitalizeFirst(apt.status)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Update calendar stats
function updateCalendarStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count appointments
    const todayCount = appointmentsData.filter(apt => {
        if (!apt.appointmentDate || apt.status === 'cancelled') return false;
        const aptDate = apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        return aptDate >= today && aptDate <= todayEnd;
    }).length;

    const weekCount = appointmentsData.filter(apt => {
        if (!apt.appointmentDate || apt.status === 'cancelled') return false;
        const aptDate = apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        return aptDate >= today && aptDate <= weekEnd;
    }).length;

    const monthCount = appointmentsData.filter(apt => {
        if (!apt.appointmentDate || apt.status === 'cancelled') return false;
        const aptDate = apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        return aptDate >= monthStart && aptDate <= monthEnd;
    }).length;

    const testingCount = appointmentsData.filter(apt => {
        if (!apt.appointmentDate || apt.status === 'cancelled') return false;
        const aptDate = apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        return apt.serviceType === 'testing' && aptDate >= today;
    }).length;

    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('weekCount').textContent = weekCount;
    document.getElementById('monthCount').textContent = monthCount;
    document.getElementById('testingCount').textContent = testingCount;
}

// Open modal for add/edit
function openAppointmentModal(appointmentId = null, dateStr = null) {
    console.log('🔓 openAppointmentModal() called with ID:', appointmentId, 'Date:', dateStr);

    const modal = document.getElementById('appointmentModal');
    const form = document.getElementById('appointmentForm');
    const modalTitle = document.getElementById('appointmentModalTitle');

    // Reset form
    form.reset();
    document.getElementById('appointmentId').value = '';
    currentAppointmentId = null;

    if (appointmentId) {
        // Edit mode
        const appointment = appointmentsData.find(a => a.id === appointmentId);
        if (appointment) {
            modalTitle.innerHTML = '<i class="fas fa-calendar-edit"></i> Edit Appointment';
            document.getElementById('appointmentId').value = appointment.id;
            document.getElementById('appointmentTitle').value = appointment.title;
            document.getElementById('appointmentCompany').value = appointment.companyId || '';

            // Convert Firestore Timestamp to date string
            if (appointment.appointmentDate) {
                const aptDate = appointment.appointmentDate.toDate ? appointment.appointmentDate.toDate() : new Date(appointment.appointmentDate);
                const dateString = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, '0')}-${String(aptDate.getDate()).padStart(2, '0')}`;
                document.getElementById('appointmentDate').value = dateString;
            }

            document.getElementById('appointmentTime').value = appointment.startTime || '';
            document.getElementById('appointmentDuration').value = appointment.duration || 30;
            document.getElementById('appointmentService').value = appointment.serviceType || 'other';
            document.getElementById('appointmentStatus').value = appointment.status || 'scheduled';
            document.getElementById('appointmentLocation').value = appointment.location || '';
            document.getElementById('appointmentNotes').value = appointment.notes || '';

            currentAppointmentId = appointmentId;
        }
    } else {
        // Add mode
        modalTitle.innerHTML = '<i class="fas fa-calendar-plus"></i> New Appointment';

        // Pre-fill date if provided
        if (dateStr) {
            document.getElementById('appointmentDate').value = dateStr;
        } else {
            // Set to today's date
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            document.getElementById('appointmentDate').value = todayStr;
        }

        // Set default time to next hour
        const now = new Date();
        const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
        const timeStr = `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`;
        document.getElementById('appointmentTime').value = timeStr;
    }

    // Show modal
    modal.classList.add('show');
    console.log('✅ Modal shown');
}

// Handle form submission
async function handleAppointmentSubmit(e) {
    e.preventDefault();

    const appointmentData = {
        title: document.getElementById('appointmentTitle').value.trim(),
        companyId: document.getElementById('appointmentCompany').value || null,
        appointmentDate: Timestamp.fromDate(new Date(document.getElementById('appointmentDate').value)),
        startTime: document.getElementById('appointmentTime').value,
        duration: parseInt(document.getElementById('appointmentDuration').value),
        serviceType: document.getElementById('appointmentService').value,
        status: document.getElementById('appointmentStatus').value,
        location: document.getElementById('appointmentLocation').value.trim(),
        notes: document.getElementById('appointmentNotes').value.trim(),
        updatedAt: Timestamp.now()
    };

    // Calculate end time
    const [hours, minutes] = appointmentData.startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + appointmentData.duration;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    appointmentData.endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    try {
        if (currentAppointmentId) {
            // Update existing appointment
            const appointmentRef = doc(db, 'appointments', currentAppointmentId);
            await updateDoc(appointmentRef, appointmentData);
            console.log('✅ Appointment updated:', currentAppointmentId);
            showSuccess('Appointment updated successfully!');
        } else {
            // Add new appointment
            appointmentData.createdAt = Timestamp.now();
            const docRef = await addDoc(collection(db, 'appointments'), appointmentData);
            console.log('✅ Appointment created:', docRef.id);
            showSuccess('Appointment created successfully!');
        }

        document.getElementById('appointmentModal').classList.remove('show');
    } catch (error) {
        console.error('❌ Error saving appointment:', error);
        showError('Error saving appointment: ' + error.message);
    }
}

// Delete appointment prompt
function deleteAppointmentPrompt(appointmentId, appointmentTitle) {
    const deleteModal = document.getElementById('deleteAppointmentModal');
    const deleteTitleEl = document.getElementById('deleteAppointmentTitle');

    currentAppointmentId = appointmentId;
    deleteTitleEl.textContent = appointmentTitle;
    deleteModal.classList.add('show');
}

// Handle appointment delete
async function handleAppointmentDelete() {
    if (!currentAppointmentId) return;

    try {
        const appointmentRef = doc(db, 'appointments', currentAppointmentId);
        await deleteDoc(appointmentRef);
        console.log('✅ Appointment deleted:', currentAppointmentId);
        showSuccess('Appointment deleted successfully!');

        document.getElementById('deleteAppointmentModal').classList.remove('show');
        currentAppointmentId = null;
    } catch (error) {
        console.error('❌ Error deleting appointment:', error);
        showError('Error deleting appointment: ' + error.message);
    }
}

// Utility Functions

// Format service type for display
function formatServiceType(type) {
    const types = {
        'testing': 'Drug Testing',
        'web': 'Web Design',
        'it': 'IT Services',
        'other': 'Other'
    };
    return types[type] || type;
}

// Format time
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Format appointment date
function formatAppointmentDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Capitalize first letter
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

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
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Show success message
function showSuccess(message) {
    alert('✅ ' + message);
}

// Show error message
function showError(message) {
    alert('❌ ' + message);
}

// Export functions for window object (for onclick handlers)
window.calendarModule = {
    editAppointment: (id) => openAppointmentModal(id),
    deleteAppointment: deleteAppointmentPrompt
};