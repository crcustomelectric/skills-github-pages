# CR Custom Electric - Man Loader

A dynamic crew management and job assignment system for commercial electrical contractors. Track workers, assign crews to projects, forecast manpower needs, and visualize utilization across your organization.

## 🔗 Live Application

**View the site:** [https://crcustomelectric.github.io/skills-github-pages/](https://crcustomelectric.github.io/skills-github-pages/)

## ✨ Features

### Dashboard & Analytics
- **Real-time Statistics**: Track total workers, foremen, active jobs, and utilization rates
- **Manpower Forecasting Graph**: Visualize future staffing needs to identify potential shortages
- **Gantt Chart**: View project timelines and resource allocation at a glance

### Division Management
- **Commercial & Residential Divisions**: Separate tracking for different business units
- **Cross-divisional Workers**: Some foremen can work across both divisions
- **Division Filtering**: Toggle between All Projects, Commercial, or Residential views

### Foreman Tracking
- **Leader Assignment**: Projects require a designated foreman to run
- **Foreman Availability**: Track which foremen are available vs. assigned
- **Validation**: Prevents project assignment without proper leadership

### Worker Management
- **Role-based Classification**: Foreman, Journeyman, Apprentice
- **Division Assignment**: Commercial, Residential, or Both (cross-divisional)
- **Foreman Designation**: Mark workers as foreman/leaders
- **Easy Add/Edit/Delete**: Manage your workforce through intuitive interface

### Job Site Management
- **Project Details**: Name, location, start/end dates, estimated hours
- **Crew Requirements**: Specify required crew size for each project
- **Division Tracking**: Assign jobs to Commercial or Residential divisions

### CSV Bulk Import
- **Quick Data Entry**: Upload CSV files to populate workers and jobs
- **Template Downloads**: Built-in templates for proper formatting
- **Validation**: Automatic error checking and reporting

### Real-time Collaboration
- **Firebase Integration**: Multi-user access with live data synchronization
- **Offline Fallback**: LocalStorage backup when Firebase is unavailable
- **Team Coordination**: Multiple team members can manage assignments simultaneously

## 🚀 Quick Start

1. **View the Application**: Navigate to [https://crcustomelectric.github.io/skills-github-pages/](https://crcustomelectric.github.io/skills-github-pages/)

2. **Add Workers**: Click the settings button (⚙️) and expand "Add Worker"
   - Enter name, role, division
   - Check "Foreman/Leader" if applicable
   - Or use CSV import for bulk additions

3. **Add Job Sites**: In settings, expand "Add Job Site"
   - Enter project details, dates, and crew size requirements
   - Or use CSV import for multiple jobs

4. **Assign Crews**: View job assignments and click "Assign Crew" to select workers for each project

5. **Monitor Utilization**: Use the dashboard to track workforce utilization and identify future staffing needs

## 📊 CSV Import Format

### Workers CSV
```csv
name,role,division,isForeman
John Smith,journeyman,commercial,false
Jane Doe,apprentice,residential,false
Mike Jones,foreman,both,true
```

**Fields:**
- `role`: foreman, journeyman, or apprentice
- `division`: commercial, residential, or both
- `isForeman`: true or false

### Jobs CSV
```csv
name,division,location,startDate,endDate,hours,crewSize
Downtown Office,commercial,123 Main St,2024-02-01,2024-03-15,160,4
Smith Residence,residential,456 Oak Ave,2024-02-10,2024-02-28,80,2
```

**Fields:**
- `division`: commercial or residential
- `startDate` & `endDate`: YYYY-MM-DD format
- `hours`: total estimated hours
- `crewSize`: number of workers needed

**Download templates** directly from the settings modal in the application.

## 🔧 Local Development

### Prerequisites
- Web browser (Chrome, Firefox, Safari, Edge)
- Text editor (VS Code, Sublime, etc.)
- Optional: Firebase account for multi-user collaboration

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/crcustomelectric/skills-github-pages.git
   cd skills-github-pages
   ```

2. Open `index.html` in your browser or use a local server:
   ```bash
   # Python 3
   python -m http.server 8000

   # Or use VS Code Live Server extension
   ```

3. (Optional) Configure Firebase for team collaboration:
   - See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed instructions
   - Update `js/firebase-config.js` with your Firebase credentials

### File Structure
```
skills-github-pages/
├── index.html              # Main application HTML
├── css/
│   └── styles.css         # Application styles with CR branding
├── js/
│   ├── firebase-config.js # Firebase configuration
│   └── app.js            # Main application logic
├── assets/
│   └── images/
│       ├── logo.png      # CR Custom Electric logo
│       └── README.md     # Logo setup instructions
├── FIREBASE_SETUP.md      # Firebase configuration guide
├── LOGO_SETUP.md         # Logo replacement instructions
└── PROJECT_README.md     # Detailed project documentation
```

## 🎨 Branding

The application uses CR Custom Electric's brand colors:
- Primary Blue: #0056A0
- Primary Red: #D32F2F
- Light Blue: #1976D2
- Dark Blue: #003D82

Font: Open Sans (Google Fonts)

To update the logo, see [LOGO_SETUP.md](LOGO_SETUP.md).

## 📖 Documentation

- **[PROJECT_README.md](PROJECT_README.md)**: Comprehensive project documentation
- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**: Firebase configuration instructions
- **[LOGO_SETUP.md](LOGO_SETUP.md)**: Logo customization guide

## 🤝 Contributing

This is a private application for CR Custom Electric. For internal feature requests or bug reports, please contact the development team.

## 📄 License

Proprietary - CR Custom Electric

---

**CR Custom Electric** | Crew Management & Job Assignment System
