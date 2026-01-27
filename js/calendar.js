import { db } from './firebase-config.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let appointmentsData = [];
let companiesData = [];
let currentAppointmentId = null;
let currentDate = new Date();
let currentView = 'month'; // 'month' or 'week'
let draggedAppointmentId = null;
let popupTimeout = null;

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
    const prevPeriodBtn = document.getElementById('prevPeriod');
    const nextPeriodBtn = document.getElementById('nextPeriod');
    const todayBtn = document.getElementById('todayBtn');

    // View toggle buttons
    const monthViewBtn = document.getElementById('monthViewBtn');
    const weekViewBtn = document.getElementById('weekViewBtn');

    // Service type change handler
    const appointmentService = document.getElementById('appointmentService');

    // Popup buttons
    const popupEditBtn = document.getElementById('popupEditBtn');
    const popupDeleteBtn = document.getElementById('popupDeleteBtn');

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
    if (prevPeriodBtn) {
        prevPeriodBtn.addEventListener('click', () => {
            if (currentView === 'month') {
                currentDate.setMonth(currentDate.getMonth() - 1);
            } else {
                currentDate.setDate(currentDate.getDate() - 7);
            }
            renderCalendar();
        });
    }

    if (nextPeriodBtn) {
        nextPeriodBtn.addEventListener('click', () => {
            if (currentView === 'month') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else {
                currentDate.setDate(currentDate.getDate() + 7);
            }
            renderCalendar();
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            currentDate = new Date();
            renderCalendar();
        });
    }

    // View toggle handlers
    if (monthViewBtn) {
        monthViewBtn.addEventListener('click', () => {
            switchView('month');
        });
    }

    if (weekViewBtn) {
        weekViewBtn.addEventListener('click', () => {
            switchView('week');
        });
    }

    // Service type change - show/hide drug testing fields
    if (appointmentService) {
        appointmentService.addEventListener('change', (e) => {
            const drugTestingFields = document.getElementById('drugTestingFields');
            if (e.target.value === 'testing') {
                drugTestingFields.style.display = 'block';
                // Make drug testing fields required
                document.getElementById('testType').setAttribute('required', 'required');
            } else {
                drugTestingFields.style.display = 'none';
                // Remove required attribute
                document.getElementById('testType').removeAttribute('required');
            }
        });
    }

    // Popup edit button
    if (popupEditBtn) {
        popupEditBtn.addEventListener('click', () => {
            const appointmentId = popupEditBtn.dataset.appointmentId;
            hideAppointmentPopup();
            openAppointmentModal(appointmentId);
        });
    }

    // Popup delete button
    if (popupDeleteBtn) {
        popupDeleteBtn.addEventListener('click', () => {
            const appointmentId = popupDeleteBtn.dataset.appointmentId;
            const appointment = appointmentsData.find(a => a.id === appointmentId);
            if (appointment) {
                hideAppointmentPopup();
                deleteAppointmentPrompt(appointmentId, appointment.title);
            }
        });
    }

    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('appointmentPopup');
        if (!popup.contains(e.target) && !e.target.closest('.appointment-indicator')) {
            hideAppointmentPopup();
        }
    });

    console.log('✅ Event listeners setup complete');
}

