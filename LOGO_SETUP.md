# Logo Setup Instructions

To add the CR Custom Electric logo to the website:

1. Save your logo image file to: `assets/images/logo.png`

   Recommended specifications:
   - Format: PNG with transparent background
   - Dimensions: 400-600px wide
   - Height: Proportional (will be displayed at 60px height)

2. The logo is already configured in `index.html` at line ~19:
   ```html
   <img src="assets/images/logo.png" alt="CR Custom Electric" class="header-logo">
   ```

3. If using a different filename or format, update the src attribute in index.html

## Alternative: Use Current Logo

Your logo file can be saved directly to the assets/images folder. Make sure the filename matches what's referenced in the HTML, or update the HTML to match your filename.

The header is already styled to accommodate the logo with proper sizing and positioning.
