import { db } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let companiesData = [];
let currentCompanyId = null;

// Initialize the Companies page
export function initializeCompaniesPage() {
    console.log('?? Initializing Companies page...');

    // Load companies data
    loadCompanies();

    // Setup event listeners
    setupEventListeners();
}

// Setup all event listeners
function setupEventListeners() {
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

            console.log('? Companies loaded:', companiesData.length);
            renderCompanies(companiesData);
            updateCompaniesStats(companiesData);
        }, (error) => {
            console.error('? Error loading companies:', error);
            showError('Error loading companies: ' + error.message);
        });
    } catch (error) {
        console.error('? Error setting up companies listener:', error);
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
            <td><strong>${escapeHtml(company.companyName)}</strong></td>
            <td>${escapeHtml(company.contactPerson)}</td>
            <td><a href="mailto:${escapeHtml(company.email)}" style="color: var(--color-primary);">${escapeHtml(company.email)}</a></td>
            <td><a href="tel:${escapeHtml(company.phone)}" style="color: var(--color-primary);">${escapeHtml(company.phone)}</a></td>
            <td><span class="service-badge service-${company.serviceType}">${formatServiceType(company.serviceType)}</span></td>
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
    const testing = companies.filter(c => c.serviceType === 'testing' || c.serviceType === 'multiple').length;

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
        filtered = filtered.filter(company =>
            company.companyName.toLowerCase().includes(searchTerm) ||
            company.contactPerson.toLowerCase().includes(searchTerm) ||
            company.email.toLowerCase().includes(searchTerm) ||
            company.phone.includes(searchTerm)
        );
    }

    // Service filter
    if (serviceFilter) {
        filtered = filtered.filter(company => company.serviceType === serviceFilter);
    }

    // Status filter
    if (statusFilter) {
        filtered = filtered.filter(company => company.status === statusFilter);
    }

    renderCompanies(filtered);
}

// Open modal for add/edit
function openCompanyModal(companyId = null) {
    const modal = document.getElementById('companyModal');
    const form = document.getElementById('companyForm');
    const modalTitle = document.getElementById('modalTitle');

    // Reset form
    form.reset();
    document.getElementById('companyId').value = '';
    currentCompanyId = null;

    if (companyId) {
        // Edit mode
        const company = companiesData.find(c => c.id === companyId);
        if (company) {
            modalTitle.innerHTML = '<i class="fas fa-building"></i> Edit Company';
            document.getElementById('companyId').value = company.id;
            document.getElementById('companyName').value = company.companyName;
            document.getElementById('contactPerson').value = company.contactPerson;
            document.getElementById('companyEmail').value = company.email;
            document.getElementById('companyPhone').value = company.phone;
            document.getElementById('serviceType').value = company.serviceType;
            document.getElementById('companyStatus').value = company.status;
            document.getElementById('companyAddress').value = company.address || '';
            document.getElementById('companyCity').value = company.city || '';
            document.getElementById('companyProvince').value = company.province || '';
            document.getElementById('companyPostal').value = company.postalCode || '';
            document.getElementById('companyNotes').value = company.notes || '';
            currentCompanyId = companyId;
        }
    } else {
        // Add mode
        modalTitle.innerHTML = '<i class="fas fa-building"></i> Add Company';
    }

    modal.classList.add('show');
}

// Handle form submission
async function handleCompanySubmit(e) {
    e.preventDefault();

    const companyData = {
        companyName: document.getElementById('companyName').value.trim(),
        contactPerson: document.getElementById('contactPerson').value.trim(),
        email: document.getElementById('companyEmail').value.trim(),
        phone: document.getElementById('companyPhone').value.trim(),
        serviceType: document.getElementById('serviceType').value,
        status: document.getElementById('companyStatus').value,
        address: document.getElementById('companyAddress').value.trim(),
        city: document.getElementById('companyCity').value.trim(),
        province: document.getElementById('companyProvince').value,
        postalCode: document.getElementById('companyPostal').value.trim(),
        notes: document.getElementById('companyNotes').value.trim(),
        updatedAt: Timestamp.now()
    };

    try {
        if (currentCompanyId) {
            // Update existing company
            const companyRef = doc(db, 'companies', currentCompanyId);
            await updateDoc(companyRef, companyData);
            console.log('? Company updated:', currentCompanyId);
            showSuccess('Company updated successfully!');
        } else {
            // Add new company
            companyData.createdAt = Timestamp.now();
            const docRef = await addDoc(collection(db, 'companies'), companyData);
            console.log('? Company created:', docRef.id);
            showSuccess('Company added successfully!');
        }

        document.getElementById('companyModal').classList.remove('show');
    } catch (error) {
        console.error('? Error saving company:', error);
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
        console.log('? Company deleted:', currentCompanyId);
        showSuccess('Company deleted successfully!');

        document.getElementById('deleteModal').classList.remove('show');
        currentCompanyId = null;
    } catch (error) {
        console.error('? Error deleting company:', error);
        showError('Error deleting company: ' + error.message);
    }
}

// Utility Functions

// Format service type for display
function formatServiceType(type) {
    const types = {
        'testing': 'Drug Testing',
        'web': 'Web Design',
        'it': 'IT Services',
        'multiple': 'Multiple'
    };
    return types[type] || type;
}

// Capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
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
    const tableBody = document.getElementById('companiesTableBody');
    if (tableBody && companiesData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
                    <p>${escapeHtml(message)}</p>
                </td>
            </tr>
        `;
    } else {
        alert('? ' + message);
    }
}