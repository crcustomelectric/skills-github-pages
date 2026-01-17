/**
 * CR Custom Electric - Man Loader Application
 * Enhanced with foreman tracking, divisions, and manpower forecasting
 */

// Data storage
let workers = [];
let jobs = [];
let assignments = [];
let currentDivision = 'all'; // all, commercial, residential
let editingWorkerId = null; // Track which worker is being edited

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Toggle settings modal
 */
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('active');
}

/**
 * Toggle collapsible sections
 */
function toggleCollapsible(header) {
    const collapsible = header.parentElement;
    collapsible.classList.toggle('active');
}

/**
 * Switch division view
 */
function switchDivision(division) {
    currentDivision = division;

    // Update tab styling
    document.querySelectorAll('.division-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Re-render all views
    renderAssignments();
    renderGantt();
    renderManpowerGraph();
    updateStats();
}

// ============================================================================
// Form Event Handlers
// ============================================================================

// Add worker form submission
document.getElementById('workerForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (editingWorkerId !== null) {
        // Edit existing worker
        const worker = workers.find(w => w.id === editingWorkerId);
        if (worker) {
            worker.name = document.getElementById('workerName').value;
            worker.role = document.getElementById('workerRole').value;
            worker.division = document.getElementById('workerDivision').value;
            worker.isForeman = document.getElementById('workerIsForeman').checked;
        }
        editingWorkerId = null;
        document.querySelector('#workerForm button[type="submit"]').textContent = 'Add Worker';

        // Remove cancel button if it exists
        const cancelBtn = document.getElementById('cancelEditWorker');
        if (cancelBtn) cancelBtn.remove();
    } else {
        // Add new worker
        const worker = {
            id: Date.now(),
            name: document.getElementById('workerName').value,
            role: document.getElementById('workerRole').value,
            division: document.getElementById('workerDivision').value,
            isForeman: document.getElementById('workerIsForeman').checked,
            status: 'available'
        };
        workers.push(worker);
    }

    saveData();
    renderWorkers();
    renderManpowerGraph();
    updateStats();
    this.reset();
});

