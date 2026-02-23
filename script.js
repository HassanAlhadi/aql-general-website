document.addEventListener('DOMContentLoaded', () => {

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 3D Tilt Effect for Service Cards & New Products
    const tiltCards = document.querySelectorAll('.tilt-card, .ai-product-card, .teaser-card');

    tiltCards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within the element.
            const y = e.clientY - rect.top;  // y position within the element.

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -10; // Max rotation 10deg
            const rotateY = ((x - centerX) / centerX) * 10;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

            // Adjust glare/glow effect based on mouse position
            const glow = card.querySelector('.card-glow');
            if (glow) {
                glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(0, 242, 255, 0.15) 0%, transparent 70%)`;
            }
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            const glow = card.querySelector('.card-glow');
            if (glow) {
                glow.style.background = `radial-gradient(circle at center, rgba(0, 242, 255, 0.1) 0%, transparent 70%)`;
            }
        });
    });

    // Intersection Observer for Scroll Animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: stop observing once animated to keep it visible
                // observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.animate-up, .animate-left, .animate-right, .animate-in');
    animatedElements.forEach(el => observer.observe(el));

    // Initialize Particles.js
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            "particles": {
                "number": {
                    "value": 50,
                    "density": { "enable": true, "value_area": 800 }
                },
                "color": { "value": "#00f2ff" },
                "shape": {
                    "type": "circle",
                },
                "opacity": {
                    "value": 0.3,
                    "random": true,
                    "anim": { "enable": true, "speed": 1, "opacity_min": 0.1, "sync": false }
                },
                "size": {
                    "value": 3,
                    "random": true,
                    "anim": { "enable": false }
                },
                "line_linked": {
                    "enable": true,
                    "distance": 150,
                    "color": "#00f2ff",
                    "opacity": 0.1,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 1,
                    "direction": "none",
                    "random": true,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false,
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": {
                    "onhover": { "enable": true, "mode": "grab" },
                    "onclick": { "enable": true, "mode": "push" },
                    "resize": true
                },
                "modes": {
                    "grab": { "distance": 140, "line_linked": { "opacity": 0.5 } },
                    "push": { "particles_nb": 4 }
                }
            },
            "retina_detect": true
        });
    }

    // Bilingual (English/Arabic) Toggle Logic — Pill Switch
    const langSwitch = document.getElementById('lang-toggle');
    let currentLang = 'en';

    if (langSwitch) {
        const langOptions = langSwitch.querySelectorAll('.lang-option');
        for (const option of langOptions) {
            option.addEventListener('click', () => {
                const selectedLang = option.dataset.lang;
                if (selectedLang === currentLang) return;

                currentLang = selectedLang;

                // Update active state
                for (const opt of langOptions) {
                    opt.classList.toggle('active', opt.dataset.lang === currentLang);
                }

                // Move the slider
                if (currentLang === 'ar') {
                    langSwitch.classList.add('ar');
                } else {
                    langSwitch.classList.remove('ar');
                }

                // Update Document Direction
                document.documentElement.dir = currentLang === 'en' ? 'ltr' : 'rtl';
                document.documentElement.lang = currentLang;

                // Update Translatable Elements
                const translatableElements = document.querySelectorAll('.lang-text');
                for (const el of translatableElements) {
                    if (currentLang === 'ar' && el.dataset.ar) {
                        el.innerHTML = el.dataset.ar;
                    } else if (currentLang === 'en' && el.dataset.en) {
                        el.innerHTML = el.dataset.en;
                    }
                }
            });
        }
    }

    // Marquee: auto-clone content to fill any viewport width
    const marqueeContainer = document.querySelector('.marquee-container');
    if (marqueeContainer) {
        const firstContent = marqueeContainer.querySelector('.marquee-content');
        if (firstContent) {
            // Remove old duplicates (keep only the first)
            const oldDupes = marqueeContainer.querySelectorAll('.marquee-content:not(:first-child)');
            for (const dupe of oldDupes) {
                dupe.remove();
            }
            // Calculate how many copies we need: at least 2, more if content is narrower than viewport
            const contentWidth = firstContent.scrollWidth;
            const viewportWidth = window.innerWidth;
            const copiesNeeded = Math.max(2, Math.ceil((viewportWidth * 2) / contentWidth) + 1);
            for (let i = 1; i < copiesNeeded; i++) {
                const clone = firstContent.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                marqueeContainer.appendChild(clone);
            }
        }
    }

});
