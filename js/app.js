/**
 * CR Custom Electric - Man Loader Application
 * Main application logic for crew management and scheduling
 */

// Data storage
let workers = [];
let jobs = [];
let assignments = [];

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
        status: 'available'
    };
    workers.push(worker);
    saveData();
    renderWorkers();
    updateStats();
    this.reset();
});

// Add job form submission
document.getElementById('jobForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const job = {
        id: Date.now(),
        name: document.getElementById('jobName').value,
        location: document.getElementById('jobLocation').value,
        startDate: document.getElementById('jobStartDate').value,
        endDate: document.getElementById('jobEndDate').value,
        hours: document.getElementById('jobHours').value,
        crewSize: document.getElementById('jobCrewSize').value,
        crew: []
    };
    jobs.push(job);
    saveData();
    renderJobs();
    renderGantt();
    updateStats();
    this.reset();
});

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render the workers list
 */
function renderWorkers() {
    const list = document.getElementById('workerList');
    if (workers.length === 0) {
        list.innerHTML = '<div class="empty-state">No workers added yet</div>';
        return;
    }

    list.innerHTML = workers.map(worker => `
        <div class="item-card">
            <div class="item-info">
                <strong>${worker.name}</strong>
                <span class="badge badge-${worker.role}">${worker.role.toUpperCase()}</span>
                <span class="badge badge-${worker.status}">${worker.status.toUpperCase()}</span>
            </div>
            <button class="btn-remove" onclick="removeWorker(${worker.id})">Remove</button>
        </div>
    `).join('');
}

/**
 * Render the jobs list
 */
function renderJobs() {
    const list = document.getElementById('jobList');
    if (jobs.length === 0) {
        list.innerHTML = '<div class="empty-state">No job sites added yet</div>';
        renderGantt();
        return;
    }

    list.innerHTML = jobs.map(job => {
        const dateRange = job.startDate && job.endDate
            ? `${formatDate(job.startDate)} - ${formatDate(job.endDate)}`
            : 'No dates set';
        return `
            <div class="item-card">
                <div class="item-info">
                    <strong>${job.name}</strong>
                    <div class="details">${job.location} • ${dateRange} • ${job.hours}hrs • ${job.crew.length}/${job.crewSize} crew</div>
                </div>
                <button class="btn-remove" onclick="removeJob(${job.id})">Remove</button>
            </div>
        `;
    }).join('');
    renderAssignments();
    renderGantt();
}

/**
 * Render the job assignments section
 */