// Add job form submission
document.getElementById('jobForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const job = {
        id: Date.now(),
        name: document.getElementById('jobName').value,
        division: document.getElementById('jobDivision').value,
        location: document.getElementById('jobLocation').value,
        startDate: document.getElementById('jobStartDate').value,
        endDate: document.getElementById('jobEndDate').value,
        hours: document.getElementById('jobHours').value,
        crewSize: document.getElementById('jobCrewSize').value,
        crew: [],
        foreman: null
    };
    jobs.push(job);
    saveData();
    renderJobs();
    renderGantt();
    renderManpowerGraph();
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
                <span class="badge badge-${worker.division}">${worker.division.toUpperCase()}</span>
                ${worker.isForeman ? '<span class="badge badge-foreman">FOREMAN</span>' : ''}
                <span class="badge badge-${worker.status}">${worker.status.toUpperCase()}</span>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editWorker(${worker.id})">Edit</button>
                <button class="btn-remove" onclick="removeWorker(${worker.id})">Remove</button>
            </div>
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
        const foremanName = job.foreman ? workers.find(w => w.id === job.foreman)?.name || 'None' : 'None';
        const needsForeman = !job.foreman;

        return `
            <div class="item-card">
                <div class="item-info">
                    <strong>${job.name}</strong>
                    <span class="badge badge-${job.division}">${job.division.toUpperCase()}</span>
                    ${needsForeman ? '<span class="badge" style="background: #FFA726;">⚠ NO FOREMAN</span>' : ''}
                    <div class="details">
                        ${job.location} • ${dateRange} • ${job.hours}hrs • ${job.crew.length}/${job.crewSize} crew • Foreman: ${foremanName}
                    </div>
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

    // Filter jobs by division
    let filteredJobs = jobs;
    if (currentDivision !== 'all') {
        filteredJobs = jobs.filter(job => job.division === currentDivision);
    }

    const activeJobs = filteredJobs.filter(job => job.crew && job.crew.length > 0 || job.foreman);

    if (activeJobs.length === 0) {
        list.innerHTML = '<div class="empty-state">No assignments yet. Assign workers and foremen to job sites.</div>';
        return;
    }

    list.innerHTML = activeJobs.map(job => {
        const crewMembers = job.crew.map(workerId => {
            const worker = workers.find(w => w.id === workerId);
            return worker ? `
                <div class="crew-member">
                    <span>${worker.name} (${worker.role})${worker.isForeman ? ' 👷‍♂️' : ''}</span>
                    <button onclick="unassignWorker(${job.id}, ${workerId})">×</button>
                </div>
            ` : '';
        }).join('');

        // Get available workers for this job's division
        const availableWorkers = workers.filter(w => {
            if (w.status !== 'available') return false;
            if (w.division === 'both') return true;
            return w.division === job.division;
        });

        // Get available foremen for this job's division
        const availableForemen = workers.filter(w => {
            if (!w.isForeman) return false;
            if (w.status !== 'available' && job.foreman !== w.id) return false;
            if (w.division === 'both') return true;
            return w.division === job.division;
        });

        const needsMoreCrew = job.crew.length < job.crewSize;
        const needsForeman = !job.foreman;
        const foremanWorker = job.foreman ? workers.find(w => w.id === job.foreman) : null;

        return `
            <div class="assignment-card">
                <div class="assignment-header">
                    <h3>${job.name}</h3>
                    <span class="badge badge-${job.division}">${job.division.toUpperCase()}</span>
                    <span>${job.crew.length}/${job.crewSize} Crew Members</span>
                </div>
                <div class="details" style="color: #6c757d; margin-bottom: 10px;">
                    📍 ${job.location} • ⏱️ ${job.hours} hours • ${formatDate(job.startDate)} - ${formatDate(job.endDate)}
                </div>

                <!-- Foreman Assignment -->
                <div style="margin-bottom: 15px; padding: 10px; background: ${needsForeman ? '#FFF3CD' : '#D4EDDA'}; border-radius: 6px;">
                    <strong>👷‍♂️ Foreman: </strong>
                    ${foremanWorker ? `
                        ${foremanWorker.name} (${foremanWorker.role})
                        <button class="btn-remove" style="margin-left: 10px;" onclick="unassignForeman(${job.id})">Remove</button>
                    ` : `
                        <span style="color: #856404;">⚠ No foreman assigned - project cannot run!</span>
                    `}
                    ${needsForeman && availableForemen.length > 0 ? `
                        <div style="margin-top: 10px;">
                            <select id="assign-foreman-${job.id}" style="width: auto; display: inline-block; margin-right: 10px;">
                                <option value="">Select foreman</option>
                                ${availableForemen.map(w => `
                                    <option value="${w.id}">${w.name} (${w.role} - ${w.division})</option>
                                `).join('')}
                            </select>
                            <button class="btn-assign" onclick="assignForeman(${job.id})">Assign Foreman</button>
                        </div>
                    ` : ''}
                </div>

                <!-- Crew Members -->
                <div class="crew-members">
                    ${crewMembers || '<span style="color: #6c757d;">No crew assigned</span>'}
                </div>

                ${needsMoreCrew && availableWorkers.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <select id="assign-${job.id}" style="width: auto; display: inline-block; margin-right: 10px;">
                            <option value="">Select worker to assign</option>
                            ${availableWorkers.map(w => `
                                <option value="${w.id}">${w.name} (${w.role} - ${w.division})${w.isForeman ? ' 👷‍♂️' : ''}</option>
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

    // Filter jobs by division
    let filteredJobs = jobs;
    if (currentDivision !== 'all') {
        filteredJobs = jobs.filter(job => job.division === currentDivision);
    }

    if (filteredJobs.length === 0) {
        chart.innerHTML = '<div class="empty-state">No jobs to display. Add jobs with start and end dates to see the schedule.</div>';
        return;
    }

    // Filter jobs with dates
    const jobsWithDates = filteredJobs.filter(job => job.startDate && job.endDate);

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

    // Generate timeline markers
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

        const foremanWorker = job.foreman ? workers.find(w => w.id === job.foreman) : null;
        const foremanName = foremanWorker ? '👷‍♂️' + foremanWorker.name.split(' ')[0] : '⚠️';

        ganttHTML += '<div class="gantt-row">';
        ganttHTML += '<div class="gantt-row-label">';
        ganttHTML += `<strong>${job.name}</strong>`;
        ganttHTML += `<div class="dates">${formatDate(job.startDate)} - ${formatDate(job.endDate)}</div>`;
        ganttHTML += '</div>';
        ganttHTML += '<div class="gantt-bar-container">';
        ganttHTML += `<div class="gantt-bar ${job.division}" style="left: ${startOffset}%; width: ${duration}%;">`;
        ganttHTML += '<div class="gantt-bar-content">';
        ganttHTML += `${foremanName} • ${job.crew.length}/${job.crewSize}`;
        if (crewInfo) {
            ganttHTML += `<span class="worker-badge-small">${crewInfo}</span>`;
        }
        ganttHTML += '</div></div></div></div>';
    });

    chart.innerHTML = ganttHTML;
}

/**
 * Render manpower needs graph over time
 */
function renderManpowerGraph() {
    const canvas = document.getElementById('manpowerChart');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 300;

    // Filter jobs by division
    let filteredJobs = jobs;
    if (currentDivision !== 'all') {
        filteredJobs = jobs.filter(job => job.division === currentDivision);
    }

    // Get date range
    const jobsWithDates = filteredJobs.filter(job => job.startDate && job.endDate);

    if (jobsWithDates.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No scheduled jobs to display', canvas.width / 2, canvas.height / 2);
        return;
    }

    const allDates = jobsWithDates.flatMap(job => [new Date(job.startDate), new Date(job.endDate)]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    // Calculate manpower needs for each day
    const dailyNeeds = [];
    let currentDate = new Date(minDate);

    while (currentDate <= maxDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        let workersNeeded = 0;

        jobsWithDates.forEach(job => {
            const jobStart = new Date(job.startDate);
            const jobEnd = new Date(job.endDate);

            if (currentDate >= jobStart && currentDate <= jobEnd) {
                workersNeeded += parseInt(job.crewSize);
            }
        });

        dailyNeeds.push({
            date: new Date(currentDate),
            needed: workersNeeded
        });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count available workers
    const availableWorkersCount = workers.filter(w => {
        if (currentDivision === 'all') return true;
        return w.division === currentDivision || w.division === 'both';
    }).length;

    // Draw graph
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 40;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;

    const maxWorkers = Math.max(...dailyNeeds.map(d => d.needed), availableWorkersCount) + 2;
    const xStep = graphWidth / (dailyNeeds.length - 1 || 1);

    // Draw axes
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();

    // Draw available workers line
    const availableLine = canvas.height - padding - (availableWorkersCount / maxWorkers) * graphHeight;
    ctx.strokeStyle = '#28a745';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, availableLine);
    ctx.lineTo(canvas.width - padding, availableLine);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw label for available workers
    ctx.fillStyle = '#28a745';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Available: ${availableWorkersCount}`, padding - 5, availableLine + 4);

    // Draw needed workers line
    ctx.strokeStyle = '#0056A0';
    ctx.lineWidth = 3;
    ctx.beginPath();

    dailyNeeds.forEach((day, i) => {
        const x = padding + i * xStep;
        const y = canvas.height - padding - (day.needed / maxWorkers) * graphHeight;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Fill shortage areas
    ctx.fillStyle = 'rgba(211, 47, 47, 0.2)';
    ctx.beginPath();

    dailyNeeds.forEach((day, i) => {
        const x = padding + i * xStep;
        const neededY = canvas.height - padding - (day.needed / maxWorkers) * graphHeight;

        if (day.needed > availableWorkersCount) {
            if (i === 0) {
                ctx.moveTo(x, availableLine);
            } else {
                ctx.lineTo(x, availableLine);
            }
        }
    });

    for (let i = dailyNeeds.length - 1; i >= 0; i--) {
        const day = dailyNeeds[i];
        const x = padding + i * xStep;
        const neededY = canvas.height - padding - (day.needed / maxWorkers) * graphHeight;

        if (day.needed > availableWorkersCount) {
            ctx.lineTo(x, neededY);
        }
    }

    ctx.closePath();
    ctx.fill();

    // Draw Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
        const value = Math.round((maxWorkers / 5) * i);
        const y = canvas.height - padding - (i / 5) * graphHeight;
        ctx.fillText(value.toString(), padding - 5, y + 4);
    }

    // Draw X-axis labels (show every 7 days or so)
    ctx.textAlign = 'center';
    const labelInterval = Math.max(1, Math.floor(dailyNeeds.length / 10));

    dailyNeeds.forEach((day, i) => {
        if (i % labelInterval === 0) {
            const x = padding + i * xStep;
            const dateStr = formatDate(day.date.toISOString().split('T')[0]);
            ctx.fillText(dateStr, x, canvas.height - padding + 20);
        }
    });
}

// ============================================================================
// Worker/Job Management Functions
// ============================================================================

/**
 * Assign a foreman to a job
 */
function assignForeman(jobId) {
    const select = document.getElementById(`assign-foreman-${jobId}`);
    const foremanId = parseInt(select.value);

    if (!foremanId) return;

    const job = jobs.find(j => j.id === jobId);
    const foreman = workers.find(w => w.id === foremanId);

    if (job && foreman && foreman.isForeman) {
        // If foreman was previously assigned elsewhere, free them up
        if (job.foreman) {
            const oldForeman = workers.find(w => w.id === job.foreman);
            if (oldForeman) oldForeman.status = 'available';
        }

        job.foreman = foremanId;
        foreman.status = 'assigned';
        saveData();
        renderWorkers();
        renderJobs();
        renderGantt();
        updateStats();
    }
}

/**
 * Unassign foreman from a job
 */
function unassignForeman(jobId) {
    const job = jobs.find(j => j.id === jobId);

    if (job && job.foreman) {
        const foreman = workers.find(w => w.id === job.foreman);
        if (foreman) foreman.status = 'available';

        job.foreman = null;
        saveData();
        renderWorkers();
        renderJobs();
        renderGantt();
        updateStats();
    }
}

/**
 * Assign a worker to a job
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
        renderManpowerGraph();
        updateStats();
    }
}

/**
 * Unassign a worker from a job
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
        renderManpowerGraph();
        updateStats();
    }
}

/**
 * Edit a worker
 */
function editWorker(id) {
    const worker = workers.find(w => w.id === id);
    if (!worker) return;

    // Populate form with worker data
    document.getElementById('workerName').value = worker.name;
    document.getElementById('workerRole').value = worker.role;
    document.getElementById('workerDivision').value = worker.division;
    document.getElementById('workerIsForeman').checked = worker.isForeman;

    // Update submit button text
    const submitBtn = document.querySelector('#workerForm button[type="submit"]');
    submitBtn.textContent = 'Update Worker';

    // Add cancel button if it doesn't exist
    if (!document.getElementById('cancelEditWorker')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditWorker';
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = cancelEditWorker;
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }

    // Set editing mode
    editingWorkerId = id;

    // Scroll to form
    document.querySelector('#workerForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Cancel editing a worker
 */
function cancelEditWorker() {
    editingWorkerId = null;
    document.getElementById('workerForm').reset();
    document.querySelector('#workerForm button[type="submit"]').textContent = 'Add Worker';

    const cancelBtn = document.getElementById('cancelEditWorker');
    if (cancelBtn) cancelBtn.remove();
}

/**
 * Remove a worker
 */
function removeWorker(id) {
    // Remove from any jobs first
    jobs.forEach(job => {
        job.crew = job.crew.filter(wId => wId !== id);
        if (job.foreman === id) job.foreman = null;
    });
    workers = workers.filter(w => w.id !== id);
    saveData();
    renderWorkers();
    renderJobs();
    renderGantt();
    renderManpowerGraph();
    updateStats();
}

/**
 * Remove a job
 */
function removeJob(id) {
    const job = jobs.find(j => j.id === id);
    // Free up assigned workers
    if (job) {
        if (job.crew) {
            job.crew.forEach(workerId => {
                const worker = workers.find(w => w.id === workerId);
                if (worker) worker.status = 'available';
            });
        }
        if (job.foreman) {
            const foreman = workers.find(w => w.id === job.foreman);
            if (foreman) foreman.status = 'available';
        }
    }
    jobs = jobs.filter(j => j.id !== id);
    saveData();
    renderWorkers();
    renderJobs();
    renderGantt();
    renderManpowerGraph();
    updateStats();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date for display
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

    const totalForemen = workers.filter(w => w.isForeman).length;
    document.getElementById('totalForemen').textContent = totalForemen;

    const foremenAvailable = workers.filter(w => w.isForeman && w.status === 'available').length;
    document.getElementById('foremenAvailable').textContent = foremenAvailable;
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
    } else {
        localStorage.setItem('workers', JSON.stringify(workers));
        localStorage.setItem('jobs', JSON.stringify(jobs));
    }
}

/**
 * Initialize data from Firebase or localStorage
 */
function initializeData() {
    if (database) {
        // Listen for workers changes
        database.ref('workers').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                workers = data;
                renderWorkers();
                renderManpowerGraph();
                updateStats();
            }
        });

        // Listen for jobs changes
        database.ref('jobs').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                jobs = data;
                renderJobs();
                renderManpowerGraph();
                updateStats();
            }
        });
    } else {
        // Fallback to localStorage
        workers = JSON.parse(localStorage.getItem('workers')) || [];
        jobs = JSON.parse(localStorage.getItem('jobs')) || [];
        renderWorkers();
        renderJobs();
        renderManpowerGraph();
        updateStats();
    }
}

