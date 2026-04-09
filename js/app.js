/**
 * CR Custom Electric - Man Loader Application
 * Simplified 3-Week Daily Schedule with Drag & Drop
 */

// Data storage
let workers = [];
let jobs = [];
let dailySchedule = {}; // key: "jobId_dateString", value: { demand, assigned: [] }
let vacationSchedule = {}; // key: "workerId_dateString", value: true (on vacation)
let scheduleWeekOffset = 0; // weeks from current week for 3-week lookahead

// JobTread integration
let jobtreadGrantKey = ''; // Stored separately for security
let jobtreadTaskIds = {}; // key: "jobId_dateString", value: jobtread task ID

// Drag state for schedule
let draggingWorkerId = null;
let draggingFromJob = null;
let draggingFromDate = null;

// Drag state for job reordering
let draggingJobId = null;

// Drag state for crew copying
let copyingCrewFromJob = null;
let copyingCrewFromDate = null;
let copyingCrewWorkers = [];

// UI state
let showArchivedJobs = false;
let isMobileView = false; // Auto-detected based on screen width
let currentDayOffset = 0; // Day offset from today for mobile single-day view
let longPressTimer = null; // Timer for long-press detection
let touchStartX = 0; // For swipe detection
let touchStartY = 0;
let planningMode = false; // PM mode: hide assignments, show demands only
let showWeeklyOverview = false; // Show print-style worker-centric view
let showUtilization = true; // Show worker utilization panel
let showSuggestions = true; // Show smart suggestions panel
let selectedWorkerId = null; // For click-to-assign mode
let activeDateKey = null; // For day-based roster filtering

// View preferences
let viewMode = 'job'; // 'job' or 'crew' board
let divisionFilter = 'commercial'; // 'commercial', 'residential', or 'both'
let jobColors = {}; // Map of jobId to color for crew board

// Keyboard navigation state
let selectedCells = []; // Array of selected cells: [{jobId, dateKey}, ...]
let primaryCellIndex = 0; // Index of the primary selected cell (for typeahead, etc.)
let lastClickedCell = null; // Last clicked cell for Shift+Click range selection
let selectionAnchor = null; // Anchor cell for Shift+Arrow selection
let typeaheadBuffer = ''; // Buffer for typeahead search
let typeaheadTimeout = null; // Timeout for clearing typeahead buffer
let typeaheadResults = []; // Filtered workers from typeahead
let typeaheadSelectedIndex = 0; // Selected index in typeahead results

// Undo stack
let undoStack = []; // Stack of previous states
const MAX_UNDO_STACK = 50; // Maximum undo history

// Manpower tracking constants
const ROLE_WEIGHTS = {
    'foreman': 1.3,      // 30% more productive (experienced, decision-maker)
    'journeyman': 1.0,   // Baseline
    'apprentice': 0.6    // 60% productive (learning, needs supervision)
};

// Crew size efficiency curve (diminishing returns as crew grows)
const EFFICIENCY_CURVE = {
    1: 1.00,  // Solo work, no coordination overhead
    2: 1.00,  // Ideal pairing, baseline
    3: 0.90,  // Slight coordination tax
    4: 0.82,  // Moderate coordination, space constraints
    5: 0.75,  // Getting crowded
    6: 0.68,  // Too many people, serious overhead
    7: 0.62,  // Severe diminishing returns
    8: 0.58   // Maximum before negative returns
};

/**
 * Get efficiency multiplier for a given crew size
 */
function getEfficiencyMultiplier(crewSize) {
    if (crewSize <= 0) return 0;
    if (crewSize <= 8) return EFFICIENCY_CURVE[crewSize];
    // For very large crews, use worst efficiency
    return 0.50;
}

/**
 * Format worker name for display (first name + last initial)
 */
function formatWorkerName(worker) {
    const parts = worker.name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0]; // Only first name
    }
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0);
    return `${firstName} ${lastInitial}.`;
}

// ============================================================================
// Modal Functions
// ============================================================================

function showAddWorkerModal() {
    document.getElementById('addWorkerModal').classList.add('active');
}

function closeAddWorkerModal() {
    document.getElementById('addWorkerModal').classList.remove('active');
    document.getElementById('workerForm').reset();
}

function showAddJobModal() {
    document.getElementById('addJobModal').classList.add('active');
}

function closeAddJobModal() {
    document.getElementById('addJobModal').classList.remove('active');
    document.getElementById('jobForm').reset();
}

/**
 * Custom confirm modal
 */
function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;

    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');

    // Remove old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Add new listeners
    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        closeConfirmModal();
    });

    newCancelBtn.addEventListener('click', closeConfirmModal);

    modal.classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal')?.classList.remove('active');
}

/**
 * Custom prompt modal
 */
function showPromptModal(title, message, defaultValue, onConfirm) {
    const modal = document.getElementById('promptModal');
    if (!modal) return;

    document.getElementById('promptModalTitle').textContent = title;
    document.getElementById('promptModalMessage').textContent = message;
    document.getElementById('promptModalInput').value = defaultValue || '';

    const confirmBtn = document.getElementById('promptModalConfirm');
    const cancelBtn = document.getElementById('promptModalCancel');

    // Remove old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Add new listeners
    newConfirmBtn.addEventListener('click', () => {
        const value = document.getElementById('promptModalInput').value;
        if (value && value.trim()) {
            onConfirm(value.trim());
            closePromptModal();
        }
    });

    newCancelBtn.addEventListener('click', closePromptModal);

    modal.classList.add('active');

    // Focus the input
    setTimeout(() => {
        document.getElementById('promptModalInput').focus();
    }, 100);
}

function closePromptModal() {
    document.getElementById('promptModal')?.classList.remove('active');
}

/**
 * Edit job modal
 */
let editingJobId = null;

function showEditJobModal(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;
    document.getElementById('editJobName').value = job.name;
    document.getElementById('editJobDivision').value = job.division;
    document.getElementById('editJobLocation').value = job.location || '';
    document.getElementById('editJobModal').classList.add('active');
}

function closeEditJobModal() {
    editingJobId = null;
    document.getElementById('editJobModal').classList.remove('active');
    document.getElementById('editJobForm').reset();
}

/**
 * Mobile assignment modals
 */
function showAssignWorkerModal(workerId, dateKey) {
    if (!isMobileView) return;

    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    const activeJobs = jobs.filter(j => !j.archived);
    const jobsWithSlots = activeJobs.map(job => {
        const slotKey = `${job.id}_${dateKey}`;
        const slot = dailySchedule[slotKey] || { demand: 0, assigned: [] };
        return { ...job, slot };
    });

    showConfirmModal(
        `Assign ${worker.name}`,
        `Where should ${worker.name} work today?`,
        () => {} // Will be replaced with job selection
    );

    // Replace modal content with job list
    const modalMessage = document.getElementById('confirmModalMessage');
    if (modalMessage) {
        modalMessage.innerHTML = `
            <div class="assign-modal-jobs">
                ${jobsWithSlots.map(job => `
                    <button class="assign-job-btn" onclick="assignWorkerToJob(${workerId}, ${job.id}, '${dateKey}')">
                        <div class="assign-job-name">${job.name}</div>
                        <div class="assign-job-stats">Need: ${job.slot.demand || 0} | Got: ${job.slot.assigned.length}</div>
                    </button>
                `).join('')}
                <button class="assign-job-btn assign-vacation-btn" onclick="addVacation(${workerId}, '${dateKey}')">
                    🏖️ Mark as Vacation
                </button>
            </div>
        `;
    }
}