// Switch between month and week view
function switchView(view) {
    currentView = view;
    
    const monthViewBtn = document.getElementById('monthViewBtn');
    const weekViewBtn = document.getElementById('weekViewBtn');
    const monthCalendar = document.getElementById('monthCalendar');
    const weekCalendar = document.getElementById('weekCalendar');

    if (view === 'month') {
        monthViewBtn.classList.add('active');
        weekViewBtn.classList.remove('active');
        monthCalendar.style.display = 'block';
        weekCalendar.style.display = 'none';
    } else {
        weekViewBtn.classList.add('active');
        monthViewBtn.classList.remove('active');
        monthCalendar.style.display = 'none';
        weekCalendar.style.display = 'block';
    }

    renderCalendar();
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

// Render calendar (delegates to month or week view)
function renderCalendar() {
    if (currentView === 'month') {
        renderMonthView();
    } else {
        renderWeekView();
    }
}

// Render monthly calendar grid
function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentPeriod').textContent = `${monthNames[month]} ${year}`;

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
        dayCell.dataset.date = currentDateStr;

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

        // Add appointment indicators with more details
        const appointmentsContainer = document.createElement('div');
        appointmentsContainer.className = 'day-appointments';

        dayAppointments.slice(0, 3).forEach(apt => {
            const company = companiesData.find(c => c.id === apt.companyId);
            const companyName = company ? company.companyName : '';
            
            const aptEl = document.createElement('div');
            aptEl.className = `appointment-indicator service-${apt.serviceType || 'other'}`;
            aptEl.draggable = true;
            aptEl.dataset.appointmentId = apt.id;
            
            // Build more detailed display
            let displayHtml = `<div class="apt-time">${formatTime(apt.startTime)}</div>`;
            displayHtml += `<div class="apt-title">${escapeHtml(apt.title)}</div>`;
            
            if (companyName) {
                displayHtml += `<div class="apt-company">${escapeHtml(companyName)}</div>`;
            }
            
            if (apt.drugTesting && apt.drugTesting.testType) {
                displayHtml += `<div class="apt-badge">${apt.drugTesting.testType.toUpperCase()}</div>`;
            }
            
            aptEl.innerHTML = displayHtml;
            
            // Hover popup
            aptEl.addEventListener('mouseenter', (e) => {
                showAppointmentPopup(apt, e);
            });
            
            aptEl.addEventListener('mouseleave', () => {
                // Delay hiding to allow moving to popup
                popupTimeout = setTimeout(() => {
                    const popup = document.getElementById('appointmentPopup');
                    if (!popup.matches(':hover')) {
                        hideAppointmentPopup();
                    }
                }, 200);
            });
            
            // Click to edit
            aptEl.addEventListener('click', (e) => {
                e.stopPropagation();
                hideAppointmentPopup();
                openAppointmentModal(apt.id);
            });
            
            // Drag events
            aptEl.addEventListener('dragstart', handleDragStart);
            aptEl.addEventListener('dragend', handleDragEnd);
            
            appointmentsContainer.appendChild(aptEl);
        });

        if (dayAppointments.length > 3) {
            const moreEl = document.createElement('div');
            moreEl.className = 'appointment-more';
            moreEl.textContent = `+${dayAppointments.length - 3} more`;
            appointmentsContainer.appendChild(moreEl);
        }

        dayCell.appendChild(appointmentsContainer);

        // Drop zone events
        dayCell.addEventListener('dragover', handleDragOver);
        dayCell.addEventListener('drop', handleDrop);

        // Click to add appointment
        dayCell.addEventListener('click', (e) => {
            if (e.target === dayCell || e.target === dayNumber) {
                openAppointmentModal(null, currentDateStr);
            }
        });

        calendarGrid.appendChild(dayCell);
    }

    // Popup hover persistence
    const popup = document.getElementById('appointmentPopup');
    popup.addEventListener('mouseenter', () => {
        clearTimeout(popupTimeout);
    });
    
    popup.addEventListener('mouseleave', () => {
        hideAppointmentPopup();
    });
}

// Drag and Drop Handlers
function handleDragStart(e) {
    draggedAppointmentId = e.target.dataset.appointmentId;
    e.target.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
    console.log('🎯 Drag started for appointment:', draggedAppointmentId);
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    draggedAppointmentId = null;
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();

    if (!draggedAppointmentId) return;

    const targetDate = e.currentTarget.dataset.date;
    if (!targetDate) return;

    console.log('📍 Drop detected on date:', targetDate);

    // Find the appointment
    const appointment = appointmentsData.find(a => a.id === draggedAppointmentId);
    if (!appointment) {
        console.error('Appointment not found');
        return;
    }

    try {
        // FIX: Parse date string parts manually to avoid timezone issues
        const [year, month, day] = targetDate.split('-').map(Number);
        // Create date at noon local time to avoid timezone conversion issues
        const newDate = new Date(year, month - 1, day, 12, 0, 0, 0);
        
        // Update appointment date
        const appointmentRef = doc(db, 'appointments', draggedAppointmentId);
        await updateDoc(appointmentRef, {
            appointmentDate: Timestamp.fromDate(newDate),
            updatedAt: Timestamp.now()
        });

        console.log('✅ Appointment moved to:', targetDate);
        showSuccess('Appointment moved successfully!');
    } catch (error) {
        console.error('❌ Error moving appointment:', error);
        showError('Error moving appointment: ' + error.message);
    }

    return false;
}