// ============================================================================
// CSV Import/Export Functions
// ============================================================================

/**
 * Import workers from CSV file
 */
function importWorkersCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');

        let importedCount = 0;
        let errorCount = 0;
        const errors = [];

        console.log('=== CSV IMPORT: WORKERS ===');
        console.log(`Total lines in file: ${lines.length}`);
        console.log('Expected format: name,role,division,isForeman');
        console.log('Valid roles: foreman, journeyman, apprentice');
        console.log('Valid divisions: commercial, residential, both');
        console.log('Valid isForeman: true, false');
        console.log('---');

        // Skip header row and process data
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                console.log(`Row ${i + 1}: Skipped (empty line)`);
                continue;
            }

            const rowNum = i + 1;
            const parts = line.split(',').map(s => s.trim());
            const [name, role, division, isForeman] = parts;

            console.log(`Row ${rowNum}: Processing "${line}"`);
            console.log(`  Parsed as: name="${name}", role="${role}", division="${division}", isForeman="${isForeman}"`);

            // Validate data
            if (!name || !role || !division) {
                const missing = [];
                if (!name) missing.push('name');
                if (!role) missing.push('role');
                if (!division) missing.push('division');
                const error = `Row ${rowNum}: Missing required fields: ${missing.join(', ')}`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            if (!['foreman', 'journeyman', 'apprentice'].includes(role)) {
                const error = `Row ${rowNum}: Invalid role "${role}" for ${name}. Must be: foreman, journeyman, or apprentice`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            if (!['commercial', 'residential', 'both'].includes(division)) {
                const error = `Row ${rowNum}: Invalid division "${division}" for ${name}. Must be: commercial, residential, or both`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            // Create worker
            const worker = {
                id: Date.now() + i,
                name: name,
                role: role,
                division: division,
                isForeman: isForeman === 'true',
                status: 'available'
            };

            workers.push(worker);
            importedCount++;
            console.log(`✅ Row ${rowNum}: Successfully imported ${name}`);
        }

        saveData();
        renderWorkers();
        renderManpowerGraph();
        updateStats();

        console.log('---');
        console.log(`SUMMARY: ✅ ${importedCount} imported, ❌ ${errorCount} errors`);
        if (errors.length > 0) {
            console.log('\nDETAILED ERRORS:');
            errors.forEach(err => console.log(`  ${err}`));
        }

        let message = `Import complete!\n✅ Imported: ${importedCount} workers`;
        if (errorCount > 0) {
            message += `\n❌ Errors: ${errorCount}\n\nCheck browser console (F12) for detailed error log.`;
            message += `\n\nFirst error: ${errors[0]}`;
        }
        alert(message);

        // Reset file input
        event.target.value = '';
    };

    reader.readAsText(file);
}

