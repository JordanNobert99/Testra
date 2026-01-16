import { db } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let companiesData = [];
let currentCompanyId = null;

// Initialize the Companies page
export function initializeCompaniesPage() {
    console.log('🏢 Initializing Companies page...');

    // Load companies data
    loadCompanies();

    // Setup event listeners
    setupEventListeners();
}

// Setup all event listeners
function setupEventListeners() {
    console.log('⚙️ Setting up event listeners...');

    // Modal controls
    const addCompanyBtn = document.getElementById('addCompanyBtn');
    const companyModal = document.getElementById('companyModal');
    const deleteModal = document.getElementById('deleteModal');
    const closeModal = document.getElementById('closeModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const companyForm = document.getElementById('companyForm');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    // Search and filters
    const searchInput = document.getElementById('searchCompanies');
    const filterService = document.getElementById('filterService');
    const filterStatus = document.getElementById('filterStatus');

    // Add company button
    if (addCompanyBtn) {
        addCompanyBtn.addEventListener('click', () => {
            console.log('➕ Add Company button clicked');
            openCompanyModal();
        });
    }

    // Close modal handlers
    if (closeModal) closeModal.addEventListener('click', () => companyModal.classList.remove('show'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => companyModal.classList.remove('show'));
    if (closeDeleteModal) closeDeleteModal.addEventListener('click', () => deleteModal.classList.remove('show'));
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.remove('show'));

    // Close modal on backdrop click
    companyModal?.addEventListener('click', (e) => {
        if (e.target === companyModal) {
            companyModal.classList.remove('show');
        }
    });

    deleteModal?.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            deleteModal.classList.remove('show');
        }
    });

    // Form submission
    if (companyForm) {
        companyForm.addEventListener('submit', handleCompanySubmit);
    }

    // Delete confirmation
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleCompanyDelete);
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', filterCompanies);
    }

    // Filter functionality
    if (filterService) {
        filterService.addEventListener('change', filterCompanies);
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', filterCompanies);
    }

    console.log('✅ Event listeners setup complete');
}

// Add email field
function addEmailField(email = '', label = '') {
    console.log('📧 addEmailField() called with:', email, label);
    const container = document.getElementById('emailsContainer');

    if (!container) {
        console.error('❌ emailsContainer not found!');
        return;
    }

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'contact-field-group';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'form-input';
    emailInput.placeholder = 'Email address';
    emailInput.value = email;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'form-input label-input';
    labelInput.placeholder = 'Label (e.g., Main, Billing)';
    labelInput.value = label;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-field';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.addEventListener('click', () => {
        console.log('🗑️ Removing email field');
        fieldGroup.remove();
    });

    fieldGroup.appendChild(emailInput);
    fieldGroup.appendChild(labelInput);
    fieldGroup.appendChild(removeBtn);
    container.appendChild(fieldGroup);

    console.log('✅ Email field added. Container now has', container.children.length, 'fields');
}

// Add phone field
function addPhoneField(phone = '', label = '') {
    console.log('📞 addPhoneField() called with:', phone, label);
    const container = document.getElementById('phonesContainer');

    if (!container) {
        console.error('❌ phonesContainer not found!');
        return;
    }

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'contact-field-group';

    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.className = 'form-input';
    phoneInput.placeholder = 'Phone number';
    phoneInput.value = phone;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'form-input label-input';
    labelInput.placeholder = 'Label (e.g., Office, Mobile)';
    labelInput.value = label;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-field';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.addEventListener('click', () => {
        console.log('🗑️ Removing phone field');
        fieldGroup.remove();
    });

    fieldGroup.appendChild(phoneInput);
    fieldGroup.appendChild(labelInput);
    fieldGroup.appendChild(removeBtn);
    container.appendChild(fieldGroup);

    console.log('✅ Phone field added. Container now has', container.children.length, 'fields');
}