// Show appointment hover popup - IMPROVED POSITIONING WITH VERTICAL FIX
function showAppointmentPopup(appointment, event) {
    clearTimeout(popupTimeout);
    
    const popup = document.getElementById('appointmentPopup');
    const company = companiesData.find(c => c.id === appointment.companyId);
    
    // Populate popup content
    document.getElementById('popupTitle').textContent = appointment.title;
    document.getElementById('popupStatus').textContent = capitalizeFirst(appointment.status);
    document.getElementById('popupStatus').className = `popup-status status-${appointment.status}`;
    
    // Time
    const endTime = appointment.endTime || calculateEndTime(appointment.startTime, appointment.duration);
    document.getElementById('popupTime').textContent = `${formatTime(appointment.startTime)} - ${formatTime(endTime)} (${appointment.duration} min)`;
    
    // Company
    const companyRow = document.getElementById('popupCompanyRow');
    if (company) {
        document.getElementById('popupCompany').textContent = company.companyName;
        companyRow.style.display = 'flex';
    } else {
        companyRow.style.display = 'none';
    }
    
    // Location
    const locationRow = document.getElementById('popupLocationRow');
    if (appointment.location) {
        document.getElementById('popupLocation').textContent = appointment.location;
        locationRow.style.display = 'flex';
    } else {
        locationRow.style.display = 'none';
    }
    
    // Service
    document.getElementById('popupService').textContent = formatServiceType(appointment.serviceType);
    
    // Drug testing details
    const drugTestingSection = document.getElementById('popupDrugTesting');
    if (appointment.serviceType === 'testing' && appointment.drugTesting) {
        const dt = appointment.drugTesting;
        let drugHtml = '';
        
        if (dt.testType) {
            drugHtml += `<div class="popup-drug-item"><strong>Test Type:</strong> ${dt.testType.toUpperCase()}</div>`;
        }
        
        if (dt.testingKit) {
            drugHtml += `<div class="popup-drug-item"><strong>Testing Kit:</strong> ${dt.testingKit}</div>`;
        }
        
        if (dt.substances && dt.substances.length > 0) {
            const substanceLabels = {
                'breath-alcohol': 'Breath Alcohol',
                'urine': 'Urine Testing',
                'oral': 'Oral Testing'
            };
            const substanceList = dt.substances.map(s => substanceLabels[s] || s).join(', ');
            drugHtml += `<div class="popup-drug-item"><strong>Testing:</strong> ${substanceList}</div>`;
        }
        
        if (dt.cleanCardRequired) {
            drugHtml += `<div class="popup-drug-item clean-card-badge"><i class="fas fa-check-circle"></i> Clean Card Required</div>`;
        }
        
        document.getElementById('popupDrugDetails').innerHTML = drugHtml;
        drugTestingSection.style.display = 'block';
    } else {
        drugTestingSection.style.display = 'none';
    }
    
    // Notes
    const notesRow = document.getElementById('popupNotesRow');
    if (appointment.notes) {
        document.getElementById('popupNotes').textContent = appointment.notes;
        notesRow.style.display = 'flex';
    } else {
        notesRow.style.display = 'none';
    }
    
    // Set appointment ID for actions
    document.getElementById('popupEditBtn').dataset.appointmentId = appointment.id;
    document.getElementById('popupDeleteBtn').dataset.appointmentId = appointment.id;
    
    // IMPROVED POSITIONING - Show tooltip near cursor with smart positioning
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    // Show popup first to get its dimensions
    popup.style.display = 'block';
    popup.style.opacity = '0';
    
    // Use requestAnimationFrame for better positioning timing
    requestAnimationFrame(() => {
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 15;
        const offset = 10; // Offset from cursor
        
        let left = mouseX + offset;
        let top = mouseY + offset;
        
        // Horizontal positioning
        // Check if popup goes off right edge
        if (left + popupRect.width > viewportWidth - padding) {
            left = mouseX - popupRect.width - offset;
        }
        
        // Check if popup goes off left edge
        if (left < padding) {
            left = padding;
        }
        
        // Vertical positioning - FIXED
        // Check if popup goes off bottom edge
        if (top + popupRect.height > viewportHeight - padding) {
            // Position above cursor
            top = mouseY - popupRect.height - offset;
        }
        
        // Check if popup goes off top edge (after moving above)
        if (top < padding) {
            // If it doesn't fit above or below, center it vertically with scroll consideration
            top = Math.max(padding, Math.min(mouseY - popupRect.height / 2, viewportHeight - popupRect.height - padding));
        }
        
        // Apply position
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.opacity = '1';
    });
}

