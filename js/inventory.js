// ===== Inventory App =====
// CR Custom Electric - Material Inventory Tracker

// --- State ---
let inventoryItems = [];
let pendingPhotos = []; // temp photos during add/edit
let currentSort = { field: 'dateReceived', dir: 'desc' };
let deleteTargetId = null;
let viewerPhotos = [];
let viewerIndex = 0;

const STORAGE_KEY = 'crce_inventory';
const FB_PATH = 'inventory';

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initData();
    setupDragDrop();
});

function initData() {
    // Try Firebase first, fall back to localStorage
    if (typeof initializeFirebase === 'function' && initializeFirebase()) {
        loadFromFirebase();
    } else {
        loadFromLocalStorage();
    }
}

function loadFromFirebase() {
    const ref = database.ref(FB_PATH);
    ref.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            inventoryItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        } else {
            inventoryItems = [];
        }
        render();
    }, () => {
        // Firebase error, fall back
        console.warn('Firebase read failed, using localStorage');
        loadFromLocalStorage();
    });
}

function loadFromLocalStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        inventoryItems = stored ? JSON.parse(stored) : [];
    } catch {
        inventoryItems = [];
    }
    render();
}

function saveData() {
    // Save to localStorage always (backup)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventoryItems));
    } catch (e) {
        console.warn('localStorage save failed:', e);
    }

    // Sync to Firebase if available
    if (typeof database !== 'undefined' && database) {
        try {
            const dataObj = {};
            inventoryItems.forEach(item => {
                const { id, ...rest } = item;
                dataObj[id] = rest;
            });
            database.ref(FB_PATH).set(dataObj);
        } catch (e) {
            console.warn('Firebase save failed:', e);
        }
    }
}

// --- Render ---
function render() {
    renderTable();
    renderMobileCards();
    renderStats();
    updateFilterDropdowns();
}

