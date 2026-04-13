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

// ===== SCAN & AUTO-FILL =====

let scanImageData = null; // base64 of scanned image
let barcodeScanner = null;

function showScanModal() {
    document.getElementById('scanModal').classList.add('active');
    resetScanUI();
}

function closeScanModal() {
    stopBarcodeScanner();
    document.getElementById('scanModal').classList.remove('active');
    resetScanUI();
}

function resetScanUI() {
    document.getElementById('scanStep1').style.display = '';
    document.getElementById('scanStep2').style.display = 'none';
    document.getElementById('scanStep3').style.display = 'none';
    document.getElementById('scanAddBtn').style.display = 'none';
    document.getElementById('scanAnotherBtn').style.display = 'none';
    document.getElementById('scanPreviewArea').style.display = 'none';
    document.getElementById('scanCancelCamera').style.display = 'none';
    document.getElementById('scanPreviewImg').style.display = 'none';
    document.getElementById('scanModalTitle').textContent = 'Scan Label';
    document.getElementById('scanProgressFill').style.width = '0%';
    scanImageData = null;
}

// --- Camera capture (mobile-friendly) ---
function startCameraCapture() {
    document.getElementById('scanCameraInput').click();
}

function handleScanFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        scanImageData = e.target.result;
        runOCR(scanImageData);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

// --- Barcode scanner ---
function startBarcodeScanner() {
    const previewArea = document.getElementById('scanPreviewArea');
    const readerEl = document.getElementById('barcodeReader');
    previewArea.style.display = 'block';
    document.getElementById('scanCancelCamera').style.display = 'inline-block';

    try {
        barcodeScanner = new Html5Qrcode('barcodeReader');
        barcodeScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 280, height: 100 }, aspectRatio: 2.0 },
            (decodedText) => {
                // Barcode found
                stopBarcodeScanner();
                handleBarcodeResult(decodedText);
            },
            () => { /* ignore scan misses */ }
        ).catch(err => {
            console.error('Barcode scanner start error:', err);
            alert('Could not access camera. Please check permissions or use "Upload Photo" instead.');
            cancelScanPreview();
        });
    } catch (err) {
        console.error('Barcode scanner init error:', err);
        alert('Barcode scanner not available. Try uploading a photo instead.');
        cancelScanPreview();
    }
}

function stopBarcodeScanner() {
    if (barcodeScanner) {
        try {
            barcodeScanner.stop().catch(() => {});
        } catch {}
        try {
            barcodeScanner.clear();
        } catch {}
        barcodeScanner = null;
    }
}

function cancelScanPreview() {
    stopBarcodeScanner();
    document.getElementById('scanPreviewArea').style.display = 'none';
    document.getElementById('scanCancelCamera').style.display = 'none';
    document.getElementById('scanPreviewImg').style.display = 'none';
}

function handleBarcodeResult(code) {
    // Show review step with barcode pre-filled
    goToReviewStep({
        barcode: code,
        rawText: 'Barcode: ' + code
    });
}

// --- OCR with Tesseract.js ---
async function runOCR(imageDataUrl) {
    // Switch to processing step
    document.getElementById('scanStep1').style.display = 'none';
    document.getElementById('scanStep2').style.display = '';
    document.getElementById('scanProcessingImg').src = imageDataUrl;
    document.getElementById('scanModalTitle').textContent = 'Reading Label...';

    const progressFill = document.getElementById('scanProgressFill');
    const progressText = document.getElementById('scanProgressText');

    try {
        const result = await Tesseract.recognize(imageDataUrl, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round((m.progress || 0) * 100);
                    progressFill.style.width = pct + '%';
                    progressText.textContent = `Reading label... ${pct}%`;
                } else if (m.status) {
                    progressText.textContent = m.status + '...';
                }
            }
        });

        const rawText = result.data.text;
        const parsed = parseLabelText(rawText);
        parsed.rawText = rawText;
        goToReviewStep(parsed);

    } catch (err) {
        console.error('OCR error:', err);
        progressText.textContent = 'OCR failed. Please try again with a clearer photo.';
        setTimeout(() => resetScanUI(), 2000);
    }
}