// Load companies from Firestore with real-time updates
async function loadCompanies() {
    try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, orderBy('companyName', 'asc'));

        onSnapshot(q, (snapshot) => {
            companiesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Companies loaded:', companiesData.length);
            renderCompanies(companiesData);
            updateCompaniesStats(companiesData);
        }, (error) => {
            console.error('❌ Error loading companies:', error);
            showError('Error loading companies: ' + error.message);
        });
    } catch (error) {
        console.error('❌ Error setting up companies listener:', error);
        showError('Error loading companies: ' + error.message);
    }
}

// Render companies table
function renderCompanies(companies) {
    const tableBody = document.getElementById('companiesTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableCard = document.querySelector('.table-card');

    if (!companies || companies.length === 0) {
        if (tableCard) tableCard.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (tableCard) tableCard.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = companies.map(company => `
        <tr>
            <td>
                <strong>${escapeHtml(company.companyName)}</strong>
                ${company.clientType === 'individual' ? '<span class="client-type-badge">Individual</span>' : ''}
            </td>
            <td>${escapeHtml(company.contactPerson)}</td>
            <td>${renderContactInfo(company)}</td>
            <td>${renderServices(company)}</td>
            <td><span class="status-badge status-${company.status}"><i class="fas fa-circle"></i> ${capitalizeFirst(company.status)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn action-btn-edit" data-company-id="${company.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn action-btn-delete" data-company-id="${company.id}" data-company-name="${escapeHtml(company.companyName)}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Attach event listeners to action buttons
    attachActionButtonListeners();
}

// Render contact info for display
function renderContactInfo(company) {
    let html = '<div class="contact-info-display">';

    // Render emails
    if (company.emails && company.emails.length > 0) {
        company.emails.forEach(email => {
            if (email.value) {
                html += `
                    <div class="contact-info-item">
                        <i class="fas fa-envelope"></i>
                        <span class="contact-label">${escapeHtml(email.label || 'Email')}:</span>
                        <a href="mailto:${escapeHtml(email.value)}" class="contact-value">${escapeHtml(email.value)}</a>
                    </div>
                `;
            }
        });
    }

    // Render phones
    if (company.phones && company.phones.length > 0) {
        company.phones.forEach(phone => {
            if (phone.value) {
                html += `
                    <div class="contact-info-item">
                        <i class="fas fa-phone"></i>
                        <span class="contact-label">${escapeHtml(phone.label || 'Phone')}:</span>
                        <a href="tel:${escapeHtml(phone.value)}" class="contact-value">${escapeHtml(phone.value)}</a>
                    </div>
                `;
            }
        });
    }

    html += '</div>';
    return html;
}

// Attach event listeners to dynamically created action buttons
function attachActionButtonListeners() {
    document.querySelectorAll('.action-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const companyId = e.currentTarget.getAttribute('data-company-id');
            openCompanyModal(companyId);
        });
    });

    document.querySelectorAll('.action-btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const companyId = e.currentTarget.getAttribute('data-company-id');
            const companyName = e.currentTarget.getAttribute('data-company-name');
            deleteCompanyPrompt(companyId, companyName);
        });
    });
}

// Update stats
function updateCompaniesStats(companies) {
    const total = companies.length;
    const active = companies.filter(c => c.status === 'active').length;
    const inactive = companies.filter(c => c.status === 'inactive').length;
    
    // Count companies with testing service
    const testing = companies.filter(c => {
        if (c.services && Array.isArray(c.services)) {
            return c.services.includes('testing');
        }
        // Backwards compatibility
        return c.serviceType === 'testing' || c.serviceType === 'multiple';
    }).length;

    document.getElementById('totalCompanies').textContent = total;
    document.getElementById('activeCompanies').textContent = active;
    document.getElementById('inactiveCompanies').textContent = inactive;
    document.getElementById('testingCompanies').textContent = testing;
}

// Filter companies based on search and filters
function filterCompanies() {
    const searchTerm = document.getElementById('searchCompanies')?.value.toLowerCase() || '';
    const serviceFilter = document.getElementById('filterService')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';

    let filtered = companiesData;

    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(company => {
            const nameMatch = company.companyName.toLowerCase().includes(searchTerm);
            const contactMatch = company.contactPerson.toLowerCase().includes(searchTerm);

            // Search in emails
            const emailMatch = company.emails?.some(email =>
                email.value.toLowerCase().includes(searchTerm) ||
                email.label.toLowerCase().includes(searchTerm)
            );

            // Search in phones
            const phoneMatch = company.phones?.some(phone =>
                phone.value.includes(searchTerm) ||
                phone.label.toLowerCase().includes(searchTerm)
            );

            return nameMatch || contactMatch || emailMatch || phoneMatch;
        });
    }

    // Service filter - check if the service is in the services array
    if (serviceFilter) {
        filtered = filtered.filter(company => {
            if (company.services && Array.isArray(company.services)) {
                return company.services.includes(serviceFilter);
            }
            // Backwards compatibility
            return company.serviceType === serviceFilter || company.serviceType === 'multiple';
        });
    }

    // Status filter
    if (statusFilter) {
        filtered = filtered.filter(company => company.status === statusFilter);
    }

    renderCompanies(filtered);
}

// Open modal for add/edit
function openCompanyModal(companyId = null) {
    console.log('🔓 openCompanyModal() called with ID:', companyId);

    const modal = document.getElementById('companyModal');
    const form = document.getElementById('companyForm');
    const modalTitle = document.getElementById('modalTitle');

    // Reset form
    form.reset();
    document.getElementById('companyId').value = '';
    currentCompanyId = null;

    // Clear dynamic fields
    const emailsContainer = document.getElementById('emailsContainer');
    const phonesContainer = document.getElementById('phonesContainer');
    emailsContainer.innerHTML = '';
    phonesContainer.innerHTML = '';

    // Uncheck all service checkboxes
    document.querySelectorAll('.service-checkbox').forEach(cb => cb.checked = false);

    if (companyId) {
        // Edit mode
        const company = companiesData.find(c => c.id === companyId);
        if (company) {
            modalTitle.innerHTML = '<i class="fas fa-building"></i> Edit Client';
            document.getElementById('companyId').value = company.id;
            document.getElementById('companyName').value = company.companyName;
            document.getElementById('contactPerson').value = company.contactPerson;
            document.getElementById('clientType').value = company.clientType || 'company';
            document.getElementById('companyStatus').value = company.status;
            document.getElementById('companyNotes').value = company.notes || '';

            // Check the appropriate service checkboxes
            if (company.services && Array.isArray(company.services)) {
                company.services.forEach(service => {
                    const checkbox = document.querySelector(`.service-checkbox[value="${service}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            } else if (company.serviceType) {
                // Backwards compatibility: convert old serviceType to services array
                if (company.serviceType === 'multiple') {
                    // If it was "multiple", check all boxes (you may want different logic here)
                    document.querySelectorAll('.service-checkbox').forEach(cb => cb.checked = true);
                } else {
                    const checkbox = document.querySelector(`.service-checkbox[value="${company.serviceType}"]`);
                    if (checkbox) checkbox.checked = true;
                }
            }

            // Populate emails
            if (company.emails && company.emails.length > 0) {
                console.log('📧 Adding', company.emails.length, 'existing emails');
                company.emails.forEach(email => addEmailField(email.value, email.label));
            } else {
                addEmailField();
            }

            // Populate phones
            if (company.phones && company.phones.length > 0) {
                console.log('📞 Adding', company.phones.length, 'existing phones');
                company.phones.forEach(phone => addPhoneField(phone.value, phone.label));
            } else {
                addPhoneField();
            }

            currentCompanyId = companyId;
        }
    } else {
        // Add mode
        modalTitle.innerHTML = '<i class="fas fa-building"></i> Add Client';
        console.log('📧 Adding initial email field');
        addEmailField();
        console.log('📞 Adding initial phone field');
        addPhoneField();
    }

    // *** ATTACH DIRECT EVENT LISTENERS TO BUTTONS ***
    const addEmailBtn = document.getElementById('addEmailBtn');
    const addPhoneBtn = document.getElementById('addPhoneBtn');

    // Remove old listeners by cloning (removes all event listeners)
    if (addEmailBtn) {
        const newEmailBtn = addEmailBtn.cloneNode(true);
        addEmailBtn.parentNode.replaceChild(newEmailBtn, addEmailBtn);
        newEmailBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📧 ADD EMAIL BUTTON CLICKED (direct listener)!');
            addEmailField();
        });
    }

    if (addPhoneBtn) {
        const newPhoneBtn = addPhoneBtn.cloneNode(true);
        addPhoneBtn.parentNode.replaceChild(newPhoneBtn, addPhoneBtn);
        newPhoneBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📞 ADD PHONE BUTTON CLICKED (direct listener)!');
            addPhoneField();
        });
    }

    // Show modal
    modal.classList.add('show');
    console.log('✅ Modal shown');
}