// Hide appointment popup
function hideAppointmentPopup() {
    const popup = document.getElementById('appointmentPopup');
    popup.style.display = 'none';
}

// Calculate end time
function calculateEndTime(startTime, duration) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

// Render weekly calendar view - UPDATED to match monthly block style
function renderWeekView() {
    // Calculate start of week (Sunday)
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Update period display
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startStr = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;
    const endStr = `${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    document.getElementById('currentPeriod').textContent = `${startStr} - ${endStr}`;

    // Get week calendar container
    const weekCalendar = document.getElementById('weekCalendar');
    
    // Build week view with same structure as month view
    let weekHtml = `
        <div class="calendar-header">
            <div class="calendar-day-name">Sunday</div>
            <div class="calendar-day-name">Monday</div>
            <div class="calendar-day-name">Tuesday</div>
            <div class="calendar-day-name">Wednesday</div>
            <div class="calendar-day-name">Thursday</div>
            <div class="calendar-day-name">Friday</div>
            <div class="calendar-day-name">Saturday</div>
        </div>
        <div class="calendar-grid week-grid-blocks" id="weekGridBlocks">
    `;

    // Generate 7 day blocks for the week
    for (let day = 0; day < 7; day++) {
        const currentDayDate = new Date(weekStart);
        currentDayDate.setDate(currentDayDate.getDate() + day);
        
        const dateStr = `${currentDayDate.getFullYear()}-${String(currentDayDate.getMonth() + 1).padStart(2, '0')}-${String(currentDayDate.getDate()).padStart(2, '0')}`;
        
        // Check if this is today
        const today = new Date();
        const isToday = currentDayDate.getFullYear() === today.getFullYear() && 
                        currentDayDate.getMonth() === today.getMonth() && 
                        currentDayDate.getDate() === today.getDate();

        weekHtml += `<div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">`;
        weekHtml += `<div class="day-number">${currentDayDate.getDate()}</div>`;
        weekHtml += `<div class="day-appointments" id="day-${dateStr}"></div>`;
        weekHtml += `</div>`;
    }

    weekHtml += `</div>`;
    weekCalendar.innerHTML = weekHtml;

    // Now populate appointments for each day
    for (let day = 0; day < 7; day++) {
        const currentDayDate = new Date(weekStart);
        currentDayDate.setDate(currentDayDate.getDate() + day);
        
        const dateStr = `${currentDayDate.getFullYear()}-${String(currentDayDate.getMonth() + 1).padStart(2, '0')}-${String(currentDayDate.getDate()).padStart(2, '0')}`;
        
        // Get appointments for this day
        const dayAppointments = appointmentsData.filter(apt => {
            if (!apt.appointmentDate) return false;
            
            let aptDateStr;
            if (apt.appointmentDate.toDate) {
                const aptDate = apt.appointmentDate.toDate();
                aptDateStr = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, '0')}-${String(aptDate.getDate()).padStart(2, '0')}`;
            } else {
                aptDateStr = apt.appointmentDate;
            }
            
            return aptDateStr === dateStr;
        });

        // Sort appointments by time
        dayAppointments.sort((a, b) => {
            const timeA = a.startTime || '00:00';
            const timeB = b.startTime || '00:00';
            return timeA.localeCompare(timeB);
        });

        const appointmentsContainer = document.getElementById(`day-${dateStr}`);
        if (!appointmentsContainer) continue;

        // Show all appointments (no limit in week view for better visibility)
        dayAppointments.forEach(apt => {
            const company = companiesData.find(c => c.id === apt.companyId);
            const companyName = company ? company.companyName : '';
            
            const aptEl = document.createElement('div');
            aptEl.className = `appointment-indicator service-${apt.serviceType || 'other'}`;
            aptEl.draggable = true;
            aptEl.dataset.appointmentId = apt.id;
            
            // Build detailed display
            let displayHtml = `<div class="apt-time">${formatTime(apt.startTime)}</div>`;
            displayHtml += `<div class="apt-title">${escapeHtml(apt.title)}</div>`;
            
            if (companyName) {
                displayHtml += `<div class="apt-company">${escapeHtml(companyName)}</div>`;
            }
            
            if (apt.drugTesting && apt.drugTesting.testType) {
                displayHtml += `<div class="apt-badge">${apt.drugTesting.testType.toUpperCase()}</div>`;
            }
            
            aptEl.innerHTML = displayHtml;
            
            // Hover popup
            aptEl.addEventListener('mouseenter', (e) => {
                showAppointmentPopup(apt, e);
            });
            
            aptEl.addEventListener('mouseleave', () => {
                popupTimeout = setTimeout(() => {
                    const popup = document.getElementById('appointmentPopup');
                    if (!popup.matches(':hover')) {
                        hideAppointmentPopup();
                    }
                }, 200);
            });
            
            // Click to edit
            aptEl.addEventListener('click', (e) => {
                e.stopPropagation();
                hideAppointmentPopup();
                openAppointmentModal(apt.id);
            });
            
            // Drag events
            aptEl.addEventListener('dragstart', handleDragStart);
            aptEl.addEventListener('dragend', handleDragEnd);
            
            appointmentsContainer.appendChild(aptEl);
        });
    }

    // Setup drag and drop for day cells
    document.querySelectorAll('.week-grid-blocks .calendar-day').forEach(dayCell => {
        const dateStr = dayCell.dataset.date;
        
        // Drop zone events
        dayCell.addEventListener('dragover', handleDragOver);
        dayCell.addEventListener('drop', handleDrop);

        // Click to add appointment
        dayCell.addEventListener('click', (e) => {
            if (e.target === dayCell || e.target.classList.contains('day-number') || e.target.classList.contains('day-appointments')) {
                openAppointmentModal(null, dateStr);
            }
        });
    });

    // Popup hover persistence
    const popup = document.getElementById('appointmentPopup');
    if (!popup.hasAttribute('data-listeners-attached')) {
        popup.setAttribute('data-listeners-attached', 'true');
        
        popup.addEventListener('mouseenter', () => {
            clearTimeout(popupTimeout);
        });
        
        popup.addEventListener('mouseleave', () => {
            hideAppointmentPopup();
        });
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

        // Build drug testing badge if applicable
        let drugTestBadge = '';
        if (apt.serviceType === 'testing' && apt.drugTesting) {
            drugTestBadge = `<span class="drug-test-badge">${apt.drugTesting.testType?.toUpperCase() || 'Test'}</span>`;
        }

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
                        ${drugTestBadge}
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
function openAppointmentModal(appointmentId = null, dateStr = null, timeStr = null) {
    console.log('🔓 openAppointmentModal() called with ID:', appointmentId, 'Date:', dateStr, 'Time:', timeStr);

    const modal = document.getElementById('appointmentModal');
    const form = document.getElementById('appointmentForm');
    const modalTitle = document.getElementById('appointmentModalTitle');
    const drugTestingFields = document.getElementById('drugTestingFields');

    // Reset form
    form.reset();
    document.getElementById('appointmentId').value = '';
    currentAppointmentId = null;
    drugTestingFields.style.display = 'none';
    
    // Clear checkboxes
    document.querySelectorAll('.test-substance-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('cleanCardRequired').checked = false;

    if (appointmentId) {
        // Edit mode
        const appointment = appointmentsData.find(a => a.id === appointmentId);
        if (appointment) {
            modalTitle.innerHTML = '<i class="fas fa-calendar-edit"></i> Edit Appointment';
            document.getElementById('appointmentId').value = appointment.id;
            document.getElementById('appointmentTitle').value = appointment.title || '';
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

            // Populate drug testing fields if applicable
            if (appointment.serviceType === 'testing') {
                drugTestingFields.style.display = 'block';
                
                if (appointment.drugTesting) {
                    document.getElementById('testType').value = appointment.drugTesting.testType || '';
                    document.getElementById('testingKit').value = appointment.drugTesting.testingKit || '';
                    
                    // Check substance checkboxes
                    if (appointment.drugTesting.substances) {
                        appointment.drugTesting.substances.forEach(substance => {
                            const checkbox = document.querySelector(`.test-substance-checkbox[value="${substance}"]`);
                            if (checkbox) checkbox.checked = true;
                        });
                    }
                    
                    document.getElementById('cleanCardRequired').checked = appointment.drugTesting.cleanCardRequired || false;
                }
            }

            currentAppointmentId = appointmentId;
            console.log('✅ Loaded appointment for editing:', appointmentId);
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
        
        // Pre-fill time if provided
        if (timeStr) {
            document.getElementById('appointmentTime').value = timeStr;
        } else {
            // Set default time to next hour
            const now = new Date();
            const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0);
            const timeString = `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`;
            document.getElementById('appointmentTime').value = timeString;
        }
    }

    // Show modal
    modal.classList.add('show');
    console.log('✅ Modal shown');
}

// Collect drug testing data
function collectDrugTestingData() {
    const serviceType = document.getElementById('appointmentService').value;
    
    if (serviceType !== 'testing') {
        return null;
    }

    const substanceCheckboxes = document.querySelectorAll('.test-substance-checkbox:checked');
    const substances = Array.from(substanceCheckboxes).map(cb => cb.value);

    return {
        testType: document.getElementById('testType').value,
        testingKit: document.getElementById('testingKit').value || null,
        substances: substances,
        cleanCardRequired: document.getElementById('cleanCardRequired').checked
    };
}

// Handle form submission
async function handleAppointmentSubmit(e) {
    e.preventDefault();

    const serviceType = document.getElementById('appointmentService').value;

    // Validate drug testing fields if service is testing
    if (serviceType === 'testing') {
        const testType = document.getElementById('testType').value;
        const substances = document.querySelectorAll('.test-substance-checkbox:checked');
        
        if (!testType) {
            showError('Please select a test type for drug testing appointments');
            return;
        }

        if (substances.length === 0) {
            showError('Please select at least one substance to test');
            return;
        }

        // Validate testing kit for POCT and POCT-to-Lab
        if ((testType === 'poct' || testType === 'poct-to-lab') && !document.getElementById('testingKit').value) {
            showError('Testing kit is required for POCT and POCT-to-Lab tests');
            return;
        }
    }

    const appointmentData = {
        title: document.getElementById('appointmentTitle').value.trim(),
        companyId: document.getElementById('appointmentCompany').value || null,
        appointmentDate: Timestamp.fromDate(new Date(document.getElementById('appointmentDate').value)),
        startTime: document.getElementById('appointmentTime').value,
        duration: parseInt(document.getElementById('appointmentDuration').value),
        serviceType: serviceType,
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

    // Add drug testing data if applicable
    const drugTestingData = collectDrugTestingData();
    if (drugTestingData) {
        appointmentData.drugTesting = drugTestingData;
    } else {
        // Remove drugTesting field if service type changed from testing to something else
        appointmentData.drugTesting = null;
    }

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
        currentAppointmentId = null;
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