// --- Label text parser ---
// Designed around the label formats from Columbia Lighting / Graybar / electrical distributors
function parseLabelText(text) {
    const result = {};
    // Normalize: collapse whitespace, keep newlines for structure
    const clean = text.replace(/\r/g, '');
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
    const flat = lines.join(' ');

    // Catalog number - looks like LCAT24-40LWG-EDU-C588 pattern
    // Match common electrical catalog patterns: letters+numbers with dashes
    const catMatch = flat.match(/\b([A-Z]{2,}[\d][\w]*(?:-[\w]+){2,})\b/i);
    if (catMatch) {
        result.catalog = catMatch[1].toUpperCase();
    }

    // Product line - usually short code like LCAT, after catalog on label
    // Also check for explicit "LCAT" or similar product line labels
    const plMatch = flat.match(/(?:^|\s)(LCAT|DERA|DERA|EPHS|DERA|PACK|CRML|BLD|ERE|JBL|HBL|FHB|TMS|LHV|LPC|MPR|LRV)(?:\s|$)/i);
    if (plMatch) {
        result.productLine = plMatch[1].toUpperCase();
    } else if (result.catalog) {
        // Extract product line from catalog (first alpha chars)
        const plFromCat = result.catalog.match(/^([A-Z]+)/);
        if (plFromCat) result.productLine = plFromCat[1];
    }

    // Manufacturer - look for known brands
    const manufacturers = [
        'Columbia Lighting', 'Hubbell', 'Lithonia', 'Acuity', 'Eaton',
        'Cooper', 'RAB', 'Cree', 'Philips', 'Lutron', 'Leviton',
        'Square D', 'Schneider', 'ABB', 'Siemens', 'GE', 'Legrand'
    ];
    for (const mfr of manufacturers) {
        if (flat.toLowerCase().includes(mfr.toLowerCase())) {
            result.manufacturer = mfr;
            break;
        }
    }
    // Columbia Lighting specific - check "Product:" area or "Columbia" alone
    if (!result.manufacturer && /columbi/i.test(flat)) {
        result.manufacturer = 'Columbia Lighting';
    }

    // Distributor - check for known distributors
    const distributors = ['GRAYBAR', 'Graybar', 'WESCO', 'Rexel', 'CED', 'Sonepar', 'City Electric'];
    for (const dist of distributors) {
        if (flat.toUpperCase().includes(dist.toUpperCase())) {
            result.distributor = dist.charAt(0).toUpperCase() + dist.slice(1).toLowerCase();
            break;
        }
    }

    // SO number - "SO:" or "SO :" followed by digits
    const soMatch = flat.match(/SO[:\s]*(\d{6,})/i);
    if (soMatch) result.soNumber = soMatch[1];

    // SO Line - "SO Line:" followed by number
    const slMatch = flat.match(/SO\s*Line[:\s]*(\d+)/i);
    if (slMatch) result.soLine = slMatch[1];

    // Quantity - "QTY:" or "Qty:" followed by number
    const qtyMatch = flat.match(/QTY[:\s]*(\d+)/i);
    if (qtyMatch) result.qty = qtyMatch[1];

    // Work Order - "Work Order:" or "Work O" followed by digits
    const woMatch = flat.match(/Work\s*(?:Order|O)[:\s]*([\d]+)/i);
    if (woMatch) result.workOrder = woMatch[1];

    // Partner PO - "Partner PO:" or "Partner Po"
    const poMatch = flat.match(/Partner\s*PO[:\s]*([A-Z0-9][\w\-]*)/i);
    if (poMatch) result.partnerPO = poMatch[1];

    // Assembly Date - "Assembly Date:" or just a date near that context
    const adMatch = flat.match(/(?:Assembly\s*Date|Assembly)[:\s]*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{2,4})/i);
    if (adMatch) result.assemblyDate = adMatch[1];

    // Type - "Type" field, often single letter like "B"
    const typeMatch = flat.match(/\bType[:\s]*([A-Z])\b/i);
    if (typeMatch) result.type = typeMatch[1].toUpperCase();

    // Job Name - "Job Name:" or "Job\nName:" then text until next field
    const jobMatch = clean.match(/Job\s*Name[:\s]*([^\n]+(?:\n[^\n]*)?)/i);
    if (jobMatch) {
        let jobName = jobMatch[1].trim();
        // Clean up: remove trailing labels like "DO NOT REMOVE"
        jobName = jobName.replace(/\s*(DO NOT|OPEN|FIXTURE).*$/i, '').trim();
        // Join multi-line job names
        jobName = jobName.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (jobName.length > 2) result.jobName = jobName;
    }

    // UPC code - "UPC:" followed by digits
    const upcMatch = flat.match(/UPC[:\s]*([\d]+)/i);
    if (upcMatch) result.barcode = upcMatch[1];

    return result;
}