function renderTable() {
    const tbody = document.getElementById('inventoryBody');
    const emptyState = document.getElementById('emptyState');
    const filtered = getFilteredItems();

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.add('visible');
        return;
    }
    emptyState.classList.remove('visible');

    tbody.innerHTML = filtered.map(item => {
        const photoCell = item.photos && item.photos.length > 0
            ? `<img class="table-photo" src="${item.photos[0]}" alt="Photo" onclick="openPhotoViewer('${item.id}', 0)">`
            : `<div class="photo-placeholder">📦</div>`;

        return `<tr>
            <td>${photoCell}</td>
            <td title="${esc(item.catalog || '')}">${esc(item.catalog || '-')}</td>
            <td title="${esc(item.description || '')}">${esc(item.description || item.productLine || '-')}</td>
            <td style="text-align:center">${item.qty || 1}</td>
            <td title="${esc(item.jobName || '')}">${esc(item.jobName || '-')}</td>
            <td>${esc(item.distributor || '-')}</td>
            <td>${esc(item.soNumber || '-')}</td>
            <td>${esc(item.workOrder || '-')}</td>
            <td>${esc(item.partnerPO || '-')}</td>
            <td>${item.dateReceived || '-'}</td>
            <td><span class="status-badge status-${item.status || 'received'}">${item.status || 'received'}</span></td>
            <td>
                <div class="action-cell">
                    <button class="btn-icon" onclick="editItem('${item.id}')" title="Edit">&#9998;</button>
                    <button class="btn-icon" onclick="showDeleteModal('${item.id}')" title="Delete">&#128465;</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderMobileCards() {
    // Remove existing mobile cards container
    let container = document.querySelector('.mobile-cards');
    if (!container) {
        container = document.createElement('div');
        container.className = 'mobile-cards';
        document.querySelector('.table-wrapper').insertAdjacentElement('afterend', container);
    }

    const filtered = getFilteredItems();
    if (filtered.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = filtered.map(item => {
        const photosHtml = item.photos && item.photos.length > 0
            ? `<div class="mobile-card-photos">${item.photos.map((p, i) =>
                `<img class="mobile-card-photo" src="${p}" onclick="openPhotoViewer('${item.id}', ${i})">`
            ).join('')}</div>` : '';

        return `<div class="mobile-card">
            <div class="mobile-card-header">
                <span class="mobile-card-catalog">${esc(item.catalog || 'No Catalog #')}</span>
                <span class="status-badge status-${item.status || 'received'}">${item.status || 'received'}</span>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-field"><span class="mobile-card-label">Description</span>${esc(item.description || item.productLine || '-')}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">Qty</span>${item.qty || 1}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">Job</span>${esc(item.jobName || '-')}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">Distributor</span>${esc(item.distributor || '-')}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">SO #</span>${esc(item.soNumber || '-')}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">Work Order</span>${esc(item.workOrder || '-')}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">Partner PO</span>${esc(item.partnerPO || '-')}</div>
                <div class="mobile-card-field"><span class="mobile-card-label">Received</span>${item.dateReceived || '-'}</div>
            </div>
            ${photosHtml}
            <div class="mobile-card-actions">
                <button class="btn btn-sm btn-secondary" onclick="editItem('${item.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="showDeleteModal('${item.id}')">Delete</button>
            </div>
        </div>`;
    }).join('');
}

function renderStats() {
    const items = inventoryItems;
    document.getElementById('totalItems').textContent = items.length;
    document.getElementById('totalQty').textContent = items.reduce((sum, i) => sum + (parseInt(i.qty) || 1), 0);

    const jobs = new Set(items.map(i => i.jobName).filter(Boolean));
    document.getElementById('totalJobs').textContent = jobs.size;

    document.getElementById('receivedCount').textContent = items.filter(i => i.status === 'received').length;
    document.getElementById('pendingCount').textContent = items.filter(i => i.status === 'pending').length;
}

function updateFilterDropdowns() {
    const jobSelect = document.getElementById('jobFilter');
    const distSelect = document.getElementById('distributorFilter');

    const jobs = [...new Set(inventoryItems.map(i => i.jobName).filter(Boolean))].sort();
    const dists = [...new Set(inventoryItems.map(i => i.distributor).filter(Boolean))].sort();

    const currentJob = jobSelect.value;
    const currentDist = distSelect.value;

    jobSelect.innerHTML = '<option value="">All Jobs</option>' +
        jobs.map(j => `<option value="${esc(j)}"${j === currentJob ? ' selected' : ''}>${esc(j)}</option>`).join('');

    distSelect.innerHTML = '<option value="">All Distributors</option>' +
        dists.map(d => `<option value="${esc(d)}"${d === currentDist ? ' selected' : ''}>${esc(d)}</option>`).join('');
}

// --- Filtering & Sorting ---
function getFilteredItems() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const job = document.getElementById('jobFilter').value;
    const dist = document.getElementById('distributorFilter').value;

    let items = inventoryItems.filter(item => {
        if (status && item.status !== status) return false;
        if (job && item.jobName !== job) return false;
        if (dist && item.distributor !== dist) return false;
        if (search) {
            const haystack = [
                item.catalog, item.description, item.productLine,
                item.jobName, item.distributor, item.soNumber,
                item.workOrder, item.partnerPO, item.manufacturer,
                item.notes, item.location
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    // Sort
    const { field, dir } = currentSort;
    items.sort((a, b) => {
        let va = a[field] || '';
        let vb = b[field] || '';
        if (field === 'qty') {
            va = parseInt(va) || 0;
            vb = parseInt(vb) || 0;
        }
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    return items;
}

function filterItems() {
    render();
}

function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = { field, dir: 'asc' };
    }
    render();
}

// --- Add / Edit ---
function showAddItemModal() {
    document.getElementById('modalTitle').textContent = 'Add Inventory Item';
    document.getElementById('editItemId').value = '';
    clearForm();
    pendingPhotos = [];
    renderPhotoPreview();

    // Default date to today
    document.getElementById('dateReceived').value = new Date().toISOString().split('T')[0];

    document.getElementById('itemModal').classList.add('active');
}

function editItem(id) {
    const item = inventoryItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Edit Inventory Item';
    document.getElementById('editItemId').value = id;

    document.getElementById('catalogNum').value = item.catalog || '';
    document.getElementById('productLine').value = item.productLine || '';
    document.getElementById('manufacturer').value = item.manufacturer || '';
    document.getElementById('description').value = item.description || '';
    document.getElementById('itemType').value = item.itemType || '';
    document.getElementById('qty').value = item.qty || 1;
    document.getElementById('distributor').value = item.distributor || '';
    document.getElementById('soNumber').value = item.soNumber || '';
    document.getElementById('soLine').value = item.soLine || '';
    document.getElementById('workOrder').value = item.workOrder || '';
    document.getElementById('partnerPO').value = item.partnerPO || '';
    document.getElementById('assemblyDate').value = item.assemblyDate || '';
    document.getElementById('jobName').value = item.jobName || '';
    document.getElementById('status').value = item.status || 'received';
    document.getElementById('dateReceived').value = item.dateReceived || '';
    document.getElementById('location').value = item.location || '';
    document.getElementById('notes').value = item.notes || '';

    pendingPhotos = item.photos ? [...item.photos] : [];
    renderPhotoPreview();

    document.getElementById('itemModal').classList.add('active');
}

function saveItem() {
    const id = document.getElementById('editItemId').value;
    const item = {
        catalog: document.getElementById('catalogNum').value.trim(),
        productLine: document.getElementById('productLine').value.trim(),
        manufacturer: document.getElementById('manufacturer').value.trim(),
        description: document.getElementById('description').value.trim(),
        itemType: document.getElementById('itemType').value.trim(),
        qty: parseInt(document.getElementById('qty').value) || 1,
        distributor: document.getElementById('distributor').value.trim(),
        soNumber: document.getElementById('soNumber').value.trim(),
        soLine: document.getElementById('soLine').value.trim(),
        workOrder: document.getElementById('workOrder').value.trim(),
        partnerPO: document.getElementById('partnerPO').value.trim(),
        assemblyDate: document.getElementById('assemblyDate').value,
        jobName: document.getElementById('jobName').value.trim(),
        status: document.getElementById('status').value,
        dateReceived: document.getElementById('dateReceived').value,
        location: document.getElementById('location').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        photos: pendingPhotos,
    };

    if (id) {
        // Update
        const idx = inventoryItems.findIndex(i => i.id === id);
        if (idx !== -1) {
            inventoryItems[idx] = { ...inventoryItems[idx], ...item };
        }
    } else {
        // Add new
        item.id = generateId();
        item.createdAt = new Date().toISOString();
        inventoryItems.push(item);
    }

    saveData();
    render();
    closeModal();
}

function clearForm() {
    const fields = [
        'catalogNum', 'productLine', 'manufacturer', 'description',
        'itemType', 'distributor', 'soNumber', 'soLine', 'workOrder',
        'partnerPO', 'assemblyDate', 'jobName', 'dateReceived',
        'location', 'notes'
    ];
    fields.forEach(f => document.getElementById(f).value = '');
    document.getElementById('qty').value = 1;
    document.getElementById('status').value = 'received';
}

function closeModal() {
    document.getElementById('itemModal').classList.remove('active');
    pendingPhotos = [];
}

// --- Delete ---
function showDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.remove('active');
}

function confirmDelete() {
    if (deleteTargetId) {
        inventoryItems = inventoryItems.filter(i => i.id !== deleteTargetId);
        saveData();
        render();
    }
    closeDeleteModal();
}

// --- Photo Handling ---
function handlePhotoUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            // Resize image to keep storage manageable
            resizeImage(e.target.result, 800, (resized) => {
                pendingPhotos.push(resized);
                renderPhotoPreview();
            });
        };
        reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    event.target.value = '';
}

function resizeImage(dataUrl, maxSize, callback) {
    const img = new Image();
    img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxSize || h > maxSize) {
            if (w > h) {
                h = Math.round(h * maxSize / w);
                w = maxSize;
            } else {
                w = Math.round(w * maxSize / h);
                h = maxSize;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
}

function renderPhotoPreview() {
    const grid = document.getElementById('photoPreviewGrid');
    grid.innerHTML = pendingPhotos.map((src, idx) => `
        <div class="photo-preview-item">
            <img src="${src}" alt="Photo ${idx + 1}">
            <button class="photo-remove-btn" onclick="removePhoto(${idx})">&times;</button>
        </div>
    `).join('');
}

function removePhoto(idx) {
    pendingPhotos.splice(idx, 1);
    renderPhotoPreview();
}

function setupDragDrop() {
    const dropzone = document.getElementById('photoDropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
        });
    });

    dropzone.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length) {
            // Reuse the handler
            handlePhotoUpload({ target: { files }, currentTarget: { value: '' } });
        }
    });
}

// --- Photo Viewer ---
function openPhotoViewer(itemId, photoIdx) {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item || !item.photos || item.photos.length === 0) return;

    viewerPhotos = item.photos;
    viewerIndex = photoIdx || 0;
    updatePhotoViewer();
    document.getElementById('photoViewerModal').classList.add('active');
}

function updatePhotoViewer() {
    document.getElementById('photoViewerImg').src = viewerPhotos[viewerIndex];
    document.getElementById('photoCounter').textContent = `${viewerIndex + 1} / ${viewerPhotos.length}`;
}

function prevPhoto() {
    viewerIndex = (viewerIndex - 1 + viewerPhotos.length) % viewerPhotos.length;
    updatePhotoViewer();
}

function nextPhoto() {
    viewerIndex = (viewerIndex + 1) % viewerPhotos.length;
    updatePhotoViewer();
}

function closePhotoViewer() {
    document.getElementById('photoViewerModal').classList.remove('active');
    viewerPhotos = [];
}

// --- Export ---
function exportCSV() {
    if (inventoryItems.length === 0) {
        alert('No items to export.');
        return;
    }

    const headers = [
        'Catalog #', 'Product Line', 'Manufacturer', 'Description', 'Type',
        'Qty', 'Distributor', 'SO #', 'SO Line', 'Work Order', 'Partner PO',
        'Assembly Date', 'Job Name', 'Status', 'Date Received', 'Location', 'Notes'
    ];

    const rows = inventoryItems.map(i => [
        i.catalog, i.productLine, i.manufacturer, i.description, i.itemType,
        i.qty, i.distributor, i.soNumber, i.soLine, i.workOrder, i.partnerPO,
        i.assemblyDate, i.jobName, i.status, i.dateReceived, i.location, i.notes
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- Utilities ---
function generateId() {
    return 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Keyboard ---
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal();
        closeDeleteModal();
        closePhotoViewer();
    }
});