function renderAssignments() {
    const list = document.getElementById('assignmentList');
    const activeJobs = jobs.filter(job => job.crew && job.crew.length > 0);

    if (activeJobs.length === 0) {
        list.innerHTML = '<div class="empty-state">No assignments yet. Add workers to job sites below.</div>';
        return;
    }

    list.innerHTML = activeJobs.map(job => {
        const crewMembers = job.crew.map(workerId => {
            const worker = workers.find(w => w.id === workerId);
            return worker ? `
                <div class="crew-member">
                    <span>${worker.name} (${worker.role})</span>
                    <button onclick="unassignWorker(${job.id}, ${workerId})">×</button>
                </div>
            ` : '';
        }).join('');

        const availableWorkers = workers.filter(w => w.status === 'available');
        const needsMoreCrew = job.crew.length < job.crewSize;

        return `
            <div class="assignment-card">
                <div class="assignment-header">
                    <h3>${job.name}</h3>
                    <span>${job.crew.length}/${job.crewSize} Crew Members</span>
                </div>
                <div class="details" style="color: #6c757d; margin-bottom: 10px;">
                    📍 ${job.location} • ⏱️ ${job.hours} hours
                </div>
                <div class="crew-members">
                    ${crewMembers || '<span style="color: #6c757d;">No crew assigned</span>'}
                </div>
                ${needsMoreCrew && availableWorkers.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <select id="assign-${job.id}" style="width: auto; display: inline-block; margin-right: 10px;">
                            <option value="">Select worker to assign</option>
                            ${availableWorkers.map(w => `
                                <option value="${w.id}">${w.name} (${w.role})</option>
                            `).join('')}
                        </select>
                        <button class="btn-assign" onclick="assignWorker(${job.id})">Assign to Job</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render the Gantt chart
 */
function renderGantt() {
    const chart = document.getElementById('ganttChart');

    if (jobs.length === 0) {
        chart.innerHTML = '<div class="empty-state">No jobs to display. Add jobs with start and end dates to see the schedule.</div>';
        return;
    }

    // Filter jobs with dates
    const jobsWithDates = jobs.filter(job => job.startDate && job.endDate);

    if (jobsWithDates.length === 0) {
        chart.innerHTML = '<div class="empty-state">No scheduled jobs yet. Add start and end dates to jobs to see the Gantt chart.</div>';
        return;
    }

    // Calculate timeline range
    const allDates = jobsWithDates.flatMap(job => [new Date(job.startDate), new Date(job.endDate)]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Add padding to timeline
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 2);

    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

    // Generate timeline markers (show every few days depending on range)
    const markerInterval = totalDays > 60 ? 7 : totalDays > 30 ? 5 : totalDays > 14 ? 3 : 1;
    const markers = [];
    let currentDate = new Date(minDate);

    while (currentDate <= maxDate) {
        markers.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + markerInterval);
    }

    // Build Gantt header
    let ganttHTML = '<div class="gantt-header">';
    ganttHTML += '<div class="gantt-label">Project / Workers</div>';
    ganttHTML += '<div class="gantt-timeline">';
    markers.forEach(marker => {
        ganttHTML += `<div class="timeline-marker">${formatDate(marker.toISOString().split('T')[0])}</div>`;
    });
    ganttHTML += '</div></div>';

    // Build Gantt rows
    jobsWithDates.forEach(job => {
        const jobStart = new Date(job.startDate);
        const jobEnd = new Date(job.endDate);

        // Calculate position and width
        const startOffset = ((jobStart - minDate) / (maxDate - minDate)) * 100;
        const duration = ((jobEnd - jobStart) / (maxDate - minDate)) * 100;

        // Get crew info
        const crewInfo = job.crew.map(wId => {
            const worker = workers.find(w => w.id === wId);
            return worker ? worker.name.split(' ')[0] : '';
        }).filter(n => n).join(', ');

        ganttHTML += '<div class="gantt-row">';
        ganttHTML += '<div class="gantt-row-label">';
        ganttHTML += `<strong>${job.name}</strong>`;
        ganttHTML += `<div class="dates">${formatDate(job.startDate)} - ${formatDate(job.endDate)}</div>`;
        ganttHTML += '</div>';
        ganttHTML += '<div class="gantt-bar-container">';
        ganttHTML += `<div class="gantt-bar" style="left: ${startOffset}%; width: ${duration}%;">`;
        ganttHTML += '<div class="gantt-bar-content">';
        ganttHTML += `${job.crew.length}/${job.crewSize} crew`;
        if (crewInfo) {
            ganttHTML += `<span class="worker-badge-small">${crewInfo}</span>`;
        }
        ganttHTML += '</div></div></div></div>';
    });

    chart.innerHTML = ganttHTML;
}

// ============================================================================
// Worker/Job Management Functions
// ============================================================================

/**
 * Assign a worker to a job
 * @param {number} jobId - The job ID
 */
function assignWorker(jobId) {
    const select = document.getElementById(`assign-${jobId}`);
    const workerId = parseInt(select.value);

    if (!workerId) return;

    const job = jobs.find(j => j.id === jobId);
    const worker = workers.find(w => w.id === workerId);

    if (job && worker && job.crew.length < job.crewSize) {
        job.crew.push(workerId);
        worker.status = 'assigned';
        saveData();
        renderWorkers();
        renderJobs();
        renderGantt();
        updateStats();
    }
}

/**
 * Unassign a worker from a job
 * @param {number} jobId - The job ID
 * @param {number} workerId - The worker ID
 */
function unassignWorker(jobId, workerId) {
    const job = jobs.find(j => j.id === jobId);
    const worker = workers.find(w => w.id === workerId);

    if (job && worker) {
        job.crew = job.crew.filter(id => id !== workerId);
        worker.status = 'available';
        saveData();
        renderWorkers();
        renderJobs();
        renderGantt();
        updateStats();
    }
}

/**
 * Remove a worker
 * @param {number} id - The worker ID
 */
function removeWorker(id) {
    // Remove from any jobs first
    jobs.forEach(job => {
        job.crew = job.crew.filter(wId => wId !== id);
    });
    workers = workers.filter(w => w.id !== id);
    saveData();
    renderWorkers();
    renderJobs();
    renderGantt();
    updateStats();
}

/**
 * Remove a job
 * @param {number} id - The job ID
 */
function removeJob(id) {
    const job = jobs.find(j => j.id === id);
    // Free up assigned workers
    if (job && job.crew) {
        job.crew.forEach(workerId => {
            const worker = workers.find(w => w.id === workerId);
            if (worker) worker.status = 'available';
        });
    }
    jobs = jobs.filter(j => j.id !== id);
    saveData();
    renderWorkers();
    renderJobs();
    renderGantt();
    updateStats();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date for display
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Update dashboard statistics
 */
function updateStats() {
    document.getElementById('totalWorkers').textContent = workers.length;
    document.getElementById('totalJobs').textContent = jobs.length;

    const assigned = workers.filter(w => w.status === 'assigned').length;
    document.getElementById('workersAssigned').textContent = assigned;

    const utilization = workers.length > 0 ? Math.round((assigned / workers.length) * 100) : 0;
    document.getElementById('utilizationRate').textContent = utilization + '%';
}

// ============================================================================
// Data Persistence (Firebase / localStorage)
// ============================================================================

/**
 * Save data to Firebase or localStorage
 */
function saveData() {
    if (database) {
        // Save to Firebase
        database.ref('workers').set(workers);
        database.ref('jobs').set(jobs);
    } else {
        // Fallback to localStorage
        localStorage.setItem('workers', JSON.stringify(workers));
        localStorage.setItem('jobs', JSON.stringify(jobs));
    }
}

/**
 * Initialize data from Firebase or localStorage
 * Sets up real-time listeners if Firebase is available
 */
function initializeData() {
    if (database) {
        // Listen for workers changes
        database.ref('workers').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                workers = data;
                renderWorkers();
                updateStats();
            }
        });

        // Listen for jobs changes
        database.ref('jobs').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                jobs = data;
                renderJobs();
                updateStats();
            }
        });
    } else {
        // Fallback to localStorage
        workers = JSON.parse(localStorage.getItem('workers')) || [];
        jobs = JSON.parse(localStorage.getItem('jobs')) || [];
        renderWorkers();
        renderJobs();
        updateStats();
    }
}

// ============================================================================
// Initialize Application
// ============================================================================

// Initialize Firebase (from firebase-config.js)
initializeFirebase();

// Load data and start the app
initializeData();
