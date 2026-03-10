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
 * Close any modal with ESC key
 */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAddWorkerModal();
        closeAddJobModal();
        closeConfirmModal();
        closePromptModal();
        closeEditJobModal();
    }
});

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

    renderRosterPanel();
    renderScheduleGrid(dates);
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

    // Render mobile roster
    renderMobileRoster(targetDate, dateKey);

    // Render mobile job cards
    renderMobileJobCards(targetDate, dateKey);
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
        const percentFull = Math.round((scheduledDays / totalDays) * 100);

        // Determine status class based on how full schedule is
        let statusClass = 'status-available';
        if (percentFull >= 90) statusClass = 'status-full';
        else if (percentFull >= 70) statusClass = 'status-busy';
        else if (percentFull >= 40) statusClass = 'status-moderate';

        return `
        <div class="worker-chip worker-chip-${w.role}"
             draggable="true"
             ondragstart="dragWorkerStart(event, ${w.id}, null, null)"
             title="${w.name} — ${w.role}${w.isForeman ? ' (Foreman)' : ''}\n${scheduledDays} days scheduled, ${availableDays} available">
            <div class="chip-main">
                <span class="chip-name">${w.name}</span>
                <span class="chip-meta">${w.role}${w.isForeman ? ' ★' : ''}</span>
            </div>
            <div class="chip-availability ${statusClass}">
                <div class="availability-bar">
                    <div class="availability-fill" style="width: ${percentFull}%"></div>
                </div>
                <span class="availability-text">${availableDays} free</span>
            </div>
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

    const activeJobs = jobs.filter(j => j.active);
    console.log(`Rendering schedule with ${activeJobs.length} active jobs and ${workers.length} workers`);

    // Build table header with daily columns
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = `<table class="schedule-table">
        <thead>
            <tr class="week-headers">
                <th class="col-job">Job Site</th>`;

    // Week headers (3 weeks)
    for (let week = 0; week < 3; week++) {
        const weekStart = getWeekMonday(scheduleWeekOffset + week);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 5); // Saturday
        const weekLabel = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;
        html += `<th class="col-week-header" colspan="6">${weekLabel}</th>`;
    }

    html += `</tr><tr class="day-headers">
                <th class="col-job"></th>`;

    // Day headers (18 columns = 3 weeks × 6 days) with dates
    dates.forEach(date => {
        const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1];
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        html += `<th class="col-day">${dayName}<br><small>${dateStr}</small></th>`;
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
            <div class="progress-bar-wrapper">
                <div class="progress-bar-track">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-bar-tooltip">
                    Need ${totalNeeded} | Assigned ${assignedCount}<br>Available ${availableCount}
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
                         title="${w.name} - Time Off">
                        <span class="chip-name-mini">${w.name.split(' ')[0]}</span>
                        <button class="chip-remove" onclick="removeVacation(${w.id}, '${dateKey}'); event.stopPropagation()">×</button>
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
                            <div class="sched-job-name">${job.name}</div>
                            <div class="sched-job-div badge-${job.division}">${job.division}</div>
                        </div>
                        <div class="job-actions">
                            <button class="job-action-btn edit-btn" onclick="editJob(${job.id}); event.stopPropagation();">Edit</button>
                            <button class="job-action-btn archive-btn" onclick="archiveJob(${job.id}); event.stopPropagation();">Archive</button>
                            <button class="job-action-btn remove-btn" onclick="removeJob(${job.id}); event.stopPropagation();">Delete</button>
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

                html += `<td class="schedule-cell ${statusClass}"
                             data-job-id="${job.id}"
                             data-date-key="${dateKey}"
                             ondragover="handleCellDragOver(event, ${job.id}, '${dateKey}')"
                             ondragleave="this.classList.remove('drag-over')"
                             ondrop="handleCellDrop(event, ${job.id}, '${dateKey}')">
                    <div class="cell-demand-row">
                        <input type="number" class="demand-input" value="${demand}" min="0" max="9"
                               onchange="setDemand(${job.id}, '${dateKey}', this.value)"
                               onclick="event.stopPropagation()"
                               title="PM: Set daily manpower need">
                        <span class="assigned-count">${assigned.length}</span>
                    </div>
                    <div class="cell-workers">
                        ${assignedWorkers.map(w => `
                            <div class="worker-chip-mini worker-chip-${w.role}"
                                 draggable="true"
                                 ondragstart="dragWorkerStart(event, ${w.id}, ${job.id}, '${dateKey}')"
                                 title="${w.name}">
                                <span class="chip-name-mini">${w.name.split(' ')[0]}</span>
                                <button class="chip-remove" onclick="removeScheduleWorker(${job.id}, '${dateKey}', ${w.id}); event.stopPropagation()">×</button>
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
}

function dropWorkerToCell(event, jobId, dateKey) {
    event.preventDefault();
    event.target.closest('.schedule-cell')?.classList.remove('drag-over');

    if (!draggingWorkerId) return;

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

    if (isAlreadyAssignedToday && (draggingFromJob === null || draggingFromDate !== dateKey)) {
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
    const slotKey = `${jobId}_${dateKey}`;
    if (!dailySchedule[slotKey]) dailySchedule[slotKey] = { demand: 0, assigned: [] };
    dailySchedule[slotKey].demand = parseInt(value) || 0;
    saveData();
    renderSchedule();
}

function removeScheduleWorker(jobId, dateKey, workerId) {
    const slotKey = `${jobId}_${dateKey}`;
    if (dailySchedule[slotKey]) {
        dailySchedule[slotKey].assigned = dailySchedule[slotKey].assigned.filter(id => id !== workerId);
        saveData();
        renderSchedule();
    }
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
    } else {
        localStorage.setItem('workers', JSON.stringify(workers));
        localStorage.setItem('jobs', JSON.stringify(jobs));
        localStorage.setItem('dailySchedule', JSON.stringify(dailySchedule));
        localStorage.setItem('vacationSchedule', JSON.stringify(vacationSchedule));
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
    } else {
        workers = JSON.parse(localStorage.getItem('workers')) || [];
        jobs = JSON.parse(localStorage.getItem('jobs')) || [];
        dailySchedule = JSON.parse(localStorage.getItem('dailySchedule')) || {};
        vacationSchedule = JSON.parse(localStorage.getItem('vacationSchedule')) || {};
        renderWorkers();
        renderJobs();
        renderSchedule();
    }
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

    // Then load data
    initializeData();
});