/**
 * Import jobs from CSV file
 */
function importJobsCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');

        let importedCount = 0;
        let errorCount = 0;
        const errors = [];

        console.log('=== CSV IMPORT: JOBS ===');
        console.log(`Total lines in file: ${lines.length}`);
        console.log('Expected format: name,division,location,startDate,endDate,hours,crewSize');
        console.log('Valid divisions: commercial, residential');
        console.log('Date format: YYYY-MM-DD (e.g., 2024-02-15)');
        console.log('---');

        // Skip header row and process data
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                console.log(`Row ${i + 1}: Skipped (empty line)`);
                continue;
            }

            const rowNum = i + 1;
            const parts = line.split(',').map(s => s.trim());
            const [name, division, location, startDate, endDate, hours, crewSize] = parts;

            console.log(`Row ${rowNum}: Processing "${line}"`);
            console.log(`  Parsed as: name="${name}", division="${division}", location="${location}"`);
            console.log(`  Dates: start="${startDate}", end="${endDate}"`);
            console.log(`  Details: hours="${hours}", crewSize="${crewSize}"`);

            // Validate data
            if (!name || !division || !location || !startDate || !endDate || !hours || !crewSize) {
                const missing = [];
                if (!name) missing.push('name');
                if (!division) missing.push('division');
                if (!location) missing.push('location');
                if (!startDate) missing.push('startDate');
                if (!endDate) missing.push('endDate');
                if (!hours) missing.push('hours');
                if (!crewSize) missing.push('crewSize');
                const error = `Row ${rowNum}: Missing required fields: ${missing.join(', ')}`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            if (!['commercial', 'residential'].includes(division)) {
                const error = `Row ${rowNum}: Invalid division "${division}" for ${name}. Must be: commercial or residential`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            // Validate dates
            if (isNaN(Date.parse(startDate))) {
                const error = `Row ${rowNum}: Invalid start date "${startDate}" for ${name}. Use format: YYYY-MM-DD`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            if (isNaN(Date.parse(endDate))) {
                const error = `Row ${rowNum}: Invalid end date "${endDate}" for ${name}. Use format: YYYY-MM-DD`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            // Validate numeric fields
            if (isNaN(parseInt(hours))) {
                const error = `Row ${rowNum}: Invalid hours "${hours}" for ${name}. Must be a number`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            if (isNaN(parseInt(crewSize))) {
                const error = `Row ${rowNum}: Invalid crew size "${crewSize}" for ${name}. Must be a number`;
                console.error(`❌ ${error}`);
                errors.push(error);
                errorCount++;
                continue;
            }

            // Create job
            const job = {
                id: Date.now() + i,
                name: name,
                division: division,
                location: location,
                startDate: startDate,
                endDate: endDate,
                hours: hours,
                crewSize: crewSize,
                crew: [],
                foreman: null
            };

            jobs.push(job);
            importedCount++;
            console.log(`✅ Row ${rowNum}: Successfully imported ${name}`);
        }

        saveData();
        renderJobs();
        renderGantt();
        renderManpowerGraph();
        updateStats();

        console.log('---');
        console.log(`SUMMARY: ✅ ${importedCount} imported, ❌ ${errorCount} errors`);
        if (errors.length > 0) {
            console.log('\nDETAILED ERRORS:');
            errors.forEach(err => console.log(`  ${err}`));
        }

        let message = `Import complete!\n✅ Imported: ${importedCount} jobs`;
        if (errorCount > 0) {
            message += `\n❌ Errors: ${errorCount}\n\nCheck browser console (F12) for detailed error log.`;
            message += `\n\nFirst error: ${errors[0]}`;
        }
        alert(message);

        // Reset file input
        event.target.value = '';
    };

    reader.readAsText(file);
}

/**
 * Download worker CSV template
 */
function downloadWorkerTemplate() {
    const csv = `name,role,division,isForeman
John Smith,journeyman,commercial,false
Jane Doe,apprentice,residential,false
Mike Jones,foreman,both,true
Sarah Williams,journeyman,commercial,false
Tom Brown,foreman,residential,true`;

    downloadCSV(csv, 'worker_template.csv');
}

/**
 * Download job CSV template
 */
function downloadJobTemplate() {
    const csv = `name,division,location,startDate,endDate,hours,crewSize
Downtown Office Building,commercial,123 Main St,2024-02-01,2024-03-15,160,4
Smith Residence,residential,456 Oak Ave,2024-02-10,2024-02-28,80,2
Warehouse Expansion,commercial,789 Industrial Pkwy,2024-03-01,2024-04-30,320,6
Jones House Rewire,residential,321 Elm St,2024-02-15,2024-03-01,60,2`;

    downloadCSV(csv, 'job_template.csv');
}

/**
 * Helper function to download CSV
 */
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// Initialize Application
// ============================================================================

// Initialize Firebase (from firebase-config.js)
initializeFirebase();

// Load data and start the app
initializeData();

// Close modal when clicking outside
document.getElementById('settingsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        toggleSettings();
    }
});