// --- Go to review step ---
function goToReviewStep(parsed) {
    document.getElementById('scanStep1').style.display = 'none';
    document.getElementById('scanStep2').style.display = 'none';
    document.getElementById('scanStep3').style.display = '';
    document.getElementById('scanModalTitle').textContent = 'Review & Add';
    document.getElementById('scanAddBtn').style.display = '';
    document.getElementById('scanAnotherBtn').style.display = '';

    // Show image thumb if we have one
    const thumbImg = document.getElementById('scanReviewImg');
    if (scanImageData) {
        thumbImg.src = scanImageData;
        thumbImg.parentElement.style.display = '';
    } else {
        thumbImg.parentElement.style.display = 'none';
    }

    // Raw text
    document.getElementById('scanRawText').textContent = parsed.rawText || '(no text extracted)';

    // Fill fields and highlight auto-filled ones
    const fieldMap = {
        scanCatalog: parsed.catalog || '',
        scanProductLine: parsed.productLine || '',
        scanManufacturer: parsed.manufacturer || '',
        scanDescription: parsed.description || '',
        scanType: parsed.type || '',
        scanDistributor: parsed.distributor || '',
        scanSO: parsed.soNumber || '',
        scanSOLine: parsed.soLine || '',
        scanWorkOrder: parsed.workOrder || '',
        scanPartnerPO: parsed.partnerPO || '',
        scanAssemblyDate: parsed.assemblyDate || '',
        scanJobName: parsed.jobName || '',
        scanBarcode: parsed.barcode || '',
    };

    for (const [id, value] of Object.entries(fieldMap)) {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
            if (value) {
                el.classList.add('scan-filled');
            } else {
                el.classList.remove('scan-filled');
            }
        }
    }

    // Default qty to what label says, or 1
    document.getElementById('scanQty').value = parsed.qty || 1;
}

// --- Add scanned item to inventory ---
function addScannedItem() {
    const item = {
        id: generateId(),
        catalog: document.getElementById('scanCatalog').value.trim(),
        productLine: document.getElementById('scanProductLine').value.trim(),
        manufacturer: document.getElementById('scanManufacturer').value.trim(),
        description: document.getElementById('scanDescription').value.trim(),
        itemType: document.getElementById('scanType').value.trim(),
        qty: parseInt(document.getElementById('scanQty').value) || 1,
        distributor: document.getElementById('scanDistributor').value.trim(),
        soNumber: document.getElementById('scanSO').value.trim(),
        soLine: document.getElementById('scanSOLine').value.trim(),
        workOrder: document.getElementById('scanWorkOrder').value.trim(),
        partnerPO: document.getElementById('scanPartnerPO').value.trim(),
        assemblyDate: document.getElementById('scanAssemblyDate').value.trim(),
        jobName: document.getElementById('scanJobName').value.trim(),
        barcode: document.getElementById('scanBarcode').value.trim(),
        status: 'received',
        dateReceived: new Date().toISOString().split('T')[0],
        photos: scanImageData ? [scanImageData] : [],
        createdAt: new Date().toISOString(),
    };

    inventoryItems.push(item);
    saveData();
    render();

    // Brief success feedback, then offer to scan another
    document.getElementById('scanModalTitle').textContent = 'Added!';
    document.getElementById('scanAddBtn').style.display = 'none';

    // Auto-reset to scan another after a moment
    setTimeout(() => {
        document.getElementById('scanModalTitle').textContent = 'Scan Label';
    }, 1500);
}

// --- Scan another (stay in modal) ---
function scanAnother() {
    resetScanUI();
}

// --- Keyboard ---
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeScanModal();
        closeModal();
        closeDeleteModal();
        closePhotoViewer();
    }
});
