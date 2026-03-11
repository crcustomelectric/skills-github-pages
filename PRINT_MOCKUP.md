# 🖨️ Print Schedule Mockup

## Print Features

The Man Loader now includes a professional print-friendly layout optimized for physical crew schedules.

---

## Print Layout Preview

```
┌────────────────────────────────────────────────────────────────────────┐
│  [LOGO]  CR Custom Electric - Man Loader                              │
│          3-Week Crew Schedule                                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week Range: Jan 13 – Feb 2, 2025                                     │
│                                                                         │
├─────────────┬────────┬────────┬────────┬────────┬────────┬────────────┤
│             │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │   Sat      │
│ Team Roster │  1/13  │  1/14  │  1/15  │  1/16  │  1/17  │   1/18     │
├─────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│             │        │        │        │        │        │            │
│ ▌John Smith │  Need: 2        │        │        │        │            │
│  Foreman    │  ▌J.Smith       │        │        │        │            │
│ ────────────│  ▌M.Jones       │        │        │        │            │
│             │                 │        │        │        │            │
│ ▌Mike Jones │                          │        │        │            │
│  Journeyman │                          │        │        │            │
│ ────────────│                          │        │        │            │
│             │                                   │        │            │
│ ▌Bob Lee    │                                   │        │            │
│  Apprentice │                                   │        │        │            │
│             │                                            │            │
├═════════════╪════════╪════════╪════════╪════════╪════════╪════════════┤
│ JOBS        │        │        │        │        │        │            │
├─────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│ Main St     │ Need:2 │ Need:3 │ Need:2 │ Need:0 │ Need:0 │ Need:0     │
│ Commercial  │▌Smith  │▌Smith  │▌Smith  │        │        │            │
│ 123 Main St │▌Jones  │▌Jones  │▌Jones  │        │        │            │
│             │        │▌Lee    │        │        │        │            │
├─────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│ Oakwood     │ Need:1 │ Need:1 │ Need:1 │ Need:2 │ Need:2 │ Need:0     │
│ Residential │▌Lee    │▌Lee    │▌Lee    │▌Smith  │▌Smith  │            │
│ 456 Oak Ave │        │        │        │▌Jones  │▌Jones  │            │
├─────────────┼────────┼────────┼────────┼────────┼────────┼────────────┤
│             │ (Continues for 3 weeks, Monday-Saturday)               │
└─────────────┴────────┴────────┴────────┴────────┴────────┴────────────┘

                                    Printed: Monday, January 13, 2025 2:30 PM
```

---

## Print Optimizations

### 📄 **Page Setup**
- **Orientation**: Landscape (automatic)
- **Margins**: 0.5 inches all around
- **Paper Size**: Letter (8.5" × 11")
- **Font Size**: 8-10pt (optimized for readability)

### 🎨 **Visual Design**
- **Black & White**: Ink-friendly, no colors
- **Bold Headers**: Easy to scan
- **Bordered Tables**: Clean grid lines
- **Worker Indicators**: Left border bars show roles
  - ▌▌ Bold black = Foreman
  - ▌  Medium gray = Journeyman
  - ▌  Light gray = Apprentice

### 📋 **What's Hidden**
All interactive elements are hidden in print:
- ❌ Buttons (Add, Remove, Edit)
- ❌ Dropdowns and inputs
- ❌ Navigation arrows
- ❌ Modals
- ❌ Drag handles
- ❌ Mobile cards (shows desktop grid)

### ✅ **What's Shown**
Only essential scheduling information:
- ✅ Company header and logo
- ✅ Date range
- ✅ Team roster (left sidebar)
- ✅ 3-week daily grid (Mon-Sat)
- ✅ Job names and locations
- ✅ Worker assignments per day
- ✅ Demand counts
- ✅ Print timestamp (bottom right)

---

## Usage

### **Desktop:**
Click the green **🖨️ Print** button → Opens print dialog

### **Mobile:**
Click **🖨️ Print** → Temporarily switches to desktop view for printing → Restores mobile view after

### **Print Preview:**
Use browser's print preview (Ctrl+P / Cmd+P) to see before printing

---

## Page Break Behavior

- **Jobs**: Won't split across pages
- **Headers**: Repeat on each page
- **Weeks**: Try to keep together when possible
- **Roster**: Prints on first page only

---

## Customization Options

Want to customize? Here's what you can adjust in `css/styles.css`:

```css
@media print {
    @page {
        size: landscape;      /* or portrait */
        margin: 0.5in;        /* adjust margins */
    }

    .schedule-table {
        font-size: 8pt;       /* increase/decrease text */
    }

    .worker-token {
        font-size: 7pt;       /* worker name size */
    }
}
```

---

## Tips for Best Results

1. **Use Print Preview** before printing to check layout
2. **Landscape mode** fits more days on one page
3. **Print to PDF** to save digital copies
4. **Black & White** setting saves ink
5. **Scale**: Use 100% (don't shrink to fit)

---

## Example Use Cases

### **Weekly Crew Meetings**
Print the 3-week schedule, mark it up during the meeting, then update the app.

### **Job Site Foreman**
Print current week + next week, keep in truck for reference.

### **Office Board**
Print and post on bulletin board for crew to check.

### **Client Records**
Print and file with job documentation.

---

## Future Enhancements (Optional)

Could add:
- **Print Modes**: Daily crew sheets vs weekly grid
- **Custom Date Ranges**: Print specific weeks
- **Worker-Specific**: Print one worker's schedule
- **Job-Specific**: Print one job's crew history
- **QR Code**: Link back to live schedule

Let me know if you want any of these!