// Collect emails from form
function collectEmails() {
    const emailFields = document.querySelectorAll('#emailsContainer .contact-field-group');
    const emails = [];

    emailFields.forEach(field => {
        const emailInput = field.querySelector('input[type="email"]');
        const labelInput = field.querySelector('.label-input');

        if (emailInput && emailInput.value.trim()) {
            emails.push({
                value: emailInput.value.trim(),
                label: labelInput.value.trim() || 'Email'
            });
        }
    });

    return emails;
}

// Collect phones from form
function collectPhones() {
    const phoneFields = document.querySelectorAll('#phonesContainer .contact-field-group');
    const phones = [];

    phoneFields.forEach(field => {
        const phoneInput = field.querySelector('input[type="tel"]');
        const labelInput = field.querySelector('.label-input');

        if (phoneInput && phoneInput.value.trim()) {
            phones.push({
                value: phoneInput.value.trim(),
                label: labelInput.value.trim() || 'Phone'
            });
        }
    });

    return phones;
}

// Collect selected services
function collectServices() {
    const checkboxes = document.querySelectorAll('.service-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Handle form submission
async function handleCompanySubmit(e) {
    e.preventDefault();

    const emails = collectEmails();
    const phones = collectPhones();
    const services = collectServices();

    // Validate at least one contact method
    if (emails.length === 0 && phones.length === 0) {
        showError('Please add at least one email or phone number');
        return;
    }

    // Validate at least one service is selected
    if (services.length === 0) {
        showError('Please select at least one service');
        return;
    }

    const companyData = {
        companyName: document.getElementById('companyName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        clientType: document.getElementById('clientType').value,
        emails: emails,
        phones: phones,
        services: services,
        status: document.getElementById('companyStatus').value,
        notes: document.getElementById('companyNotes').value.trim(),
        updatedAt: Timestamp.now()
    };

    try {
        if (currentCompanyId) {
            // Update existing company
            const companyRef = doc(db, 'companies', currentCompanyId);
            await updateDoc(companyRef, companyData);
            console.log('✅ Company updated:', currentCompanyId);
            showSuccess('Client updated successfully!');
        } else {
            // Add new company
            companyData.createdAt = Timestamp.now();
            const docRef = await addDoc(collection(db, 'companies'), companyData);
            console.log('✅ Company created:', docRef.id);
            showSuccess('Client added successfully!');
        }

        document.getElementById('companyModal').classList.remove('show');
    } catch (error) {
        console.error('❌ Error saving company:', error);
        showError('Error saving company: ' + error.message);
    }
}

// Delete company prompt
function deleteCompanyPrompt(companyId, companyName) {
    const deleteModal = document.getElementById('deleteModal');
    const deleteCompanyNameEl = document.getElementById('deleteCompanyName');

    currentCompanyId = companyId;
    deleteCompanyNameEl.textContent = companyName;
    deleteModal.classList.add('show');
}

// Handle company delete
async function handleCompanyDelete() {
    if (!currentCompanyId) return;

    try {
        const companyRef = doc(db, 'companies', currentCompanyId);
        await deleteDoc(companyRef);
        console.log('✅ Company deleted:', currentCompanyId);
        showSuccess('Company deleted successfully!');

        document.getElementById('deleteModal').classList.remove('show');
        currentCompanyId = null;
    } catch (error) {
        console.error('❌ Error deleting company:', error);
        showError('Error deleting company: ' + error.message);
    }
}

// Utility Functions

// Capitalize first letter
function capitalizeFirst(str) {
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
    const tableBody = document.getElementById('companiesTableBody');
    if (tableBody && companiesData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
                    <p>${escapeHtml(message)}</p>
                </td>
            </tr>
        `;
    } else {
        alert('❌ ' + message);
    }
}

// New function to render services
function renderServices(company) {
    let services = company.services;
    
    // Backwards compatibility: convert old serviceType to array
    if (!services && company.serviceType) {
        if (company.serviceType === 'multiple') {
            services = ['testing', 'web', 'it'];
        } else {
            services = [company.serviceType];
        }
    }

    if (!services || services.length === 0) {
        return '<span class="service-badge">None</span>';
    }

    return services.map(service => 
        `<span class="service-badge service-${service}">${formatServiceType(service)}</span>`
    ).join(' ');
}

// Update the render function to display multiple services
function renderCompanies(companies) {
    const tableBody = document.getElementById('companiesTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableCard = document.querySelector('.table-card');

    if (!companies || companies.length === 0) {
        if (tableCard) tableCard.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (tableCard) tableCard.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    tableBody.innerHTML = companies.map(company => `
        <tr>
            <td>
                <strong>${escapeHtml(company.companyName)}</strong>
                ${company.clientType === 'individual' ? '<span class="client-type-badge">Individual</span>' : ''}
            </td>
            <td>${escapeHtml(company.contactPerson)}</td>
            <td>${renderContactInfo(company)}</td>
            <td>${renderServices(company)}</td>
            <td><span class="status-badge status-${company.status}"><i class="fas fa-circle"></i> ${capitalizeFirst(company.status)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn action-btn-edit" data-company-id="${company.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn action-btn-delete" data-company-id="${company.id}" data-company-name="${escapeHtml(company.companyName)}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Attach event listeners to action buttons
    attachActionButtonListeners();
}

// Update stats function
function updateCompaniesStats(companies) {
    const total = companies.length;
    const active = companies.filter(c => c.status === 'active').length;
    const inactive = companies.filter(c => c.status === 'inactive').length;
    
    // Count companies with testing service
    const testing = companies.filter(c => {
        if (c.services && Array.isArray(c.services)) {
            return c.services.includes('testing');
        }
        // Backwards compatibility
        return c.serviceType === 'testing' || c.serviceType === 'multiple';
    }).length;

    document.getElementById('totalCompanies').textContent = total;
    document.getElementById('activeCompanies').textContent = active;
    document.getElementById('inactiveCompanies').textContent = inactive;
    document.getElementById('testingCompanies').textContent = testing;
}

// Update filter function to work with multiple services
function filterCompanies() {
    const searchTerm = document.getElementById('searchCompanies')?.value.toLowerCase() || '';
    const serviceFilter = document.getElementById('filterService')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';

    let filtered = companiesData;

    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(company => {
            const nameMatch = company.companyName.toLowerCase().includes(searchTerm);
            const contactMatch = company.contactPerson.toLowerCase().includes(searchTerm);

            // Search in emails
            const emailMatch = company.emails?.some(email =>
                email.value.toLowerCase().includes(searchTerm) ||
                email.label.toLowerCase().includes(searchTerm)
            );

            // Search in phones
            const phoneMatch = company.phones?.some(phone =>
                phone.value.includes(searchTerm) ||
                phone.label.toLowerCase().includes(searchTerm)
            );

            return nameMatch || contactMatch || emailMatch || phoneMatch;
        });
    }

    // Service filter - check if the service is in the services array
    if (serviceFilter) {
        filtered = filtered.filter(company => {
            if (company.services && Array.isArray(company.services)) {
                return company.services.includes(serviceFilter);
            }
            // Backwards compatibility
            return company.serviceType === serviceFilter || company.serviceType === 'multiple';
        });
    }

    // Status filter
    if (statusFilter) {
        filtered = filtered.filter(company => company.status === statusFilter);
    }

    renderCompanies(filtered);
}

// Update formatServiceType to remove "Multiple"
function formatServiceType(type) {
    const types = {
        'testing': 'Drug Testing',
        'web': 'Web Design',
        'it': 'IT Services'
    };
    return types[type] || type;
}