function showAssignToJobModal(jobId, dateKey) {
    if (!isMobileView) return;

    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const slotKey = `${jobId}_${dateKey}`;
    const slot = dailySchedule[slotKey] || { demand: 0, assigned: [] };
    const assignedIds = slot.assigned || [];

    const availableWorkers = workers.filter(w => {
        if (w.archived) return false;
        if (assignedIds.includes(w.id)) return false;

        // Check if scheduled elsewhere
        const isScheduled = Object.keys(dailySchedule).some(key => {
            if (key.includes(dateKey) && !key.startsWith(`${jobId}_`)) {
                const otherSlot = dailySchedule[key];
                return otherSlot && otherSlot.assigned && otherSlot.assigned.includes(w.id);
            }
            return false;
        });

        const vacKey = `${w.id}_${dateKey}`;
        const isOnVacation = vacationSchedule[vacKey];

        return !isScheduled && !isOnVacation;
    });

    showConfirmModal(
        `Assign to ${job.name}`,
        availableWorkers.length > 0 ? 'Select a worker:' : 'No workers available',
        () => {}
    );

    // Replace modal content with worker list
    const modalMessage = document.getElementById('confirmModalMessage');
    if (modalMessage) {
        if (availableWorkers.length > 0) {
            modalMessage.innerHTML = `
                <div class="assign-modal-workers">
                    ${availableWorkers.map(w => `
                        <button class="assign-worker-btn assign-worker-${w.role}" onclick="assignWorkerToJob(${w.id}, ${jobId}, '${dateKey}')">
                            <div class="assign-worker-icon">👷</div>
                            <div class="assign-worker-info">
                                <div class="assign-worker-name">${w.name}</div>
                                <div class="assign-worker-role">${w.role}</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            `;
        } else {
            modalMessage.innerHTML = '<p>All workers are either assigned to other jobs or on vacation.</p>';
        }
    }
}

function assignWorkerToJob(workerId, jobId, dateKey) {
    const slotKey = `${jobId}_${dateKey}`;
    if (!dailySchedule[slotKey]) {
        dailySchedule[slotKey] = { demand: 0, assigned: [] };
    }
    if (!dailySchedule[slotKey].assigned.includes(workerId)) {
        dailySchedule[slotKey].assigned.push(workerId);
        saveData();
        renderSchedule();
    }
    closeConfirmModal();
}

function addVacation(workerId, dateKey) {
    const vacKey = `${workerId}_${dateKey}`;
    vacationSchedule[vacKey] = true;
    saveData();
    renderSchedule();
    closeConfirmModal();
}

function showJobMenu(jobId, dateKey) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    showConfirmModal(
        job.name,
        'Choose an action:',
        () => {}
    );

    const modalMessage = document.getElementById('confirmModalMessage');
    if (modalMessage) {
        modalMessage.innerHTML = `
            <div class="job-menu-actions">
                <button class="menu-action-btn" onclick="editJob(${jobId}); closeConfirmModal();">
                    ✏️ Edit Job
                </button>
                <button class="menu-action-btn" onclick="archiveJob(${jobId}); closeConfirmModal();">
                    📦 Archive Job
                </button>
                <button class="menu-action-btn menu-action-danger" onclick="removeJob(${jobId}); closeConfirmModal();">
                    🗑️ Delete Job
                </button>
            </div>
        `;
    }
}

/**
 * Keyboard event handler for modals and navigation
 */
document.addEventListener('keydown', function(e) {
    // Close modals with ESC
    if (e.key === 'Escape') {
        // First check if typeahead is showing
        if (typeaheadBuffer) {
            clearTypeahead();
            return;
        }
        // Then check if cell is selected
        if (selectedCells.length > 0) {
            deselectCell();
            return;
        }
        // Finally close modals
        closeAddWorkerModal();
        closeAddJobModal();
        closeConfirmModal();
        closePromptModal();
        closeEditJobModal();
        closePrintModal();
        return;
    }

    // Ignore keyboard navigation if modal is open
    if (document.querySelector('.modal.active')) {
        return;
    }

    // Handle keyboard navigation (arrow keys)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        // If typeahead is active and we're pressing up/down, navigate typeahead
        if (typeaheadResults.length > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            navigateTypeahead(e.key);
        } else if (e.shiftKey) {
            // Shift+Arrow: Extend selection (like Excel)
            extendSelectionWithArrow(e.key);
        } else {
            // Regular arrow: Move selection
            handleArrowKey(e.key);
        }
        return;
    }

    // Handle Enter key (assign worker from typeahead or toggle selection)
    if (e.key === 'Enter') {
        e.preventDefault();
        if (typeaheadResults.length > 0) {
            assignWorkerFromTypeahead();
        }
        return;
    }

    // Handle Command/Ctrl + R (copy to selected cells)
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        copyAssignmentAcrossWeek();
        return;
    }

    // Handle Command/Ctrl + Z (undo)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
        return;
    }

    // Handle alphanumeric input for typeahead
    if (selectedCells.length > 0 && e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key)) {
        e.preventDefault();
        handleTypeahead(e.key);
        return;
    }

    // Handle Backspace - clear typeahead buffer or clear cell assignments
    if (selectedCells.length > 0 && e.key === 'Backspace') {
        e.preventDefault();
        if (typeaheadBuffer) {
            // If typing, remove last character
            typeaheadBuffer = typeaheadBuffer.slice(0, -1);
            updateTypeahead();
        } else {
            // If not typing, clear selected cells
            clearSelectedCells();
        }
        return;
    }
});

// ============================================================================
// Keyboard Navigation Functions
// ============================================================================

/**
 * Select a cell for keyboard navigation
 */
function selectCell(jobId, dateKey, addToSelection = false) {
    if (!addToSelection) {
        // Single selection - replace all
        selectedCells = [{jobId, dateKey}];
        primaryCellIndex = 0;
    } else {
        // Check if already selected
        const existingIndex = selectedCells.findIndex(c => c.jobId === jobId && c.dateKey === dateKey);
        if (existingIndex >= 0) {
            // Already selected - remove it (toggle)
            selectedCells.splice(existingIndex, 1);
            primaryCellIndex = Math.min(primaryCellIndex, Math.max(0, selectedCells.length - 1));
        } else {
            // Add to selection
            selectedCells.push({jobId, dateKey});
        }
    }
    renderSchedule();
}

/**
 * Deselect all cells
 */
function deselectCell() {
    selectedCells = [];
    primaryCellIndex = 0;
    selectionAnchor = null;
    clearTypeahead();
    renderSchedule();
}

/**
 * Check if a cell is selected
 */
function isCellSelected(jobId, dateKey) {
    return selectedCells.some(c => c.jobId === jobId && c.dateKey === dateKey);
}

/**
 * Get the primary selected cell
 */
function getPrimaryCell() {
    return selectedCells[primaryCellIndex] || null;
}

/**
 * Select a range of cells (Shift+Click)
 */
function selectCellRange(startJobId, startDateKey, endJobId, endDateKey) {
    // Get all active jobs and dates
    let activeJobs = jobs.filter(j => j.active);
    if (divisionFilter !== 'both') {
        activeJobs = activeJobs.filter(j => j.division === divisionFilter);
    }
    const dates = getScheduleDates();

    // Find indices
    const startJobIndex = activeJobs.findIndex(j => j.id === startJobId);
    const endJobIndex = activeJobs.findIndex(j => j.id === endJobId);
    const startDateIndex = dates.findIndex(d => getDateKey(d) === startDateKey);
    const endDateIndex = dates.findIndex(d => getDateKey(d) === endDateKey);

    if (startJobIndex === -1 || endJobIndex === -1 || startDateIndex === -1 || endDateIndex === -1) {
        return; // Invalid range
    }

    // Determine the rectangle bounds
    const minJobIndex = Math.min(startJobIndex, endJobIndex);
    const maxJobIndex = Math.max(startJobIndex, endJobIndex);
    const minDateIndex = Math.min(startDateIndex, endDateIndex);
    const maxDateIndex = Math.max(startDateIndex, endDateIndex);

    // Clear current selection and select all cells in range
    selectedCells = [];
    for (let jobIdx = minJobIndex; jobIdx <= maxJobIndex; jobIdx++) {
        for (let dateIdx = minDateIndex; dateIdx <= maxDateIndex; dateIdx++) {
            selectedCells.push({
                jobId: activeJobs[jobIdx].id,
                dateKey: getDateKey(dates[dateIdx])
            });
        }
    }
    primaryCellIndex = 0;

    // Set anchor to start of range for future Shift+Arrow operations
    selectionAnchor = {jobId: startJobId, dateKey: startDateKey};

    renderSchedule();
}

/**
 * Extend selection with Shift+Arrow (Excel-style)
 */
function extendSelectionWithArrow(key) {
    let activeJobs = jobs.filter(j => j.active);
    if (divisionFilter !== 'both') {
        activeJobs = activeJobs.filter(j => j.division === divisionFilter);
    }
    if (activeJobs.length === 0) return;

    const dates = getScheduleDates();

    // If no cells selected, start with first cell
    if (selectedCells.length === 0) {
        selectCell(activeJobs[0].id, getDateKey(dates[0]));
        selectionAnchor = {jobId: activeJobs[0].id, dateKey: getDateKey(dates[0])};
        return;
    }

    // Set anchor if not set (first time using Shift+Arrow)
    if (!selectionAnchor) {
        const primaryCell = getPrimaryCell();
        selectionAnchor = {jobId: primaryCell.jobId, dateKey: primaryCell.dateKey};
    }

    // Get the current end of selection (last cell that was added)
    const lastCell = selectedCells[selectedCells.length - 1];

    // Find current position
    const jobIndex = activeJobs.findIndex(j => j.id === lastCell.jobId);
    const dateIndex = dates.findIndex(d => getDateKey(d) === lastCell.dateKey);

    if (jobIndex === -1 || dateIndex === -1) return;

    // Calculate new position based on arrow key
    let newJobIndex = jobIndex;
    let newDateIndex = dateIndex;

    switch (key) {
        case 'ArrowUp':
            newJobIndex = Math.max(0, jobIndex - 1);
            break;
        case 'ArrowDown':
            newJobIndex = Math.min(activeJobs.length - 1, jobIndex + 1);
            break;
        case 'ArrowLeft':
            newDateIndex = Math.max(0, dateIndex - 1);
            break;
        case 'ArrowRight':
            newDateIndex = Math.min(dates.length - 1, dateIndex + 1);
            break;
    }

    // Select range from anchor to new position
    const anchorJobIndex = activeJobs.findIndex(j => j.id === selectionAnchor.jobId);
    const anchorDateIndex = dates.findIndex(d => getDateKey(d) === selectionAnchor.dateKey);

    if (anchorJobIndex !== -1 && anchorDateIndex !== -1) {
        const minJobIndex = Math.min(anchorJobIndex, newJobIndex);
        const maxJobIndex = Math.max(anchorJobIndex, newJobIndex);
        const minDateIndex = Math.min(anchorDateIndex, newDateIndex);
        const maxDateIndex = Math.max(anchorDateIndex, newDateIndex);

        // Clear and rebuild selection
        selectedCells = [];
        for (let jobIdx = minJobIndex; jobIdx <= maxJobIndex; jobIdx++) {
            for (let dateIdx = minDateIndex; dateIdx <= maxDateIndex; dateIdx++) {
                selectedCells.push({
                    jobId: activeJobs[jobIdx].id,
                    dateKey: getDateKey(dates[dateIdx])
                });
            }
        }
        primaryCellIndex = 0;

        renderSchedule();

        // Scroll the new cell into view
        scrollCellIntoView(activeJobs[newJobIndex].id, getDateKey(dates[newDateIndex]));
    }
}

/**
 * Handle arrow key navigation (without Shift)
 */
function handleArrowKey(key) {
    let activeJobs = jobs.filter(j => j.active);
    if (divisionFilter !== 'both') {
        activeJobs = activeJobs.filter(j => j.division === divisionFilter);
    }
    if (activeJobs.length === 0) return;

    const dates = getScheduleDates();

    // If no cell selected, select the first cell
    if (selectedCells.length === 0) {
        selectCell(activeJobs[0].id, getDateKey(dates[0]));
        selectionAnchor = {jobId: activeJobs[0].id, dateKey: getDateKey(dates[0])};
        return;
    }

    // Get primary selected cell
    const primaryCell = getPrimaryCell();
    if (!primaryCell) {
        selectCell(activeJobs[0].id, getDateKey(dates[0]));
        selectionAnchor = {jobId: activeJobs[0].id, dateKey: getDateKey(dates[0])};
        return;
    }

    // Find current position
    const jobIndex = activeJobs.findIndex(j => j.id === primaryCell.jobId);
    const dateIndex = dates.findIndex(d => getDateKey(d) === primaryCell.dateKey);

    if (jobIndex === -1 || dateIndex === -1) {
        // Invalid state, reset
        selectCell(activeJobs[0].id, getDateKey(dates[0]));
        selectionAnchor = {jobId: activeJobs[0].id, dateKey: getDateKey(dates[0])};
        return;
    }

    let newJobIndex = jobIndex;
    let newDateIndex = dateIndex;

    switch (key) {
        case 'ArrowUp':
            newJobIndex = Math.max(0, jobIndex - 1);
            break;
        case 'ArrowDown':
            newJobIndex = Math.min(activeJobs.length - 1, jobIndex + 1);
            break;
        case 'ArrowLeft':
            newDateIndex = Math.max(0, dateIndex - 1);
            break;
        case 'ArrowRight':
            newDateIndex = Math.min(dates.length - 1, dateIndex + 1);
            break;
    }

    // Move to new cell (single selection)
    selectCell(activeJobs[newJobIndex].id, getDateKey(dates[newDateIndex]));
    // Reset anchor for next Shift+Arrow operation
    selectionAnchor = {jobId: activeJobs[newJobIndex].id, dateKey: getDateKey(dates[newDateIndex])};

    // Scroll selected cell into view
    scrollCellIntoView(activeJobs[newJobIndex].id, getDateKey(dates[newDateIndex]));
}

/**
 * Scroll selected cell into view
 */
function scrollCellIntoView(jobId, dateKey) {
    setTimeout(() => {
        const cell = document.querySelector(`.schedule-cell[data-job-id="${jobId}"][data-date-key="${dateKey}"]`);
        if (cell) {
            cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, 50);
}

/**
 * Handle typeahead input
 */
function handleTypeahead(char) {
    typeaheadBuffer += char;
    updateTypeahead();

    // Reset timeout
    if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
    typeaheadTimeout = setTimeout(() => {
        clearTypeahead();
    }, 3000); // Clear after 3 seconds of no typing
}

/**
 * Update typeahead results
 */
function updateTypeahead() {
    if (!typeaheadBuffer) {
        typeaheadResults = [];
        typeaheadSelectedIndex = 0;
        renderSchedule();
        return;
    }

    // Filter workers by name (fuzzy search - case-insensitive, matches anywhere)
    const searchLower = typeaheadBuffer.toLowerCase();
    typeaheadResults = workers.filter(w =>
        w.name.toLowerCase().includes(searchLower)
    );
    typeaheadSelectedIndex = 0;

    renderSchedule();
}

/**
 * Navigate typeahead dropdown with arrow keys
 */
function navigateTypeahead(key) {
    if (typeaheadResults.length === 0) return;

    if (key === 'ArrowDown') {
        typeaheadSelectedIndex = Math.min(typeaheadResults.length - 1, typeaheadSelectedIndex + 1);
    } else if (key === 'ArrowUp') {
        typeaheadSelectedIndex = Math.max(0, typeaheadSelectedIndex - 1);
    }

    renderSchedule();
}

/**
 * Clear typeahead state
 */
function clearTypeahead() {
    typeaheadBuffer = '';
    typeaheadResults = [];
    typeaheadSelectedIndex = 0;
    if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
    typeaheadTimeout = null;
    renderSchedule();
}

/**
 * Assign worker from typeahead selection
 */
function assignWorkerFromTypeahead() {
    if (typeaheadResults.length === 0 || selectedCells.length === 0) return;

    const worker = typeaheadResults[typeaheadSelectedIndex];
    if (!worker) return;

    // Save state for undo
    saveStateForUndo();

    // Get primary cell
    const primaryCell = getPrimaryCell();
    if (!primaryCell) return;

    // Assign the worker to primary cell
    const slotKey = `${primaryCell.jobId}_${primaryCell.dateKey}`;
    if (!dailySchedule[slotKey]) {
        dailySchedule[slotKey] = { demand: 0, assigned: [] };
    }
    const slot = dailySchedule[slotKey];

    // Ensure assigned array exists
    if (!Array.isArray(slot.assigned)) {
        slot.assigned = [];
    }

    // Check if already assigned
    if (!slot.assigned.includes(worker.id)) {
        slot.assigned.push(worker.id);
        saveData();
    }

    clearTypeahead();
    renderSchedule();
}

/**
 * Copy assignments from first selected cell to all other selected cells
 */
function copyAssignmentAcrossWeek() {
    if (selectedCells.length < 2) return; // Need at least 2 cells selected

    // Save state for undo
    saveStateForUndo();

    // Get the source cell (first selected)
    const sourceCell = selectedCells[0];
    const sourceSlotKey = `${sourceCell.jobId}_${sourceCell.dateKey}`;
    const sourceSlot = dailySchedule[sourceSlotKey];

    if (!sourceSlot || !sourceSlot.assigned || sourceSlot.assigned.length === 0) {
        return; // Nothing to copy
    }

    // Copy to all other selected cells
    for (let i = 1; i < selectedCells.length; i++) {
        const targetCell = selectedCells[i];
        const targetSlotKey = `${targetCell.jobId}_${targetCell.dateKey}`;
        const targetSlot = dailySchedule[targetSlotKey] || { demand: 0, assigned: [] };

        // Copy the workers
        targetSlot.assigned = [...sourceSlot.assigned];
        dailySchedule[targetSlotKey] = targetSlot;
    }

    saveData();
    renderSchedule();
}

/**
 * Get schedule dates (helper)
 */
function getScheduleDates() {
    const dates = [];
    for (let week = 0; week < 3; week++) {
        const weekStart = getWeekMonday(scheduleWeekOffset + week);
        for (let day = 0; day < 6; day++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + day);
            dates.push(date);
        }
    }
    return dates;
}

/**
 * Save current state to undo stack
 */
function saveStateForUndo() {
    // Deep clone the current daily schedule
    const state = JSON.parse(JSON.stringify(dailySchedule));
    undoStack.push(state);

    // Limit stack size
    if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift(); // Remove oldest state
    }
}

/**
 * Undo last change
 */
function performUndo() {
    if (undoStack.length === 0) return;

    // Pop the last state
    const previousState = undoStack.pop();

    // Restore it
    dailySchedule = previousState;

    saveData();
    renderSchedule();
}

/**
 * Clear all assignments for a specific week
 */
function clearWeek(weekOffset) {
    // Confirm action
    const weekStart = getWeekMonday(scheduleWeekOffset + weekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);
    const weekLabel = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;

    if (!confirm(`Clear all worker assignments for the week of ${weekLabel}?\n\nThis cannot be undone (unless you use Cmd+Z immediately).`)) {
        return;
    }

    saveStateForUndo();

    // Get all dates for this week
    const dates = [];
    for (let day = 0; day < 6; day++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + day);
        dates.push(getDateKey(date));
    }

    // Clear all assignments for this week
    Object.keys(dailySchedule).forEach(slotKey => {
        const dateKey = slotKey.split('_').slice(1).join('_'); // Everything after first underscore
        if (dates.includes(dateKey)) {
            // Clear assignments but keep demand
            if (dailySchedule[slotKey].assigned) {
                dailySchedule[slotKey].assigned = [];
            }
        }
    });

    saveData();
    renderSchedule();
}

/**
 * Clear assignments from all selected cells
 */
function clearSelectedCells() {
    if (selectedCells.length === 0) return;

    if (!confirm(`Clear worker assignments from ${selectedCells.length} selected cell${selectedCells.length > 1 ? 's' : ''}?`)) {
        return;
    }

    saveStateForUndo();

    selectedCells.forEach(cell => {
        const slotKey = `${cell.jobId}_${cell.dateKey}`;
        if (dailySchedule[slotKey]) {
            dailySchedule[slotKey].assigned = [];
        }
    });

    saveData();
    renderSchedule();
}

/**
 * Show clear week modal
 */
function showClearWeekModal() {
    const weekOptions = [];
    for (let week = 0; week < 3; week++) {
        const weekStart = getWeekMonday(scheduleWeekOffset + week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5);
        weekOptions.push({
            offset: week,
            label: week === 0 ? 'Current Week' : week === 1 ? 'Next Week' : '2 Weeks Ahead',
            dateRange: `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`
        });
    }

    const message = 'Which week would you like to clear?\n\n' +
        weekOptions.map((w, i) => `${i + 1}. ${w.label} (${w.dateRange})`).join('\n');

    const choice = prompt(message + '\n\nEnter 1, 2, or 3:');

    if (choice === '1' || choice === '2' || choice === '3') {
        clearWeek(parseInt(choice) - 1);
    }
}

// ============================================================================
// Form Event Handlers
// ============================================================================

// Add worker form submission
document.getElementById('workerForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const worker = {
        id: Date.now(),
        name: document.getElementById('workerName').value,
        role: document.getElementById('workerRole').value,
        division: document.getElementById('workerDivision').value,
        isForeman: document.getElementById('workerRole').value === 'foreman'
    };

    workers.push(worker);
    saveData();
    renderWorkers();
    renderSchedule();
    closeAddWorkerModal();
});

// Add job form submission
document.getElementById('jobForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const job = {
        id: Date.now(),
        name: document.getElementById('jobName').value,
        division: document.getElementById('jobDivision').value,
        location: document.getElementById('jobLocation').value,
        active: true
    };

    jobs.push(job);
    saveData();
    renderJobs();
    renderSchedule();
    closeAddJobModal();
});

// Edit job form submission
document.getElementById('editJobForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (!editingJobId) return;

    const job = jobs.find(j => j.id === editingJobId);
    if (!job) return;

    job.name = document.getElementById('editJobName').value;
    job.division = document.getElementById('editJobDivision').value;
    job.location = document.getElementById('editJobLocation').value;

    saveData();
    renderJobs();
    renderSchedule();
    closeEditJobModal();
});

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render the workers list in Add Worker modal
 */
function renderWorkers() {
    const list = document.getElementById('workerList');
    if (!list) return;

    if (workers.length === 0) {
        list.innerHTML = '<div class="empty-state">No workers added yet</div>';
        return;
    }

    list.innerHTML = workers.map(worker => `
        <div class="item-card">
            <div class="item-info">
                <strong>${worker.name}</strong>
                <span class="badge badge-${worker.role}">${worker.role}</span>
                <span class="badge badge-${worker.division}">${worker.division}</span>
            </div>
            <button class="btn-remove" onclick="removeWorker(${worker.id})">Remove</button>
        </div>
    `).join('');
}

/**
 * Render the jobs list in Add Job modal
 */
function renderJobs() {
    const list = document.getElementById('jobList');
    if (!list) return;

    if (jobs.length === 0) {
        list.innerHTML = '<div class="empty-state">No jobs added yet</div>';
        return;
    }

    list.innerHTML = jobs.map(job => `
        <div class="item-card">
            <div class="item-info">
                <strong>${job.name}</strong>
                <span class="badge badge-${job.division}">${job.division}</span>
                <div class="details">${job.location}</div>
            </div>
            <button class="btn-remove" onclick="removeJob(${job.id})">Remove</button>
        </div>
    `).join('');
}

/**
 * Remove a worker
 */
function removeWorker(id) {
    // Remove from any schedule assignments
    Object.keys(dailySchedule).forEach(key => {
        if (dailySchedule[key].assigned) {
            dailySchedule[key].assigned = dailySchedule[key].assigned.filter(wId => wId !== id);
        }
    });

    workers = workers.filter(w => w.id !== id);
    saveData();
    renderWorkers();
    renderSchedule();
}

/**
 * Remove a job (with confirmation)
 */
function removeJob(id) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    showConfirmModal(
        'Remove Job',
        `Are you sure you want to permanently remove "${job.name}"? This will delete all schedule assignments for this job.`,
        () => {
            // Remove all schedule entries for this job
            Object.keys(dailySchedule).forEach(key => {
                if (key.startsWith(`${id}_`)) {
                    delete dailySchedule[key];
                }
            });

            jobs = jobs.filter(j => j.id !== id);
            saveData();
            renderJobs();
            renderSchedule();
        }
    );
}

/**
 * Archive a job (marks as inactive)
 */
function archiveJob(id) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    showConfirmModal(
        'Archive Job',
        `Archive "${job.name}"? This will remove it from the active schedule but keep all data.`,
        () => {
            job.active = false;
            saveData();
            renderSchedule();
        }
    );
}

/**
 * Unarchive a job (marks as active)
 */
function unarchiveJob(id) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    job.active = true;
    saveData();
    renderSchedule();
}

/**
 * Toggle archived jobs visibility
 */
function toggleArchivedJobs() {
    showArchivedJobs = !showArchivedJobs;
    renderSchedule();
}

/**
 * Edit a job
 */
function editJob(id) {
    showEditJobModal(id);
}

// ============================================================================
// 3-Week Daily Schedule Functions
// ============================================================================

/**
 * Get the Monday of the week that contains the given date, offset by N weeks
 */
function getWeekMonday(offsetWeeks) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday + (offsetWeeks * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

/**
 * Get date string key for storage (YYYY-MM-DD)
 */
function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Format date for display
 */
function formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Shift schedule view by N weeks
 */
function shiftScheduleWeek(delta) {
    scheduleWeekOffset += delta;
    renderSchedule();
}

/**
 * Main schedule rendering function
 */
function renderSchedule() {
    if (isMobileView) {
        renderMobileSchedule();
    } else {
        renderDesktopSchedule();
    }
}

/**
 * Calculate job staffing status (over/under scheduled vs baseline manpower)
 * Returns: { status: 'ahead'|'on-track'|'behind'|'critical', daysAheadBehind, details }
 */
function calculateJobStaffingStatus(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return null;

    // Get all dates for visible 3 weeks
    const dates = [];
    for (let week = 0; week < 3; week++) {
        const monday = getWeekMonday(scheduleWeekOffset + week);
        for (let day = 0; day < 6; day++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + day);
            dates.push(date);
        }
    }

    let baselineJMDays = 0;      // Baseline journeyman-days (from generic manpower)
    let actualEffectiveJMDays = 0; // Actual effective journeyman-days (weighted + efficiency)

    dates.forEach(date => {
        const dateKey = getDateKey(date);
        const slotKey = `${jobId}_${dateKey}`;
        const slot = dailySchedule[slotKey];

        if (!slot) return;

        // Baseline: generic manpower (treated as journeymen)
        if (slot.demand) {
            baselineJMDays += slot.demand;
        }

        // Actual: assigned workers with role weighting
        if (slot.assigned && slot.assigned.length > 0) {
            const crewSize = slot.assigned.length;
            let weightedSum = 0;

            slot.assigned.forEach(workerId => {
                const worker = workers.find(w => w.id === workerId);
                if (worker) {
                    const roleWeight = ROLE_WEIGHTS[worker.role] || 1.0;
                    weightedSum += roleWeight;
                }
            });

            // Apply efficiency curve based on crew size
            const efficiency = getEfficiencyMultiplier(crewSize);
            const effectiveJMDays = weightedSum * efficiency;
            actualEffectiveJMDays += effectiveJMDays;
        }
    });

    // If no baseline, can't calculate status
    if (baselineJMDays === 0) return null;

    // Calculate ratio and days ahead/behind
    const ratio = actualEffectiveJMDays / baselineJMDays;
    const daysAheadBehind = actualEffectiveJMDays - baselineJMDays;

    // Determine status
    let status = 'on-track';
    if (ratio >= 1.10) {
        status = 'ahead';
    } else if (ratio < 0.70) {
        status = 'critical';
    } else if (ratio < 0.90) {
        status = 'behind';
    }

    return {
        status,
        daysAheadBehind: Math.round(daysAheadBehind * 10) / 10, // Round to 1 decimal
        ratio,
        baselineJMDays: Math.round(baselineJMDays * 10) / 10,
        actualEffectiveJMDays: Math.round(actualEffectiveJMDays * 10) / 10
    };
}

/**
 * Render staffing status indicator for a job
 * Returns HTML string with icon and tooltip
 */
function renderStaffingStatusIndicator(jobId) {
    const status = calculateJobStaffingStatus(jobId);
    if (!status) return ''; // No baseline manpower to compare against

    const { status: statusType, daysAheadBehind, ratio, baselineJMDays, actualEffectiveJMDays } = status;

    // Choose icon and color based on status
    let icon = '';
    let colorClass = '';
    let statusText = '';

    if (statusType === 'ahead') {
        icon = '⚡';
        colorClass = 'status-ahead';
        statusText = 'Ahead of schedule';
    } else if (statusType === 'on-track') {
        icon = '✓';
        colorClass = 'status-on-track';
        statusText = 'On track';
    } else if (statusType === 'behind') {
        icon = '⚠️';
        colorClass = 'status-behind';
        statusText = 'Behind schedule';
    } else if (statusType === 'critical') {
        icon = '⚠️';
        colorClass = 'status-critical';
        statusText = 'Critically understaffed';
    }

    // Format days ahead/behind display
    const daysDisplay = daysAheadBehind > 0
        ? `+${daysAheadBehind.toFixed(1)}d`
        : `${daysAheadBehind.toFixed(1)}d`;

    // Build detailed tooltip
    const percentOfBaseline = Math.round(ratio * 100);
    const tooltipText = `${statusText}
Baseline: ${baselineJMDays} JM-days (generic manpower)
Scheduled: ${actualEffectiveJMDays} effective JM-days (${percentOfBaseline}%)
Difference: ${daysDisplay} journeyman-days
${daysAheadBehind > 0 ? 'Ahead by ~' + Math.abs(Math.round(daysAheadBehind)) + ' days' : daysAheadBehind < 0 ? 'Behind by ~' + Math.abs(Math.round(daysAheadBehind)) + ' days' : 'On schedule'}`;

    return `<span class="staffing-status-indicator ${colorClass}" title="${tooltipText}">${icon} ${daysDisplay}</span>`;
}

/**
 * Desktop 3-week schedule view
 */
function renderDesktopSchedule() {
    // Generate all dates for 3 weeks (Mon-Sat)
    const dates = [];
    for (let week = 0; week < 3; week++) {
        const monday = getWeekMonday(scheduleWeekOffset + week);
        for (let day = 0; day < 6; day++) { // Mon-Sat (0-5)
            const date = new Date(monday);
            date.setDate(monday.getDate() + day);
            dates.push(date);
        }
    }

    // Update week range label
    const rangeStart = formatDateShort(dates[0]);
    const rangeEnd = formatDateShort(dates[dates.length - 1]);
    const label = document.getElementById('scheduleWeekRange');
    if (label) label.textContent = `${rangeStart} – ${rangeEnd}`;

    // Hide JobTread actions in desktop view
    const jobtreadActions = document.getElementById('jobtreadActions');
    if (jobtreadActions) {
        jobtreadActions.style.display = 'none';
    }

    renderRosterPanel();

    // Render appropriate view based on mode
    if (viewMode === 'crew') {
        renderCrewBoard(dates);
    } else {
        renderScheduleGrid(dates);
    }

    // Render insight badges in header
    renderInsightBadges();
}

/**
 * Mobile single-day card view
 */
function renderMobileSchedule() {
    const targetDate = getMobileDay();
    const dateKey = getDateKey(targetDate);

    // Format date for display
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const dayNum = targetDate.getDate();

    // Determine if this is today, tomorrow, etc.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
    let dayLabel = '';
    if (diffDays === 0) dayLabel = ' (Today)';
    else if (diffDays === 1) dayLabel = ' (Tomorrow)';
    else if (diffDays === -1) dayLabel = ' (Yesterday)';

    // Update header
    const label = document.getElementById('scheduleWeekRange');
    if (label) {
        label.innerHTML = `${dayName}, ${monthName} ${dayNum}${dayLabel}`;
    }

    // Show JobTread actions in mobile view
    const jobtreadActions = document.getElementById('jobtreadActions');
    if (jobtreadActions) {
        jobtreadActions.style.display = 'flex';
    }

    // Render mobile roster
    renderMobileRoster(targetDate, dateKey);

    // Render mobile job cards
    renderMobileJobCards(targetDate, dateKey);
}

/**
 * Toggle roster tray collapse/expand
 */
function toggleRosterTray() {
    const tray = document.getElementById('rosterTray');
    const btn = document.getElementById('rosterTrayToggle');
    const scheduleBody = document.querySelector('.schedule-body');
    if (!tray || !btn) return;

    tray.classList.toggle('collapsed');

    // Remove padding from schedule body when roster is collapsed
    if (scheduleBody) {
        scheduleBody.classList.toggle('roster-collapsed');
    }

    if (tray.classList.contains('collapsed')) {
        btn.title = 'Expand roster';
    } else {
        btn.title = 'Collapse roster';
    }
}

/**
 * Switch to a specific view (job or crew)
 */
function switchToView(view) {
    viewMode = view;
    renderSchedule();

    // Update button states
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = view === 'job' ? document.getElementById('jobViewBtn') : document.getElementById('workerViewBtn');
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * Set division filter
 */
function setDivisionFilter(division) {
    divisionFilter = division;
    renderSchedule();

    // Update select element
    const select = document.getElementById('divisionSelect');
    if (select) {
        select.value = division;
    }
}

/**
 * Toggle the More menu dropdown
 */
function toggleMoreMenu() {
    const menu = document.getElementById('moreMenu');
    if (menu) {
        // Check computed style instead of inline style
        const isVisible = window.getComputedStyle(menu).display !== 'none';
        menu.style.display = isVisible ? 'none' : 'block';
    }
}

/**
 * Activate a day for roster filtering
 */
function activateDay(dateKey, dayElement) {
    // Toggle: if clicking same day, deactivate
    if (activeDateKey === dateKey) {
        activeDateKey = null;
    } else {
        activeDateKey = dateKey;
    }

    // Update UI
    renderSchedule();

    // Update active day label
    const label = document.getElementById('activeDayLabel');
    if (label) {
        if (activeDateKey) {
            const date = new Date(activeDateKey.replace(/_/g, '/'));
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = dayNames[date.getDay()];
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            label.textContent = `${dayName} ${dateStr}`;
            label.classList.add('active');
        } else {
            label.textContent = 'Click a day to filter';
            label.classList.remove('active');
        }
    }
}

/**
 * Render the team roster panel (left side)
 */
function renderRosterPanel() {
    const filter = document.getElementById('rosterDivisionFilter');
    const filterVal = filter ? filter.value : 'all';
    const container = document.getElementById('rosterWorkers');
    if (!container) return;

    let filtered = filterVal === 'all'
        ? workers
        : workers.filter(w => w.division === filterVal || w.division === 'both');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="roster-empty">No workers available</div>';
        return;
    }

    // Sort by position (foreman > journeyman > apprentice), then alphabetically by name
    const roleOrder = { 'foreman': 1, 'journeyman': 2, 'apprentice': 3 };
    filtered.sort((a, b) => {
        const roleCompare = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        if (roleCompare !== 0) return roleCompare;
        return a.name.localeCompare(b.name);
    });

    // Calculate scheduled days for each worker in visible weeks (18 days = 3 weeks × 6 days)
    const totalDays = 18;
    const workerScheduleCounts = {};

    // Get all dates for 3 weeks
    const dates = [];
    for (let week = 0; week < 3; week++) {
        const monday = getWeekMonday(scheduleWeekOffset + week);
        for (let day = 0; day < 6; day++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + day);
            dates.push(date);
        }
    }

    // Count scheduled days for each worker
    workers.forEach(w => {
        let scheduledDays = 0;
        dates.forEach(date => {
            const dateKey = getDateKey(date);
            // Check if worker is scheduled on any job this day
            const isScheduled = Object.keys(dailySchedule).some(key => {
                if (key.includes(dateKey)) {
                    const slot = dailySchedule[key];
                    return slot && slot.assigned && slot.assigned.includes(w.id);
                }
                return false;
            });
            // Also check if on vacation
            const vacKey = `${w.id}_${dateKey}`;
            const isOnVacation = vacationSchedule[vacKey];

            if (isScheduled || isOnVacation) {
                scheduledDays++;
            }
        });
        workerScheduleCounts[w.id] = scheduledDays;
    });

    container.innerHTML = filtered.map(w => {
        const scheduledDays = workerScheduleCounts[w.id] || 0;
        const availableDays = totalDays - scheduledDays;
        const isSelected = selectedWorkerId === w.id;

        // Determine availability state for active day
        let availabilityClass = '';
        let availabilityStatus = '';
        if (activeDateKey) {
            // Check if on vacation
            const vacKey = `${w.id}_${activeDateKey}`;
            if (vacationSchedule[vacKey]) {
                availabilityClass = 'worker-on-vacation';
                availabilityStatus = ' (On vacation)';
            } else {
                // Check if already assigned
                const isAssigned = Object.keys(dailySchedule).some(key => {
                    if (key.endsWith(`_${activeDateKey}`)) {
                        const slot = dailySchedule[key];
                        return slot && slot.assigned && slot.assigned.includes(w.id);
                    }
                    return false;
                });
                availabilityClass = isAssigned ? 'worker-assigned' : 'worker-available';
                availabilityStatus = isAssigned ? ' (Already assigned)' : ' (Available)';
            }
        }

        return `
        <div class="worker-chip worker-chip-compact worker-chip-${w.role} ${isSelected ? 'worker-selected' : ''} ${availabilityClass}"
             data-worker-id="${w.id}"
             draggable="true"
             ondragstart="dragWorkerStart(event, ${w.id}, null, null)"
             onclick="toggleWorkerSelection(${w.id})"
             title="${w.name} — ${w.role}${w.isForeman ? ' (Foreman)' : ''}${availabilityStatus}\n${scheduledDays} days scheduled, ${availableDays} available\nClick to select for quick assignment">
            <span class="chip-name">${w.name}</span>
            <span class="chip-role">${w.role}${w.isForeman ? ' ★' : ''}</span>
        </div>
    `;
    }).join('');
}

/**
 * Render the schedule grid with daily columns
 */
function renderScheduleGrid(dates) {
    const container = document.getElementById('scheduleGrid');
    if (!container) {
        console.error('scheduleGrid container not found!');
        return;
    }

    // Filter by active and division
    let activeJobs = jobs.filter(j => j.active);
    if (divisionFilter !== 'both') {
        activeJobs = activeJobs.filter(j => j.division === divisionFilter);
    }
    console.log(`Rendering schedule with ${activeJobs.length} active jobs (division: ${divisionFilter}) and ${workers.length} workers`);

    // Build table header with daily columns
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = `<table class="schedule-table">
        <thead>
            <tr class="week-headers">
                <th class="col-job">Job Site</th>`;

    // Week headers (3 weeks) with completion indicator
    for (let week = 0; week < 3; week++) {
        const weekStart = getWeekMonday(scheduleWeekOffset + week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5); // Saturday
        const weekLabel = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;

        // Check if week is fully staffed
        let weekFullyStaffed = true;
        for (let day = 0; day < 6; day++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + day);
            const dateKey = getDateKey(date);

            // Calculate needed vs assigned for this day
            let totalNeeded = 0;
            const assignedWorkerIds = new Set();
            Object.keys(dailySchedule).forEach(key => {
                if (key.endsWith(`_${dateKey}`)) {
                    const slot = dailySchedule[key];
                    totalNeeded += parseInt(slot.demand) || 0;
                    if (slot.assigned) {
                        slot.assigned.forEach(wId => assignedWorkerIds.add(wId));
                    }
                }
            });

            // If any day has unmet demand, week is not fully staffed
            if (totalNeeded > 0 && assignedWorkerIds.size < totalNeeded) {
                weekFullyStaffed = false;
                break;
            }
        }

        const weekClass = weekFullyStaffed ? 'week-complete' : '';
        html += `<th class="col-week-header ${weekClass}" colspan="6">${weekLabel}</th>`;
    }

    html += `</tr><tr class="day-headers">
                <th class="col-job"></th>`;

    // Day headers (18 columns = 3 weeks × 6 days) with dates - green when fully staffed
    dates.forEach(date => {
        const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const dateKey = getDateKey(date);
        const activeClass = activeDateKey === dateKey ? 'day-active' : '';

        // Check if this day is fully staffed
        let totalNeeded = 0;
        const assignedWorkerIds = new Set();
        Object.keys(dailySchedule).forEach(key => {
            if (key.endsWith(`_${dateKey}`)) {
                const slot = dailySchedule[key];
                totalNeeded += parseInt(slot.demand) || 0;
                if (slot.assigned) {
                    slot.assigned.forEach(wId => assignedWorkerIds.add(wId));
                }
            }
        });
        const isFullyStaffed = totalNeeded > 0 && assignedWorkerIds.size >= totalNeeded;
        const fullyStaffedClass = isFullyStaffed ? 'day-fully-staffed' : '';

        html += `<th class="col-day ${activeClass} ${fullyStaffedClass}" onclick="activateDay('${dateKey}', this)" style="cursor: pointer;" title="Click to filter available workers">
            ${dayName}<br><small>${dateStr}</small>
            <div class="day-jobtread-actions">
                <span class="jobtread-icon jobtread-push" onclick="event.stopPropagation(); pushDayToJobTread('${dateKey}')" title="Push to JobTread">📤</span>
                <span class="jobtread-icon jobtread-delete" onclick="event.stopPropagation(); deleteDayFromJobTread('${dateKey}')" title="Delete from JobTread">🗑️</span>
            </div>
        </th>`;
    });

    html += `</tr></thead><tbody>`;

    // Add worker availability tally row with progress bars
    html += `<tr class="tally-row">
        <td class="col-job-name">
            <strong>Daily Staffing</strong>
            <div class="tally-legend">
                <span class="legend-item">Hover to see counts</span>
            </div>
        </td>`;

    dates.forEach(date => {
        const dateKey = getDateKey(date);

        // Calculate NEEDED (sum of all job demands for this day)
        let totalNeeded = 0;
        Object.keys(dailySchedule).forEach(key => {
            if (key.endsWith(`_${dateKey}`)) {
                const slot = dailySchedule[key];
                totalNeeded += parseInt(slot.demand) || 0;
            }
        });

        // Calculate ASSIGNED (unique workers assigned to jobs on this date)
        const assignedWorkerIds = new Set();
        Object.keys(dailySchedule).forEach(key => {
            if (key.endsWith(`_${dateKey}`)) {
                const slot = dailySchedule[key];
                if (slot.assigned) {
                    slot.assigned.forEach(wId => assignedWorkerIds.add(wId));
                }
            }
        });
        const assignedCount = assignedWorkerIds.size;

        // Calculate AVAILABLE (total workers minus those on vacation)
        const vacationCount = Object.keys(vacationSchedule).filter(key =>
            key.endsWith(`_${dateKey}`) && vacationSchedule[key]
        ).length;
        const totalWorkers = workers.length;
        const availableCount = totalWorkers - vacationCount;

        // Calculate progress bar width (assigned / needed * 100%)
        const progressPercent = totalNeeded > 0 ? Math.min((assignedCount / totalNeeded) * 100, 100) : 0;

        // Determine cell status color
        let tallyClass = 'tally-neutral';
        if (totalNeeded > 0) {
            if (assignedCount < totalNeeded) tallyClass = 'tally-short';
            else if (assignedCount === totalNeeded) tallyClass = 'tally-perfect';
            else tallyClass = 'tally-over';
        }

        html += `<td class="tally-cell ${tallyClass}" title="Need ${totalNeeded} | Assigned ${assignedCount} | Available ${availableCount}">
            <div class="tally-box-display">
                <div class="tally-box-bar" style="width: ${progressPercent}%"></div>
                <div class="tally-box-text">
                    <span class="tally-needed">${totalNeeded}</span> /
                    <span class="tally-assigned">${assignedCount}</span>
                </div>
            </div>
        </td>`;
    });

    html += `</tr>`;

    // Add Vacation/Time Off row (after tally row)
    html += `<tr class="vacation-row">
        <td class="col-job-name">
            <div class="sched-job-name">🏖️ Vacation / Time Off</div>
            <div class="sched-job-div badge-vacation">Time Off</div>
        </td>`;

    dates.forEach(date => {
        const dateKey = getDateKey(date);

        // Find workers on vacation this day
        const vacationWorkers = workers.filter(w => {
            const vacKey = `${w.id}_${dateKey}`;
            return vacationSchedule[vacKey];
        });

        html += `<td class="schedule-cell cell-vacation"
                     ondragover="event.preventDefault(); this.classList.add('drag-over')"
                     ondragleave="this.classList.remove('drag-over')"
                     ondrop="dropWorkerToVacation(event, '${dateKey}')">
            <div class="cell-workers">
                ${vacationWorkers.map(w => `
                    <div class="worker-chip-mini worker-chip-${w.role}"
                         draggable="true"
                         ondragstart="dragWorkerStart(event, ${w.id}, 'vacation', '${dateKey}')"
                         onclick="removeVacation(${w.id}, '${dateKey}'); event.stopPropagation();"
                         title="${w.name} - Time Off (click to remove)">
                        <span class="chip-name-mini">${formatWorkerName(w)}</span>
                    </div>
                `).join('')}
            </div>
        </td>`;
    });

    html += `</tr>`;

    if (activeJobs.length === 0) {
        html += `<tr><td colspan="19" class="schedule-empty-row">No active jobs. Click "+ Add Job" to get started.</td></tr>`;
    } else {
        activeJobs.forEach(job => {
            html += `<tr class="job-row"
                         draggable="true"
                         ondragstart="dragJobStart(event, ${job.id})"
                         ondragover="dragJobOver(event, ${job.id})"
                         ondrop="dropJob(event, ${job.id})"
                         ondragend="dragJobEnd(event)">
                <td class="col-job-name job-name-cell">
                    <div class="job-info-wrapper">
                        <div class="job-drag-handle"
                             draggable="true"
                             ondragstart="dragJobStart(event, ${job.id})"
                             title="Drag to reorder">
                            ⋮⋮
                        </div>
                        <div class="job-info">
                            <div class="sched-job-name">
                                ${job.name}
                                ${renderStaffingStatusIndicator(job.id)}
                            </div>
                            <div class="sched-job-div badge-${job.division}">${job.division}</div>
                        </div>
                        <div class="job-actions">
                            <button class="job-action-btn edit-btn" onclick="editJob(${job.id}); event.stopPropagation();" title="Edit">✎</button>
                            <button class="job-action-btn archive-btn" onclick="archiveJob(${job.id}); event.stopPropagation();" title="Archive">📦</button>
                            <button class="job-action-btn remove-btn" onclick="removeJob(${job.id}); event.stopPropagation();" title="Delete">×</button>
                        </div>
                    </div>
                </td>`;

            // Render each day cell
            dates.forEach(date => {
                const dateKey = getDateKey(date);
                const slotKey = `${job.id}_${dateKey}`;
                const slot = dailySchedule[slotKey] || { demand: 0, assigned: [] };
                const demand = parseInt(slot.demand) || 0;
                const assigned = (slot.assigned || []).filter(id => workers.find(w => w.id === id));

                // Determine cell status color
                let statusClass = 'cell-active';
                if (demand === 0) statusClass = 'cell-no-demand';
                else if (assigned.length === 0) statusClass = 'cell-empty';
                else if (assigned.length < demand) statusClass = 'cell-short';
                else if (assigned.length === demand) statusClass = 'cell-full';
                else statusClass = 'cell-over';

                const assignedWorkers = assigned.map(id => workers.find(w => w.id === id)).filter(Boolean);

                // Check if this cell is selected
                const isSelected = isCellSelected(job.id, dateKey);
                const selectedClass = isSelected ? 'cell-selected' : '';
                const isPrimaryCell = getPrimaryCell() && getPrimaryCell().jobId === job.id && getPrimaryCell().dateKey === dateKey;

                html += `<td class="schedule-cell ${statusClass} ${selectedClass} ${selectedWorkerId ? 'click-assign-mode' : ''}"
                             data-job-id="${job.id}"
                             data-date-key="${dateKey}"
                             ondragover="handleCellDragOver(event, ${job.id}, '${dateKey}')"
                             ondragleave="this.classList.remove('drag-over')"
                             ondrop="handleCellDrop(event, ${job.id}, '${dateKey}')"
                             onclick="handleCellClick(${job.id}, '${dateKey}', event)"
                             title="Click to select, Ctrl/Cmd+Click for multiple, type to search, Cmd+R to copy">
                    <div class="cell-demand-row">
                        <input type="number" class="demand-input" value="${demand}" min="0" max="9"
                               onchange="setDemand(${job.id}, '${dateKey}', this.value)"
                               onclick="event.stopPropagation()"
                               title="PM: Set daily manpower need">
                        <span class="assigned-count ${planningMode ? 'planning-count' : ''}">${assigned.length}</span>
                    </div>
                    ${!planningMode ? `
                        <div class="cell-workers">
                            ${assignedWorkers.map(w => `
                                <div class="worker-chip-mini worker-chip-${w.role}"
                                     draggable="true"
                                     ondragstart="dragWorkerStart(event, ${w.id}, ${job.id}, '${dateKey}')"
                                     onclick="removeScheduleWorker(${job.id}, '${dateKey}', ${w.id}); event.stopPropagation();"
                                     title="${w.name} (click to remove)">
                                    <span class="chip-name-mini">${formatWorkerName(w)}</span>
                                </div>
                            `).join('')}
                        </div>
                        ${assignedWorkers.length > 0 ? `
                            <div class="crew-copy-handle"
                                 draggable="true"
                                 ondragstart="startCrewCopy(event, ${job.id}, '${dateKey}')"
                                 ondragend="endCrewCopy(event)"
                                 title="Drag to copy crew across days ⇒">
                                ⇒
                            </div>
                        ` : ''}
                        ${isPrimaryCell && typeaheadResults.length > 0 ? `
                            <div class="typeahead-dropdown">
                                <div class="typeahead-header">Search: "${typeaheadBuffer}"</div>
                                ${typeaheadResults.map((w, idx) => `
                                    <div class="typeahead-item ${idx === typeaheadSelectedIndex ? 'selected' : ''}"
                                         onclick="assignWorkerFromTypeahead(); event.stopPropagation();">
                                        ${w.name} <span class="typeahead-role">(${w.role})</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    ` : ''}
                </td>`;
            });

            html += `</tr>`;
        });
    }

    html += `</tbody></table>`;

    // Add archived jobs section
    const archivedJobs = jobs.filter(j => !j.active);
    if (archivedJobs.length > 0) {
        html += `
            <div class="archived-section">
                <button class="archived-toggle-btn" onclick="toggleArchivedJobs()">
                    ${showArchivedJobs ? '▼' : '▶'} Archived Jobs (${archivedJobs.length})
                </button>
                ${showArchivedJobs ? `
                    <div class="archived-jobs-list">
                        ${archivedJobs.map(job => `
                            <div class="archived-job-card">
                                <div class="archived-job-info">
                                    <strong>${job.name}</strong>
                                    <span class="badge badge-${job.division}">${job.division}</span>
                                    ${job.location ? `<div class="archived-job-location">${job.location}</div>` : ''}
                                </div>
                                <button class="btn-unarchive" onclick="unarchiveJob(${job.id})">Unarchive</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    container.innerHTML = html;
    console.log(`Schedule rendered. HTML length: ${html.length} characters`);
}

// ============================================================================
// Mobile View Rendering
// ============================================================================

/**
 * Assign colors to jobs for crew board visualization
 */
function assignJobColors() {
    // Excel-like pastel colors optimized for dark text readability
    const colors = [
        '#B4D7FF', // Light Blue
        '#FFD9B3', // Light Orange
        '#C5E1A5', // Light Green
        '#FFF4B3', // Light Yellow
        '#E1BEE7', // Light Purple
        '#B2EBF2', // Light Cyan
        '#FFCCDC', // Light Pink
        '#CFD8DC', // Light Blue Grey
        '#DCEDC8', // Pale Green
        '#FFE0B2'  // Pale Orange
    ];

    jobs.forEach((job, index) => {
        if (!jobColors[job.id]) {
            jobColors[job.id] = colors[index % colors.length];
        }
    });
}

/**
 * Render Crew Board view (worker-centric)
 */
function renderCrewBoard(dates) {
    assignJobColors();

    const container = document.getElementById('scheduleGrid');
    if (!container) return;

    // Filter jobs based on division
    let filteredJobs = jobs.filter(j => j.active);
    if (divisionFilter !== 'both') {
        filteredJobs = filteredJobs.filter(j => j.division === divisionFilter);
    }

    // Filter workers based on division
    let filteredWorkers = workers;
    if (divisionFilter !== 'both') {
        filteredWorkers = workers.filter(w => w.division === divisionFilter || w.division === 'both');
    }

    // Sort workers: foremen first, then by name
    filteredWorkers.sort((a, b) => {
        if (a.isForeman && !b.isForeman) return -1;
        if (!a.isForeman && b.isForeman) return 1;
        return a.name.localeCompare(b.name);
    });

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = `<table class="schedule-table crew-board-table">
        <thead>
            <tr class="week-headers">
                <th class="col-worker">Worker</th>`;

    // Week headers
    for (let week = 0; week < 3; week++) {
        const weekStart = getWeekMonday(scheduleWeekOffset + week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5);
        const weekLabel = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;
        html += `<th class="col-week-header" colspan="6">${weekLabel}</th>`;
    }

    html += `</tr><tr class="day-headers">
                <th class="col-worker"></th>`;

    // Day headers
    dates.forEach(date => {
        const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        html += `<th class="col-day-crew">${dayName}<br><small>${dateStr}</small></th>`;
    });

    html += `</tr></thead><tbody>`;

    // Render each worker as a row
    filteredWorkers.forEach(worker => {
        const foremanBadge = worker.isForeman ? ' <span class="foreman-star">★</span>' : '';
        html += `<tr class="worker-row">
            <td class="col-worker-name">
                ${worker.name}${foremanBadge}
                <div class="worker-role-badge badge-${worker.role}">${worker.role}</div>
            </td>`;

        // Render each day cell for this worker
        dates.forEach(date => {
            const dateKey = getDateKey(date);

            // Find all jobs this worker is assigned to on this day
            const assignedJobs = [];
            Object.keys(dailySchedule).forEach(key => {
                if (key.endsWith(`_${dateKey}`)) {
                    const jobId = parseInt(key.split('_')[0]);
                    const slot = dailySchedule[key];

                    if (slot.assigned && slot.assigned.includes(worker.id)) {
                        const job = filteredJobs.find(j => j.id === jobId);
                        if (job) {
                            assignedJobs.push(job);
                        }
                    }
                }
            });

            let cellContent = '';
            let cellStyle = '';

            if (assignedJobs.length > 0) {
                // Worker is assigned to job(s) on this day
                const job = assignedJobs[0]; // For now, show first job
                const color = jobColors[job.id];
                cellContent = job.name;
                cellStyle = `background-color: ${color}; color: #333; font-weight: 600;`;
            } else {
                // Worker not assigned
                cellContent = '';
                cellStyle = 'background-color: #f5f5f5; color: #333;';
            }

            html += `<td class="crew-day-cell" style="${cellStyle}" title="${cellContent}">${cellContent}</td>`;
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;

    // Add legend
    html += `<div class="crew-board-legend">`;
    filteredJobs.forEach(job => {
        const color = jobColors[job.id];
        html += `<span class="legend-item" style="background-color: ${color};">${job.name}</span>`;
    });
    html += `</div>`;

    container.innerHTML = html;
}

/**
 * Render mobile roster (collapsible)
 */
function renderMobileRoster(targetDate, dateKey) {
    const container = document.getElementById('scheduleRoster');
    if (!container) return;

    const divisionFilter = document.getElementById('rosterDivisionFilter')?.value || 'all';
    let filtered = workers.filter(w => {
        if (w.archived) return false;
        if (divisionFilter === 'all') return true;
        return w.division === divisionFilter || w.division === 'both';
    });

    // Check if each worker is scheduled today
    const workersWithStatus = filtered.map(w => {
        const isScheduled = Object.keys(dailySchedule).some(key => {
            if (key.includes(dateKey)) {
                const slot = dailySchedule[key];
                return slot && slot.assigned && slot.assigned.includes(w.id);
            }
            return false;
        });
        const vacKey = `${w.id}_${dateKey}`;
        const isOnVacation = vacationSchedule[vacKey];

        return { ...w, isScheduled, isOnVacation };
    });

    const available = workersWithStatus.filter(w => !w.isScheduled && !w.isOnVacation);
    const scheduled = workersWithStatus.filter(w => w.isScheduled);
    const onVacation = workersWithStatus.filter(w => w.isOnVacation);

    container.innerHTML = `
        <div class="mobile-roster">
            <div class="roster-header-mobile">
                <h3>Team Roster <span class="badge-count">${workers.length}</span></h3>
                <select id="rosterDivisionFilter" onchange="renderSchedule()">
                    <option value="all">All</option>
                    <option value="commercial">Commercial</option>
                    <option value="residential">Residential</option>
                </select>
            </div>

            ${available.length > 0 ? `
                <div class="mobile-roster-section">
                    <h4>✅ Available (${available.length})</h4>
                    <div class="mobile-worker-list">
                        ${available.map(w => `
                            <div class="mobile-worker-chip mobile-worker-chip-${w.role}"
                                 data-worker-id="${w.id}"
                                 onclick="showAssignWorkerModal(${w.id}, '${dateKey}')">
                                <div class="worker-icon">👷</div>
                                <div class="worker-info">
                                    <div class="worker-name">${w.name}</div>
                                    <div class="worker-role">${w.role}</div>
                                </div>
                                <div class="worker-action">+</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${scheduled.length > 0 ? `
                <div class="mobile-roster-section">
                    <h4>🔧 Scheduled (${scheduled.length})</h4>
                    <div class="mobile-worker-list">
                        ${scheduled.map(w => `
                            <div class="mobile-worker-chip mobile-worker-chip-scheduled">
                                <div class="worker-icon">👷</div>
                                <div class="worker-info">
                                    <div class="worker-name">${w.name}</div>
                                    <div class="worker-role">${w.role}</div>
                                </div>
                                <div class="worker-status">Assigned</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${onVacation.length > 0 ? `
                <div class="mobile-roster-section">
                    <h4>🏖️ On Vacation (${onVacation.length})</h4>
                    <div class="mobile-worker-list">
                        ${onVacation.map(w => `
                            <div class="mobile-worker-chip mobile-worker-chip-vacation">
                                <div class="worker-icon">🏖️</div>
                                <div class="worker-info">
                                    <div class="worker-name">${w.name}</div>
                                    <div class="worker-role">${w.role}</div>
                                </div>
                                <button class="worker-action-btn" onclick="removeVacation(${w.id}, '${dateKey}'); event.stopPropagation();">×</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Restore filter value
    if (divisionFilter !== 'all') {
        const filterSelect = document.getElementById('rosterDivisionFilter');
        if (filterSelect) filterSelect.value = divisionFilter;
    }
}

/**
 * Render mobile job cards for the day
 */
function renderMobileJobCards(targetDate, dateKey) {
    const container = document.getElementById('scheduleGrid');
    if (!container) return;

    const activeJobs = jobs.filter(j => !j.archived);

    // Get jobs that have work scheduled for this day
    const jobsForDay = activeJobs.map(job => {
        const slotKey = `${job.id}_${dateKey}`;
        const slot = dailySchedule[slotKey] || { demand: 0, assigned: [] };
        const assignedWorkers = (slot.assigned || []).map(wId => workers.find(w => w.id === wId)).filter(Boolean);

        return { ...job, slot, assignedWorkers };
    });

    if (jobsForDay.length === 0) {
        container.innerHTML = `
            <div class="mobile-no-jobs">
                <p>No jobs available.</p>
                <button class="btn-primary" onclick="showAddJobModal()">+ Add Job</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="mobile-job-list">
            ${jobsForDay.map(job => {
                const needed = job.slot.demand || 0;
                const assigned = job.assignedWorkers.length;
                const isFull = needed > 0 && assigned >= needed;
                const isEmpty = needed > 0 && assigned === 0;
                const isShort = needed > 0 && assigned > 0 && assigned < needed;
                const isOver = assigned > needed && needed > 0;

                let statusClass = 'status-none';
                let statusText = 'No crew needed';
                if (isEmpty) {
                    statusClass = 'status-empty';
                    statusText = '⚠️ Needs crew';
                } else if (isShort) {
                    statusClass = 'status-short';
                    statusText = `📋 ${assigned}/${needed} staffed`;
                } else if (isFull) {
                    statusClass = 'status-full';
                    statusText = '✅ Fully staffed';
                } else if (isOver) {
                    statusClass = 'status-over';
                    statusText = `📊 Overstaffed (${assigned}/${needed})`;
                }

                return `
                    <div class="mobile-job-card ${statusClass}">
                        <div class="job-card-header">
                            <div class="job-card-title">
                                <h3>${job.name}</h3>
                                <span class="badge badge-${job.division}">${job.division}</span>
                            </div>
                            <button class="job-menu-btn" onclick="showJobMenu(${job.id}, '${dateKey}')">⋮</button>
                        </div>

                        ${job.location ? `<div class="job-card-location">📍 ${job.location}</div>` : ''}

                        <div class="job-card-stats">
                            <div class="stat-box">
                                <span class="stat-label">Need</span>
                                <input type="number"
                                       class="stat-value stat-input"
                                       value="${needed}"
                                       min="0"
                                       onchange="setDemand(${job.id}, '${dateKey}', this.value)"
                                       onclick="event.stopPropagation()">
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Got</span>
                                <span class="stat-value">${assigned}</span>
                            </div>
                        </div>

                        <div class="job-card-status ${statusClass}">
                            ${statusText}
                        </div>

                        ${job.assignedWorkers.length > 0 ? `
                            <div class="job-card-crew">
                                <h4>Assigned Crew:</h4>
                                <div class="crew-list">
                                    ${job.assignedWorkers.map(w => `
                                        <div class="crew-member crew-member-${w.role}">
                                            <div class="crew-icon">👷</div>
                                            <div class="crew-info">
                                                <span class="crew-name">${w.name}</span>
                                                <span class="crew-role">${w.role}</span>
                                            </div>
                                            <button class="crew-remove-btn"
                                                    onclick="removeScheduleWorker(${job.id}, '${dateKey}', ${w.id}); event.stopPropagation();">×</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : '<div class="job-card-empty">No crew assigned yet</div>'}

                        <button class="job-assign-btn" onclick="showAssignToJobModal(${job.id}, '${dateKey}')">
                            + Assign Worker
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============================================================================
// Drag & Drop Handlers
// ============================================================================

// Job reordering drag handlers
function dragJobStart(event, jobId) {
    draggingJobId = jobId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(jobId));
    event.target.closest('tr').classList.add('dragging');
}

function dragJobOver(event, targetJobId) {
    event.preventDefault();
    if (draggingJobId === null || draggingJobId === targetJobId) return;
    event.dataTransfer.dropEffect = 'move';

    // Remove all existing drop indicators
    document.querySelectorAll('.job-row').forEach(row => {
        row.classList.remove('drop-above', 'drop-below');
    });

    // Add visual indicator
    const dragIndex = jobs.findIndex(j => j.id === draggingJobId);
    const targetIndex = jobs.findIndex(j => j.id === targetJobId);
    const targetRow = event.target.closest('tr');

    if (targetRow && dragIndex !== -1 && targetIndex !== -1) {
        if (dragIndex < targetIndex) {
            targetRow.classList.add('drop-below');
        } else {
            targetRow.classList.add('drop-above');
        }
    }
}

function dropJob(event, targetJobId) {
    event.preventDefault();

    // Remove drop indicators
    document.querySelectorAll('.job-row').forEach(row => {
        row.classList.remove('drop-above', 'drop-below');
    });

    if (draggingJobId === null || draggingJobId === targetJobId) return;

    // Find current positions
    const dragIndex = jobs.findIndex(j => j.id === draggingJobId);
    const targetIndex = jobs.findIndex(j => j.id === targetJobId);

    if (dragIndex === -1 || targetIndex === -1) return;

    // Reorder the jobs array
    const [draggedJob] = jobs.splice(dragIndex, 1);
    jobs.splice(targetIndex, 0, draggedJob);

    draggingJobId = null;
    saveData();
    renderSchedule();
}

function dragJobEnd(event) {
    event.target.closest('tr')?.classList.remove('dragging');
    document.querySelectorAll('.job-row').forEach(row => {
        row.classList.remove('drop-above', 'drop-below');
    });
    draggingJobId = null;
}

// Worker drag handlers
function dragWorkerStart(event, workerId, fromJob, fromDate) {
    draggingWorkerId = workerId;
    draggingFromJob = fromJob;
    draggingFromDate = fromDate;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(workerId));
    // Prevent event from bubbling up to row drag handler
    event.stopPropagation();
}

function dropWorkerToCell(event, jobId, dateKey) {
    event.preventDefault();
    event.target.closest('.schedule-cell')?.classList.remove('drag-over');

    if (!draggingWorkerId) return;

    saveStateForUndo();

    const slotKey = `${jobId}_${dateKey}`;
    if (!dailySchedule[slotKey]) dailySchedule[slotKey] = { demand: 0, assigned: [] };
    if (!Array.isArray(dailySchedule[slotKey].assigned)) dailySchedule[slotKey].assigned = [];

    // Don't add duplicate
    if (dailySchedule[slotKey].assigned.includes(draggingWorkerId)) {
        draggingWorkerId = draggingFromJob = draggingFromDate = null;
        return;
    }

    // Check if worker is already assigned to a different job on this date
    const isAlreadyAssignedToday = Object.keys(dailySchedule).some(key => {
        if (!key.endsWith(`_${dateKey}`)) return false; // Different date
        if (key === slotKey) return false; // Same cell
        return dailySchedule[key].assigned && dailySchedule[key].assigned.includes(draggingWorkerId);
    });

    // Only block if dragging from roster - allow job-to-job moves on same day
    if (isAlreadyAssignedToday && draggingFromJob === null) {
        const worker = workers.find(w => w.id === draggingWorkerId);
        const workerName = worker ? worker.name : 'This worker';
        alert(`${workerName} is already assigned to another job on this day.`);
        draggingWorkerId = draggingFromJob = draggingFromDate = null;
        return;
    }

    // Remove from source cell if dragging between cells
    if (draggingFromJob !== null && draggingFromDate !== null) {
        const fromKey = `${draggingFromJob}_${draggingFromDate}`;
        if (dailySchedule[fromKey]) {
            dailySchedule[fromKey].assigned = dailySchedule[fromKey].assigned.filter(id => id !== draggingWorkerId);
        }
    }

    dailySchedule[slotKey].assigned.push(draggingWorkerId);
    saveData();
    renderSchedule();
    draggingWorkerId = draggingFromJob = draggingFromDate = null;
}

function dropWorkerToRoster(event) {
    event.preventDefault();
    document.getElementById('scheduleRoster')?.classList.remove('roster-drag-over');

    // Remove from source cell
    if (draggingFromJob !== null && draggingFromDate !== null) {
        if (draggingFromJob === 'vacation') {
            // Remove from vacation
            const vacKey = `${draggingWorkerId}_${draggingFromDate}`;
            delete vacationSchedule[vacKey];
        } else {
            // Remove from job
            const fromKey = `${draggingFromJob}_${draggingFromDate}`;
            if (dailySchedule[fromKey]) {
                dailySchedule[fromKey].assigned = dailySchedule[fromKey].assigned.filter(id => id !== draggingWorkerId);
            }
        }
        saveData();
        renderSchedule();
    }
    draggingWorkerId = draggingFromJob = draggingFromDate = null;
}

function dropWorkerToVacation(event, dateKey) {
    event.preventDefault();
    event.target.closest('.schedule-cell')?.classList.remove('drag-over');

    if (!draggingWorkerId) return;

    // Remove from source if dragging between cells
    if (draggingFromJob !== null && draggingFromDate !== null) {
        if (draggingFromJob === 'vacation') {
            const fromKey = `${draggingWorkerId}_${draggingFromDate}`;
            delete vacationSchedule[fromKey];
        } else {
            const fromKey = `${draggingFromJob}_${draggingFromDate}`;
            if (dailySchedule[fromKey]) {
                dailySchedule[fromKey].assigned = dailySchedule[fromKey].assigned.filter(id => id !== draggingWorkerId);
            }
        }
    }

    // Add to vacation
    const vacKey = `${draggingWorkerId}_${dateKey}`;
    vacationSchedule[vacKey] = true;

    saveData();
    renderSchedule();
    draggingWorkerId = draggingFromJob = draggingFromDate = null;
}

function removeVacation(workerId, dateKey) {
    const vacKey = `${workerId}_${dateKey}`;
    delete vacationSchedule[vacKey];
    saveData();
    renderSchedule();
}

function setDemand(jobId, dateKey, value) {
    saveStateForUndo();
    const slotKey = `${jobId}_${dateKey}`;
    if (!dailySchedule[slotKey]) dailySchedule[slotKey] = { demand: 0, assigned: [] };
    dailySchedule[slotKey].demand = parseInt(value) || 0;
    saveData();
    renderSchedule();
}

function removeScheduleWorker(jobId, dateKey, workerId) {
    saveStateForUndo();
    const slotKey = `${jobId}_${dateKey}`;
    if (dailySchedule[slotKey]) {
        dailySchedule[slotKey].assigned = dailySchedule[slotKey].assigned.filter(id => id !== workerId);
        saveData();
        renderSchedule();
    }
}

// ============================================================================
// Click-to-Assign Handlers (Alternative to Drag & Drop)
// ============================================================================

/**
 * Toggle worker selection for click-to-assign mode
 */
function toggleWorkerSelection(workerId) {
    if (selectedWorkerId === workerId) {
        // Deselect if clicking same worker
        selectedWorkerId = null;
    } else {
        // Select this worker
        selectedWorkerId = workerId;
    }
    renderSchedule();
}

/**
 * Handle cell click for keyboard navigation
 */
function handleCellClick(jobId, dateKey, event) {
    // If there's a selected worker (old click-to-assign mode), use that
    if (selectedWorkerId) {
        clickAssignWorker(jobId, dateKey);
        return;
    }

    // Check for multi-selection modifiers
    const isMultiSelect = event && (event.ctrlKey || event.metaKey);
    const isRangeSelect = event && event.shiftKey;

    if (isRangeSelect && lastClickedCell) {
        // Shift+Click: Select range from last clicked cell to this cell
        selectCellRange(lastClickedCell.jobId, lastClickedCell.dateKey, jobId, dateKey);
        // Keep the anchor from the start of the range
        if (!selectionAnchor) {
            selectionAnchor = {jobId: lastClickedCell.jobId, dateKey: lastClickedCell.dateKey};
        }
    } else if (isMultiSelect) {
        // Ctrl/Cmd+Click: Toggle this cell in the selection
        selectCell(jobId, dateKey, true);
        lastClickedCell = {jobId, dateKey};
        // Don't reset anchor for multi-select
    } else {
        // Check if this cell is the only selected cell
        const isOnlySelected = selectedCells.length === 1 &&
                               selectedCells[0].jobId === jobId &&
                               selectedCells[0].dateKey === dateKey;

        if (isOnlySelected) {
            // Clicking the only selected cell - deselect all
            deselectCell();
            lastClickedCell = null;
        } else {
            // Single select this cell
            selectCell(jobId, dateKey, false);
            lastClickedCell = {jobId, dateKey};
            selectionAnchor = {jobId, dateKey};
        }
    }
}

/**
 * Assign selected worker to a cell (click-to-assign)
 */
function clickAssignWorker(jobId, dateKey) {
    if (!selectedWorkerId) return;

    const slotKey = `${jobId}_${dateKey}`;
    if (!dailySchedule[slotKey]) dailySchedule[slotKey] = { demand: 0, assigned: [] };
    if (!Array.isArray(dailySchedule[slotKey].assigned)) dailySchedule[slotKey].assigned = [];

    // Don't add duplicate
    if (dailySchedule[slotKey].assigned.includes(selectedWorkerId)) {
        selectedWorkerId = null;
        renderSchedule();
        return;
    }

    // Check if worker is already assigned to a different job on this date
    const isAlreadyAssignedToday = Object.keys(dailySchedule).some(key => {
        if (!key.endsWith(`_${dateKey}`)) return false;
        if (key === slotKey) return false;
        return dailySchedule[key].assigned && dailySchedule[key].assigned.includes(selectedWorkerId);
    });

    if (isAlreadyAssignedToday) {
        const worker = workers.find(w => w.id === selectedWorkerId);
        const workerName = worker ? worker.name : 'This worker';
        alert(`${workerName} is already assigned to another job on this day.`);
        return;
    }

    // Assign worker
    dailySchedule[slotKey].assigned.push(selectedWorkerId);

    // Deselect after assignment
    selectedWorkerId = null;

    saveData();
    renderSchedule();
}

// ============================================================================
// Crew Copy Handlers
// ============================================================================

/**
 * Start crew copy operation (drag handle)
 */
function startCrewCopy(event, jobId, dateKey) {
    event.stopPropagation();

    const slotKey = `${jobId}_${dateKey}`;
    const slot = dailySchedule[slotKey];

    if (!slot || !slot.assigned || slot.assigned.length === 0) return;

    copyingCrewFromJob = jobId;
    copyingCrewFromDate = dateKey;
    copyingCrewWorkers = [...slot.assigned]; // Copy array

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', 'crew-copy');

    // Visual feedback
    event.target.closest('.schedule-cell').classList.add('copying-crew');
}

/**
 * Handle drag over for both worker drops and crew copy
 */
function handleCellDragOver(event, jobId, dateKey) {
    event.preventDefault();

    // Check if we're in crew copy mode
    if (copyingCrewFromJob !== null) {
        // Only allow dropping on same job
        if (jobId === copyingCrewFromJob) {
            event.dataTransfer.dropEffect = 'copy';
            event.target.closest('.schedule-cell')?.classList.add('crew-copy-target');
        } else {
            event.dataTransfer.dropEffect = 'none';
        }
    } else {
        // Normal worker drag
        event.dataTransfer.dropEffect = 'move';
        event.target.closest('.schedule-cell')?.classList.add('drag-over');
    }
}

/**
 * Handle drop for both worker drops and crew copy
 */
function handleCellDrop(event, jobId, dateKey) {
    event.preventDefault();
    const cell = event.target.closest('.schedule-cell');
    cell?.classList.remove('drag-over', 'crew-copy-target');

    // Check if we're in crew copy mode
    if (copyingCrewFromJob !== null && copyingCrewFromJob === jobId) {
        saveStateForUndo();
        // Crew copy mode - copy all workers from source to target
        const slotKey = `${jobId}_${dateKey}`;
        if (!dailySchedule[slotKey]) dailySchedule[slotKey] = { demand: 0, assigned: [] };
        if (!Array.isArray(dailySchedule[slotKey].assigned)) dailySchedule[slotKey].assigned = [];

        // Copy workers (avoiding duplicates)
        copyingCrewWorkers.forEach(workerId => {
            if (!dailySchedule[slotKey].assigned.includes(workerId)) {
                dailySchedule[slotKey].assigned.push(workerId);
            }
        });

        saveData();
        renderSchedule();
    } else if (draggingWorkerId) {
        // Normal worker drop
        dropWorkerToCell(event, jobId, dateKey);
    }
}

/**
 * End crew copy operation
 */
function endCrewCopy(event) {
    // Clean up crew copy state
    document.querySelectorAll('.copying-crew, .crew-copy-target').forEach(el => {
        el.classList.remove('copying-crew', 'crew-copy-target');
    });

    copyingCrewFromJob = null;
    copyingCrewFromDate = null;
    copyingCrewWorkers = [];
}

// ============================================================================
// Data Persistence (Firebase / localStorage)
// ============================================================================

/**
 * Save data to Firebase or localStorage
 */
function saveData() {
    if (database) {
        database.ref('workers').set(workers);
        database.ref('jobs').set(jobs);
        database.ref('dailySchedule').set(dailySchedule);
        database.ref('vacationSchedule').set(vacationSchedule);
        database.ref('jobtreadGrantKey').set(jobtreadGrantKey);
        database.ref('jobtreadTaskIds').set(jobtreadTaskIds);
    } else {
        localStorage.setItem('workers', JSON.stringify(workers));
        localStorage.setItem('jobs', JSON.stringify(jobs));
        localStorage.setItem('dailySchedule', JSON.stringify(dailySchedule));
        localStorage.setItem('vacationSchedule', JSON.stringify(vacationSchedule));
        localStorage.setItem('jobtreadGrantKey', jobtreadGrantKey);
        localStorage.setItem('jobtreadTaskIds', JSON.stringify(jobtreadTaskIds));
    }
}

/**
 * Initialize data from Firebase or localStorage
 */
function initializeData() {
    if (database) {
        database.ref('workers').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                workers = data;
                renderWorkers();
                renderSchedule();
            }
        });

        database.ref('jobs').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                jobs = data;
                renderJobs();
                renderSchedule();
            }
        });

        database.ref('dailySchedule').on('value', (snapshot) => {
            const data = snapshot.val();
            dailySchedule = data || {};
            renderSchedule();
        });

        database.ref('vacationSchedule').on('value', (snapshot) => {
            const data = snapshot.val();
            vacationSchedule = data || {};
            renderSchedule();
        });

        database.ref('jobtreadGrantKey').on('value', (snapshot) => {
            jobtreadGrantKey = snapshot.val() || '';
        });

        database.ref('jobtreadTaskIds').on('value', (snapshot) => {
            jobtreadTaskIds = snapshot.val() || {};
        });
    } else {
        workers = JSON.parse(localStorage.getItem('workers')) || [];
        jobs = JSON.parse(localStorage.getItem('jobs')) || [];
        dailySchedule = JSON.parse(localStorage.getItem('dailySchedule')) || {};
        vacationSchedule = JSON.parse(localStorage.getItem('vacationSchedule')) || {};
        jobtreadGrantKey = localStorage.getItem('jobtreadGrantKey') || '';
        jobtreadTaskIds = JSON.parse(localStorage.getItem('jobtreadTaskIds')) || {};

        // For POC: Set grant key if empty
        if (!jobtreadGrantKey) {
            jobtreadGrantKey = '22TLZYSAhsCX5uzg3ERPfucaNDiHWAerxL';
            saveData();
        }

        renderWorkers();
        renderJobs();
        renderSchedule();
    }
}

// ============================================================================
// Print Functions
// ============================================================================

/**
 * Show print modal with week options
 */
function showPrintModal() {
    const modal = document.getElementById('printModal');
    if (!modal) return;

    // Populate week date ranges
    for (let i = 0; i < 4; i++) {
        const weekOffset = scheduleWeekOffset + i;
        const monday = getWeekMonday(weekOffset);
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);

        const dateStr = `${formatDateShort(monday)} – ${formatDateShort(saturday)}`;
        const dateElement = document.getElementById(`printWeek${i}Date`);
        if (dateElement) {
            dateElement.textContent = dateStr;
        }
    }

    // Default to current week (scheduleWeekOffset)
    const radioButtons = document.querySelectorAll('input[name="printWeek"]');
    radioButtons.forEach((radio, index) => {
        radio.value = String(scheduleWeekOffset + index);
        radio.checked = (index === 0);
    });

    modal.classList.add('active');
}

/**
 * Close print modal
 */
function closePrintModal() {
    document.getElementById('printModal')?.classList.remove('active');
}

/**
 * Print the selected week
 */
function printSelectedWeek() {
    const selectedRadio = document.querySelector('input[name="printWeek"]:checked');
    if (!selectedRadio) return;

    const weekOffset = parseInt(selectedRadio.value);

    // Generate print layout
    generateForemanPrintLayout(weekOffset);

    // Close modal
    closePrintModal();

    // Trigger print after a short delay to allow rendering
    setTimeout(() => {
        window.print();
    }, 100);
}

/**
 * Generate foreman-style print layout for a specific week
 */
function generateForemanPrintLayout(weekOffset) {
    const monday = getWeekMonday(weekOffset);
    const dates = [];
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Generate Mon-Sat for this week
    for (let i = 0; i < 6; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push(date);
    }

    // Get all workers and jobs
    const activeWorkers = workers.filter(w => !w.archived);
    const activeJobs = jobs.filter(j => !j.archived);

    // Build worker rows
    let workerRows = '';
    activeWorkers.forEach(worker => {
        workerRows += `
            <tr class="print-worker-row">
                <td class="print-worker-name">${worker.name}</td>`;

        dates.forEach(date => {
            const dateKey = getDateKey(date);
            const vacKey = `${worker.id}_${dateKey}`;
            const isOnVacation = vacationSchedule[vacKey];

            if (isOnVacation) {
                workerRows += `<td class="print-cell print-vacation">VACATION</td>`;
                return;
            }

            // Find which job this worker is assigned to
            let assignedJob = null;
            let crewSize = 0;

            activeJobs.forEach(job => {
                const slotKey = `${job.id}_${dateKey}`;
                const slot = dailySchedule[slotKey];
                if (slot && slot.assigned && slot.assigned.includes(worker.id)) {
                    assignedJob = job;
                    crewSize = slot.demand || 0;
                }
            });

            if (assignedJob) {
                workerRows += `
                    <td class="print-cell print-assigned">
                        <div class="print-job-name">${assignedJob.name}</div>
                        <div class="print-crew-size">${crewSize} crew</div>
                    </td>`;
            } else {
                workerRows += `<td class="print-cell print-off">OFF</td>`;
            }
        });

        workerRows += `</tr>`;
    });

    // Create print container
    const printDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const weekRange = `${formatDateShort(dates[0])} – ${formatDateShort(dates[5])}`;

    const printHTML = `
        <div id="foremanPrintLayout" class="foreman-print-container">
            <div class="print-header">
                <div class="print-title">
                    <h1>CR CUSTOM ELECTRIC - WEEKLY CREW ASSIGNMENTS</h1>
                    <h2>Week of ${weekRange}</h2>
                </div>
                <div class="print-date">Printed: ${printDate}</div>
            </div>

            <table class="print-schedule-table">
                <thead>
                    <tr>
                        <th class="print-worker-col">EMPLOYEE</th>
                        ${dates.map((d, i) => `
                            <th class="print-day-col">
                                <div>${dayNames[i]}</div>
                                <div class="print-date-num">${d.getMonth() + 1}/${d.getDate()}</div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${workerRows}
                </tbody>
            </table>
        </div>
    `;

    // Remove any existing print layout
    const existingLayout = document.getElementById('foremanPrintLayout');
    if (existingLayout) {
        existingLayout.remove();
    }

    // Add new print layout to body
    document.body.insertAdjacentHTML('beforeend', printHTML);
}

/**
 * Prepare the page for printing with current date
 */
window.addEventListener('beforeprint', function() {
    const wrapper = document.querySelector('.schedule-wrapper');
    if (wrapper) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        wrapper.setAttribute('data-print-date', dateStr);
    }

    // Force desktop view for printing (show full 3-week grid)
    const wasMobile = isMobileView;
    if (isMobileView) {
        isMobileView = false;
        renderDesktopSchedule();
    }

    // Store the mobile state to restore after print
    window._wasMobileBeforePrint = wasMobile;
});

/**
 * Restore mobile view after printing and cleanup
 */
window.addEventListener('afterprint', function() {
    // Remove print layout
    const printLayout = document.getElementById('foremanPrintLayout');
    if (printLayout) {
        printLayout.remove();
    }

    // Restore mobile view if needed
    if (window._wasMobileBeforePrint) {
        isMobileView = true;
        renderSchedule();
    }
});

// ============================================================================
// New Features: Planning Mode, Weekly Overview, Utilization, Suggestions
// ============================================================================

/**
 * Toggle Planning Mode (PM view - hide assignments, show demands only)
 */
function togglePlanningMode() {
    planningMode = !planningMode;
    const btn = document.getElementById('planningModeBtn');
    if (btn) {
        btn.classList.toggle('active', planningMode);
        btn.textContent = planningMode ? '📋 Planning (ON)' : '📋 Planning';
    }
    renderSchedule();
}

/**
 * Toggle Weekly Overview (worker-centric allocation view)
 */
function toggleWeeklyOverview() {
    const modal = document.getElementById('weeklyOverviewModal');
    if (!modal) return;

    renderWeeklyOverview();
    modal.classList.add('active');
}

/**
 * Close Weekly Overview modal
 */
function closeWeeklyOverview() {
    document.getElementById('weeklyOverviewModal')?.classList.remove('active');
}

/**
 * Render Weekly Overview (print-style view in browser)
 */
function renderWeeklyOverview() {
    const container = document.getElementById('weeklyOverviewContent');
    if (!container) return;

    // Use current week (week 0) for overview
    const monday = getWeekMonday(scheduleWeekOffset);
    const dates = [];
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Generate Mon-Sat for this week
    for (let i = 0; i < 6; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push(date);
    }

    const activeWorkers = workers.filter(w => !w.archived);
    const activeJobs = jobs.filter(j => !j.archived);

    // Build worker rows
    let workerRows = '';
    activeWorkers.forEach(worker => {
        workerRows += `
            <tr class="overview-worker-row">
                <td class="overview-worker-name">${worker.name}</td>`;

        dates.forEach(date => {
            const dateKey = getDateKey(date);
            const vacKey = `${worker.id}_${dateKey}`;
            const isOnVacation = vacationSchedule[vacKey];

            if (isOnVacation) {
                workerRows += `<td class="overview-cell cell-vacation">VACATION</td>`;
                return;
            }

            // Find which job this worker is assigned to
            let assignedJob = null;
            let demand = 0;
            let assigned = 0;

            activeJobs.forEach(job => {
                const slotKey = `${job.id}_${dateKey}`;
                const slot = dailySchedule[slotKey];
                if (slot && slot.assigned && slot.assigned.includes(worker.id)) {
                    assignedJob = job;
                    demand = slot.demand || 0;
                    assigned = slot.assigned.length;
                }
            });

            if (assignedJob) {
                const statusClass = assigned < demand ? 'cell-short' : 'cell-full';
                workerRows += `
                    <td class="overview-cell ${statusClass}">
                        <div class="overview-job-name">${assignedJob.name}</div>
                        <div class="overview-crew-info">${assigned}/${demand} crew</div>
                    </td>`;
            } else {
                workerRows += `<td class="overview-cell cell-off">OFF</td>`;
            }
        });

        workerRows += `</tr>`;
    });

    const weekRange = `${formatDateShort(dates[0])} – ${formatDateShort(dates[5])}`;

    const html = `
        <div class="overview-header">
            <h3>Week of ${weekRange}</h3>
        </div>
        <div class="overview-table-wrapper">
            <table class="overview-table">
                <thead>
                    <tr>
                        <th class="overview-worker-col">EMPLOYEE</th>
                        ${dates.map((d, i) => `
                            <th class="overview-day-col">
                                <div>${dayNames[i]}</div>
                                <div class="overview-date-num">${d.getMonth() + 1}/${d.getDate()}</div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${workerRows}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Render Worker Utilization Panel
 */
function renderUtilization() {
    const panel = document.getElementById('utilizationPanel');
    const content = document.getElementById('utilizationContent');
    if (!panel || !content) return;

    // Calculate utilization for all workers across 3 weeks
    const dates = [];
    for (let week = 0; week < 3; week++) {
        const monday = getWeekMonday(scheduleWeekOffset + week);
        for (let day = 0; day < 6; day++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + day);
            dates.push(date);
        }
    }

    const totalDays = dates.length; // 18 days
    const utilization = [];

    workers.forEach(worker => {
        let scheduledDays = 0;
        dates.forEach(date => {
            const dateKey = getDateKey(date);
            // Check if worker is scheduled on any job this day
            const isScheduled = Object.keys(dailySchedule).some(key => {
                if (key.includes(dateKey)) {
                    const slot = dailySchedule[key];
                    return slot && slot.assigned && slot.assigned.includes(worker.id);
                }
                return false;
            });
            // Also check if on vacation
            const vacKey = `${worker.id}_${dateKey}`;
            const isOnVacation = vacationSchedule[vacKey];

            if (isScheduled || isOnVacation) {
                scheduledDays++;
            }
        });

        const percentFull = Math.round((scheduledDays / totalDays) * 100);
        utilization.push({
            worker,
            scheduledDays,
            availableDays: totalDays - scheduledDays,
            percentFull
        });
    });

    // Sort by availability (most available first)
    utilization.sort((a, b) => b.availableDays - a.availableDays);

    const html = `
        <div class="utilization-list">
            ${utilization.map(u => {
                let statusIcon = '✅';
                let statusClass = 'util-good';
                if (u.percentFull < 50) {
                    statusIcon = '⚠️';
                    statusClass = 'util-low';
                } else if (u.percentFull >= 90) {
                    statusIcon = '✅';
                    statusClass = 'util-full';
                }

                return `
                    <div class="utilization-item ${statusClass}">
                        <div class="util-icon">${statusIcon}</div>
                        <div class="util-worker">
                            <strong>${u.worker.name}</strong>
                            <span class="util-role">${u.worker.role}</span>
                        </div>
                        <div class="util-bar-container">
                            <div class="util-bar">
                                <div class="util-fill" style="width: ${u.percentFull}%"></div>
                            </div>
                        </div>
                        <div class="util-stats">
                            <span class="util-days">${u.scheduledDays}/${totalDays} days</span>
                            <span class="util-percent">${u.percentFull}%</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    content.innerHTML = html;
    panel.style.display = 'block';
}

/**
 * Close Utilization Panel
 */
function closeUtilization() {
    const panel = document.getElementById('utilizationPanel');
    if (panel) panel.style.display = 'none';
}

/**
 * Render Smart Suggestions Panel
 */
function renderSmartSuggestions() {
    const panel = document.getElementById('smartSuggestionsPanel');
    const content = document.getElementById('suggestionsContent');
    if (!panel || !content) return;

    // Find all gaps (jobs with demand but not enough assigned workers)
    const gaps = [];
    const dates = [];

    // Get current week dates
    const monday = getWeekMonday(scheduleWeekOffset);
    for (let day = 0; day < 6; day++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + day);
        dates.push(date);
    }

    const activeJobs = jobs.filter(j => !j.archived);

    dates.forEach(date => {
        const dateKey = getDateKey(date);
        activeJobs.forEach(job => {
            const slotKey = `${job.id}_${dateKey}`;
            const slot = dailySchedule[slotKey];
            if (slot && slot.demand > 0) {
                const assigned = (slot.assigned || []).length;
                const shortage = slot.demand - assigned;

                if (shortage > 0) {
                    // Find available workers for this day
                    const availableWorkers = workers.filter(w => {
                        // Check if already assigned this day
                        const isAssigned = Object.keys(dailySchedule).some(key => {
                            if (key.includes(dateKey)) {
                                const s = dailySchedule[key];
                                return s && s.assigned && s.assigned.includes(w.id);
                            }
                            return false;
                        });

                        // Check if on vacation
                        const vacKey = `${w.id}_${dateKey}`;
                        const isOnVacation = vacationSchedule[vacKey];

                        return !isAssigned && !isOnVacation && !w.archived;
                    });

                    gaps.push({
                        job,
                        date,
                        dateKey,
                        shortage,
                        assigned,
                        demand: slot.demand,
                        availableWorkers
                    });
                }
            }
        });
    });

    if (gaps.length === 0) {
        panel.style.display = 'none';
        return;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const html = `
        <div class="suggestions-summary">
            <strong>${gaps.length} gap${gaps.length > 1 ? 's' : ''} found this week</strong>
        </div>
        <div class="suggestions-list">
            ${gaps.map(gap => `
                <div class="suggestion-item">
                    <div class="suggestion-header">
                        <span class="suggestion-job">${gap.job.name}</span>
                        <span class="suggestion-date">${dayNames[gap.date.getDay()]} ${gap.date.getMonth() + 1}/${gap.date.getDate()}</span>
                    </div>
                    <div class="suggestion-details">
                        <span class="suggestion-shortage">⚠️ Need ${gap.shortage} more worker${gap.shortage > 1 ? 's' : ''} (${gap.assigned}/${gap.demand})</span>
                    </div>
                    ${gap.availableWorkers.length > 0 ? `
                        <div class="suggestion-workers">
                            <span class="suggestion-label">Available:</span>
                            ${gap.availableWorkers.slice(0, 3).map(w =>
                                `<span class="suggestion-worker">${w.name}</span>`
                            ).join('')}
                            ${gap.availableWorkers.length > 3 ? `<span class="suggestion-more">+${gap.availableWorkers.length - 3} more</span>` : ''}
                        </div>
                    ` : '<div class="suggestion-no-workers">⚠️ No workers available this day</div>'}
                </div>
            `).join('')}
        </div>
    `;

    content.innerHTML = html;
    panel.style.display = 'block';
}

/**
 * Close Smart Suggestions Panel
 */
function closeSuggestions() {
    const panel = document.getElementById('smartSuggestionsPanel');
    if (panel) panel.style.display = 'none';
}

/**
 * Render Insight Badges in Header
 */
function renderInsightBadges() {
    const container = document.getElementById('insightBadges');
    if (!container) return;

    // Calculate gaps
    const dates = [];
    const monday = getWeekMonday(scheduleWeekOffset);
    for (let day = 0; day < 6; day++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + day);
        dates.push(date);
    }

    const activeJobs = jobs.filter(j => !j.archived);
    let gapCount = 0;

    dates.forEach(date => {
        const dateKey = getDateKey(date);
        activeJobs.forEach(job => {
            const slotKey = `${job.id}_${dateKey}`;
            const slot = dailySchedule[slotKey];
            if (slot && slot.demand > 0) {
                const assigned = (slot.assigned || []).length;
                if (assigned < slot.demand) {
                    gapCount++;
                }
            }
        });
    });

    // Calculate underutilized workers
    const allDates = [];
    for (let week = 0; week < 3; week++) {
        const monday = getWeekMonday(scheduleWeekOffset + week);
        for (let day = 0; day < 6; day++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + day);
            allDates.push(date);
        }
    }

    const totalDays = allDates.length;
    let underutilizedCount = 0;

    workers.forEach(worker => {
        let scheduledDays = 0;
        allDates.forEach(date => {
            const dateKey = getDateKey(date);
            const isScheduled = Object.keys(dailySchedule).some(key => {
                if (key.includes(dateKey)) {
                    const slot = dailySchedule[key];
                    return slot && slot.assigned && slot.assigned.includes(worker.id);
                }
                return false;
            });
            const vacKey = `${worker.id}_${dateKey}`;
            const isOnVacation = vacationSchedule[vacKey];

            if (isScheduled || isOnVacation) {
                scheduledDays++;
            }
        });

        const percentFull = Math.round((scheduledDays / totalDays) * 100);
        if (percentFull < 50) {
            underutilizedCount++;
        }
    });

    // Render badges
    let html = '';
    if (gapCount > 0) {
        html += `<button class="insight-badge badge-warning" onclick="renderSmartSuggestions(); document.getElementById('smartSuggestionsPanel').style.display='block';" title="Click to view gaps">
            ⚠️ ${gapCount} gap${gapCount > 1 ? 's' : ''}
        </button>`;
    }

    if (underutilizedCount > 0) {
        html += `<button class="insight-badge badge-info" onclick="renderUtilization(); document.getElementById('utilizationPanel').style.display='block';" title="Click to view utilization">
            📊 ${underutilizedCount} underutilized
        </button>`;
    }

    if (gapCount === 0 && underutilizedCount === 0) {
        html = `<span class="insight-badge badge-success">✅ All good!</span>`;
    }

    container.innerHTML = html;
}

// ============================================================================
// Mobile Detection and Helpers
// ============================================================================

/**
 * Detect if we should use mobile view based on screen width
 */
function detectMobileView() {
    const wasMobile = isMobileView;
    isMobileView = window.innerWidth < 768;

    // If view mode changed, re-render
    if (wasMobile !== isMobileView) {
        renderSchedule();
    }
}

/**
 * Get single day for mobile view
 */
function getMobileDay() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + currentDayOffset);
    return targetDate;
}

/**
 * Shift mobile day view
 */
function shiftMobileDay(delta) {
    currentDayOffset += delta;
    renderSchedule();
}

/**
 * Jump to today in mobile view
 */
function jumpToToday() {
    currentDayOffset = 0;
    renderSchedule();
}

/**
 * Smart navigation functions (desktop week or mobile day)
 */
function navigatePrev() {
    if (isMobileView) {
        shiftMobileDay(-1);
    } else {
        shiftScheduleWeek(-1);
    }
}

function navigateNext() {
    if (isMobileView) {
        shiftMobileDay(1);
    } else {
        shiftScheduleWeek(1);
    }
}

// ============================================================================
// Touch Gesture Handlers
// ============================================================================

/**
 * Handle touch start for swipe detection
 */
function handleTouchStart(event) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
}

/**
 * Handle touch end for swipe detection (day navigation)
 */
function handleTouchEnd(event) {
    if (!isMobileView) return;

    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            // Swipe right - previous day
            shiftMobileDay(-1);
        } else {
            // Swipe left - next day
            shiftMobileDay(1);
        }
    }
}

// ============================================================================
// JobTread Integration
// ============================================================================

/**
 * Call JobTread Pave API
 */
async function callJobTreadAPI(query) {
    if (!jobtreadGrantKey) {
        alert('JobTread Grant Key not set. Please configure in settings.');
        return null;
    }

    try {
        const requestBody = {
            query: {
                $: {
                    grantKey: jobtreadGrantKey
                },
                ...query
            }
        };

        console.log('JobTread API Request:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.jobtread.com/pave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log('JobTread API Response:', data);

        if (!response.ok) {
            const errorMsg = data.error || data.message || JSON.stringify(data);
            throw new Error(`API error ${response.status}: ${errorMsg}`);
        }

        return data;
    } catch (error) {
        console.error('JobTread API error:', error);
        alert(`JobTread API error: ${error.message}`);
        return null;
    }
}

/**
 * Push a day's schedule to JobTread
 */
async function pushDayToJobTread(dateKey) {
    const date = new Date(dateKey);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (!confirm(`Push schedule for ${dateStr} to JobTread?`)) {
        return;
    }

    // Get all jobs scheduled for this day
    const scheduledJobs = [];
    Object.keys(dailySchedule).forEach(key => {
        if (key.endsWith(`_${dateKey}`)) {
            const jobId = parseInt(key.split('_')[0]);
            const slot = dailySchedule[key];
            const job = jobs.find(j => j.id === jobId);

            if (job && slot.assigned && slot.assigned.length > 0) {
                scheduledJobs.push({ job, slot });
            }
        }
    });

    if (scheduledJobs.length === 0) {
        alert('No workers assigned for this day.');
        return;
    }

    console.log(`Pushing ${scheduledJobs.length} jobs to JobTread for ${dateStr}...`);

    let successCount = 0;
    let errorCount = 0;

    for (const { job, slot } of scheduledJobs) {
        const assignedWorkers = slot.assigned
            .map(wId => workers.find(w => w.id === wId))
            .filter(Boolean)
            .map(w => w.name)
            .join(', ');

        const taskName = `[Man Loader] ${job.name} - ${dateStr}`;
        const taskDescription = `Crew: ${assignedWorkers}\n\nScheduled via Man Loader on ${new Date().toLocaleDateString()}`;

        // Convert dateKey (YYYY_MM_DD) to ISO date format (YYYY-MM-DD)
        const isoDate = dateKey.replace(/_/g, '-');

        try {
            // Create task in JobTread
            const result = await callJobTreadAPI({
                tasks: {
                    $create: {
                        name: taskName,
                        description: taskDescription,
                        dueDate: isoDate,
                        // Note: May need jobId or other required fields
                    }
                }
            });

            if (result && result.tasks && result.tasks.length > 0) {
                // Store the task ID for later deletion
                const taskId = result.tasks[0].id;
                jobtreadTaskIds[`${job.id}_${dateKey}`] = taskId;
                successCount++;
            } else {
                console.error('Failed to create task:', job.name);
                errorCount++;
            }
        } catch (error) {
            console.error('Error pushing job:', job.name, error);
            errorCount++;
        }
    }

    saveData(); // Save task IDs
    alert(`Pushed to JobTread:\n✓ ${successCount} tasks created\n${errorCount > 0 ? `✗ ${errorCount} errors` : ''}`);
}

/**
 * Delete a day's schedule from JobTread
 */
async function deleteDayFromJobTread(dateKey) {
    const date = new Date(dateKey);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (!confirm(`Delete all Man Loader tasks for ${dateStr} from JobTread?\n\nThis cannot be undone.`)) {
        return;
    }

    // Find all task IDs for this day
    const taskIdsToDelete = [];
    Object.keys(jobtreadTaskIds).forEach(key => {
        if (key.endsWith(`_${dateKey}`)) {
            taskIdsToDelete.push({
                key,
                taskId: jobtreadTaskIds[key]
            });
        }
    });

    if (taskIdsToDelete.length === 0) {
        alert('No JobTread tasks found for this day.');
        return;
    }

    console.log(`Deleting ${taskIdsToDelete.length} tasks from JobTread...`);

    let successCount = 0;
    let errorCount = 0;

    for (const { key, taskId } of taskIdsToDelete) {
        try {
            const result = await callJobTreadAPI({
                tasks: {
                    $delete: {
                        id: taskId
                    }
                }
            });

            if (result) {
                delete jobtreadTaskIds[key];
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error('Error deleting task:', taskId, error);
            errorCount++;
        }
    }

    saveData(); // Save updated task IDs
    alert(`Deleted from JobTread:\n✓ ${successCount} tasks removed\n${errorCount > 0 ? `✗ ${errorCount} errors` : ''}`);
}

/**
 * Set JobTread Grant Key
 */
function setJobTreadGrantKey() {
    const key = prompt('Enter JobTread Grant Key:', jobtreadGrantKey);
    if (key !== null) {
        jobtreadGrantKey = key.trim();
        saveData();
        alert('JobTread Grant Key saved.');
    }
}

/**
 * Push current mobile day to JobTread
 */
function pushCurrentDayToJobTread() {
    if (isMobileView) {
        const targetDate = getMobileDay();
        const dateKey = getDateKey(targetDate);
        pushDayToJobTread(dateKey);
    }
}

/**
 * Delete current mobile day from JobTread
 */
function deleteCurrentDayFromJobTread() {
    if (isMobileView) {
        const targetDate = getMobileDay();
        const dateKey = getDateKey(targetDate);
        deleteDayFromJobTread(dateKey);
    }
}

// ============================================================================
// Initialize on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Try to initialize Firebase first
    if (typeof firebase !== 'undefined' && typeof initializeFirebase === 'function') {
        initializeFirebase();
    }

    // Detect mobile view
    detectMobileView();

    // Add resize listener
    window.addEventListener('resize', detectMobileView);

    // Add touch gesture listeners for swipe navigation
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Close more menu when clicking outside
    document.addEventListener('click', function(e) {
        const moreMenu = document.getElementById('moreMenu');
        const moreMenuBtn = document.getElementById('moreMenuBtn');
        if (moreMenu && moreMenuBtn && !moreMenu.contains(e.target) && !moreMenuBtn.contains(e.target)) {
            moreMenu.style.display = 'none';
        }
    });

    // Then load data
    initializeData();
});
