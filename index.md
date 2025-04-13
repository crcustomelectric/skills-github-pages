<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CR Custom Electric - The Valley's Trusted Electrical Partner</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <!-- Navigation Bar -->
    <nav class="top-nav">
        <div class="nav-container">
            <a href="index.html">
                <img src="images/logo.png" alt="CR Custom Electric" class="logo">
            </a>
            <button class="mobile-menu-btn" id="mobileMenuBtn">☰</button>
            <ul class="nav-links" id="navLinks">
                <li><a href="index.html" class="active">Home</a></li>
                <li><a href="about.html">About</a></li>
                <li><a href="projects.html">Projects</a></li>
                <li><a href="contact.html">Contact</a></li>
            </ul>
        </div>
    </nav>
    
    <!-- Hero Section -->
    <div class="hero">
        <div class="container">
            <h1>CR CUSTOM ELECTRIC</h1>
            <h2>The Valley's Trusted Electrical Partner Since 2001</h2>
            <p class="hero-subtitle">Specializing in commercial new construction, tenant improvements, and luxury custom homes</p>
            <div class="hero-buttons">
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
                <a href="projects.html" class="btn btn-secondary">View Our Projects</a>
            </div>
        </div>
    </div>
    
    <!-- Main Content -->
    <main>
        <div class="container">
            <section class="services-section">
                <div class="service-card">
                    <h3>COMMERCIAL EXPERTISE</h3>
                    <p>We provide comprehensive electrical contracting services for new commercial construction and tenant improvement projects throughout the Phoenix metro area. Our experienced teams deliver quality workmanship, reliable project management, and exceptional results that meet the demanding standards of today's commercial builders.</p>
                </div>
                
                <div class="service-card">
                    <h3>CUSTOM RESIDENTIAL</h3>
                    <p>For luxury custom homes, CR Custom Electric brings the same attention to detail and quality that defines our commercial work. We collaborate closely with luxury home builders to create sophisticated electrical systems that enhance both functionality and aesthetics.</p>
                </div>
            </section>
            
            <section class="why-choose-us">
                <h2>WHY GENERAL CONTRACTORS CHOOSE US</h2>
                <div class="benefits-grid">
                    <div class="benefit-item">
                        <div class="benefit-icon">✓</div>
                        <h4>20+ Years of Experience</h4>
                        <p>Serving Phoenix since 2001</p>
                    </div>
                    
                    <div class="benefit-item">
                        <div class="benefit-icon">✓</div>
                        <h4>Skilled Project Management</h4>
                        <p>Coordinated execution and clear communication</p>
                    </div>
                    
                    <div class="benefit-item">
                        <div class="benefit-icon">✓</div>
                        <h4>Quality Craftsmanship</h4>
                        <p>Exacting standards on every installation</p>
                    </div>
                    
                    <div class="benefit-item">
                        <div class="benefit-icon">✓</div>
                        <h4>Reliable Teams</h4>
                        <p>Experienced electricians with extensive training</p>
                    </div>
                    
                    <div class="benefit-item">
                        <div class="benefit-icon">✓</div>
                        <h4>Strong Relationships</h4>
                        <p>Built on trust and consistent performance</p>
                    </div>
                </div>
            </section>
            
            <section class="cta-section">
                <h2>Ready to discuss your project?</h2>
                <p>Contact us today to speak with our team about your commercial or high-end residential electrical needs.</p>
                <a href="contact.html" class="btn btn-primary">Contact Us</a>
            </section>
        </div>
    </main>
    
    <!-- Footer -->
    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo">
                    <img src="images/logo.png" alt="CR Custom Electric">
                    <p>The Valley's Trusted Electrical Partner Since 2001</p>
                </div>
                
                <div class="footer-links">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><a href="index.html">Home</a></li>
                        <li><a href="about.html">About</a></li>
                        <li><a href="projects.html">Projects</a></li>
                        <li><a href="contact.html">Contact</a></li>
                    </ul>
                </div>
                
                <div class="footer-contact">
                    <h4>Contact Information</h4>
                    <p>Phoenix Metropolitan Area</p>
                    <p>Phone: (602) XXX-XXXX</p>
                    <p>Email: info@crcustomelectric.com</p>
                    <p>Hours: Monday - Friday, 7:00 AM - 4:00 PM</p>
                </div>
            </div>
            
            <div class="footer-bottom">
                <p>&copy; 2025 CR Custom Electric | Licensed, Bonded & Insured | ROC# XXXXXX</p>
            </div>
        </div>
    </footer>
    
    <script>
        // Mobile menu toggle
        document.getElementById('mobileMenuBtn').addEventListener('click', function() {
            document.getElementById('navLinks').classList.toggle('active');
        });
    </script>
</body>
</html>
