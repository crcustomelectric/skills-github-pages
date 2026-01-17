# CR Custom Electric - Man Loader

A web-based crew management and scheduling system for commercial electrical contractors.

## Features

- **Worker Management**: Track electricians with names, roles, and certifications (Master, Journeyman, Apprentice)
- **Job Site Tracking**: Manage projects with locations, dates, hours, and crew requirements
- **Crew Assignment**: Assign workers to jobs and track availability
- **Gantt Chart Visualization**: Visual timeline showing project schedules and crew allocation
- **Real-time Collaboration**: Firebase-powered real-time sync for team collaboration
- **Utilization Dashboard**: Track worker utilization rates at a glance

## Project Structure

```
skills-github-pages/
├── index.html              # Main HTML structure
├── css/
│   └── styles.css          # All application styles
├── js/
│   ├── firebase-config.js  # Firebase configuration
│   └── app.js              # Main application logic
├── FIREBASE_SETUP.md       # Firebase setup instructions
└── PROJECT_README.md       # This file
```

## File Organization

### `index.html`
Clean HTML structure with no embedded styles or scripts. Links to external CSS and JavaScript files.

### `css/styles.css`
All application styles organized in logical sections:
- Reset and base styles
- Layout (container, header, dashboard)
- Forms and inputs
- Cards and badges
- Gantt chart visualization
- Responsive breakpoints

### `js/firebase-config.js`
Firebase initialization and configuration:
- Firebase config object (update with your credentials)
- Database initialization
- Error handling with localStorage fallback

### `js/app.js`
Main application logic organized into sections:
- Data storage (workers, jobs, assignments)
- Form event handlers
- Render functions (workers, jobs, assignments, Gantt chart)
- Worker/job management functions
- Utility functions
- Data persistence (Firebase/localStorage)
- Initialization

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/crcustomelectric/skills-github-pages.git
cd skills-github-pages
```

### 2. Set Up Firebase (Optional but Recommended)

For team collaboration features, follow the instructions in `FIREBASE_SETUP.md` to:
1. Create a Firebase project
2. Set up Realtime Database
3. Update `js/firebase-config.js` with your credentials

The app will work without Firebase using localStorage, but collaboration features require Firebase.

### 3. Deploy

#### Option A: GitHub Pages (Recommended)
1. Push to GitHub
2. Enable GitHub Pages in repository settings
3. Access at `https://yourusername.github.io/repository-name/`

#### Option B: Local Development
Simply open `index.html` in a web browser. For Firebase features, you'll need to serve over HTTP:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (with http-server)
npx http-server
```

Then visit `http://localhost:8000`

## Usage

### Adding Workers
1. Click "Add Worker" section
2. Enter name and select role/certification
3. Click "Add Worker" button

### Creating Job Sites
1. Click "Add Job Site" section
2. Fill in project details (name, location, dates, hours, crew size)
3. Click "Add Job Site" button

### Assigning Crews
1. Workers and jobs must be created first
2. In the "Job Assignments" section, select a worker from the dropdown
3. Click "Assign to Job"
4. Worker status changes from "Available" to "Assigned"

### Viewing Schedule
The Gantt chart automatically updates to show:
- Project timelines (start to end dates)
- Crew assignments per project
- Worker names on project bars
- Visual timeline with adaptive scaling

## Data Storage

### Without Firebase (Default)
- Data stored in browser localStorage
- Persists across sessions on same device
- Not shared between team members

### With Firebase
- Data synced to cloud database
- Real-time updates across all devices
- Team members see changes instantly
- No authentication required (trusted team environment)

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Customization

### Colors
Update colors in `css/styles.css`:
- Primary orange: `#FF6B00` and `#FF8C00`
- Primary blue: `#1e3c72` and `#2a5298`

### Roles
Add/modify worker roles in `index.html` (worker form) and update badge styles in `css/styles.css`.

### Features
All major functions are documented in `js/app.js` with JSDoc comments.

## Troubleshooting

### Styles Not Loading
- Check that `css/styles.css` path is correct
- Verify file exists and has proper permissions
- Check browser console for 404 errors

### JavaScript Errors
- Ensure `js/firebase-config.js` loads before `js/app.js`
- Check browser console for specific errors
- Verify Firebase SDK is loading from CDN

### Firebase Not Working
- Check `js/firebase-config.js` has correct credentials
- Verify database rules allow read/write access
- Check browser console for Firebase errors
- See `FIREBASE_SETUP.md` for detailed troubleshooting

### Gantt Chart Not Displaying
- Ensure jobs have start and end dates filled in
- Check that at least one job exists
- Verify jobs have valid date ranges

## Contributing

This is a private business tool, but you can:
1. Fork for your own company
2. Modify for your needs
3. Report issues
4. Suggest features

## License

See LICENSE file for details.

## Support

For issues or questions:
- Check `FIREBASE_SETUP.md` for setup help
- Review browser console for errors
- Contact your team administrator

---

Built for CR Custom Electric
