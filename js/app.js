/**
 * CR Custom Electric - Man Loader Application
 * Simplified 3-Week Daily Schedule with Drag & Drop
 */

// Data storage
let workers = [];
let jobs = [];
let dailySchedule = {}; // key: "jobId_dateString", value: { demand, assigned: [] }
let scheduleWeekOffset = 0; // weeks from current week for 3-week lookahead

// Drag state for schedule
let draggingWorkerId = null;
let draggingFromJob = null;
let draggingFromDate = null;

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
 * Remove a job
 */
function removeJob(id) {
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

    container.innerHTML = filtered.map(w => `
        <div class="worker-chip worker-chip-${w.role}"
             draggable="true"
             ondragstart="dragWorkerStart(event, ${w.id}, null, null)"
             title="${w.name} — ${w.role}${w.isForeman ? ' (Foreman)' : ''}">
            <span class="chip-name">${w.name}</span>
            <span class="chip-meta">${w.role}${w.isForeman ? ' ★' : ''}</span>
        </div>
    `).join('');
}

/**
 * Render the schedule grid with daily columns
 */
function renderScheduleGrid(dates) {
    const container = document.getElementById('scheduleGrid');
    if (!container) return;

    const activeJobs = jobs.filter(j => j.active);

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

    // Day headers (18 columns = 3 weeks × 6 days)
    for (let week = 0; week < 3; week++) {
        dayNames.forEach(day => {
            html += `<th class="col-day">${day}</th>`;
        });
    }

    html += `</tr></thead><tbody>`;

    if (activeJobs.length === 0) {
        html += `<tr><td colspan="19" class="schedule-empty-row">No active jobs. Click "+ Add Job" to get started.</td></tr>`;
    } else {
        activeJobs.forEach(job => {
            html += `<tr>
                <td class="col-job-name">
                    <div class="sched-job-name">${job.name}</div>
                    <div class="sched-job-div badge-${job.division}">${job.division}</div>
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
                             ondragover="event.preventDefault(); this.classList.add('drag-over')"
                             ondragleave="this.classList.remove('drag-over')"
                             ondrop="dropWorkerToCell(event, ${job.id}, '${dateKey}')">
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
                </td>`;
            });

            html += `</tr>`;
        });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ============================================================================
// Drag & Drop Handlers
// ============================================================================

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
        const fromKey = `${draggingFromJob}_${draggingFromDate}`;
        if (dailySchedule[fromKey]) {
            dailySchedule[fromKey].assigned = dailySchedule[fromKey].assigned.filter(id => id !== draggingWorkerId);
            saveData();
            renderSchedule();
        }
    }
    draggingWorkerId = draggingFromJob = draggingFromDate = null;
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
    } else {
        localStorage.setItem('workers', JSON.stringify(workers));
        localStorage.setItem('jobs', JSON.stringify(jobs));
        localStorage.setItem('dailySchedule', JSON.stringify(dailySchedule));
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
    } else {
        workers = JSON.parse(localStorage.getItem('workers')) || [];
        jobs = JSON.parse(localStorage.getItem('jobs')) || [];
        dailySchedule = JSON.parse(localStorage.getItem('dailySchedule')) || {};
        renderWorkers();
        renderJobs();
        renderSchedule();
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

    // Then load data
    initializeData();
});
