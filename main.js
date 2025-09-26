window.addEventListener('load', function () {
  const preloader = document.getElementById('preloader');
  preloader.classList.add('fade-out');

  setTimeout(() => {
    preloader.style.display = 'none';
  }, 600);
});

document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  document.querySelectorAll('.HeaderNavComponent-name').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    document.body.classList.add('scrolled');
  } else {
    document.body.classList.remove('scrolled');
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const container = document.querySelector('.section-wrapper.sponsors-container');
  if (!container) return;

  const logos = Array.from(container.querySelectorAll('.sponsor-logo'));
  if (!logos.length) return;

  let triggered = false;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !triggered) {
          triggered = true;

          const STAGGER = 220;

          logos.forEach((logo, i) => {
            setTimeout(() => {
              logo.classList.add('animate');
            }, i * STAGGER);
          });

          observer.unobserve(container);
        }
      });
    },
    { threshold: 0.18 }
  );

  observer.observe(container);
});

document.addEventListener('DOMContentLoaded', () => {
  const elements = document.querySelectorAll('.about-text, .about-img');

  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  elements.forEach((el) => observer.observe(el));
});

document.addEventListener('DOMContentLoaded', () => {
  const options = { threshold: 0.2 };

  const slideInRightObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        slideInRightObserver.unobserve(entry.target);
      }
    });
  }, options);

  const heading = document.querySelector('.buzzing-heading');
  const ticketButton = document.querySelector('.highlights-button2');

  if (heading) slideInRightObserver.observe(heading);
  if (ticketButton) slideInRightObserver.observe(ticketButton);

  const cards = document.querySelectorAll('.highlight-card');

  const slideUpObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 200);
        slideUpObserver.unobserve(entry.target);
      }
    });
  }, options);

  cards.forEach((card) => slideUpObserver.observe(card));
});

document.querySelectorAll('.accordion-header').forEach((header) => {
  header.addEventListener('click', () => {
    const item = header.parentElement;

    document.querySelectorAll('.accordion-item').forEach((i) => {
      if (i !== item) i.classList.remove('active');
    });

    item.classList.toggle('active');
  });
});

(() => {
  let ticketSwiper = null;

  function initTicketsSwiper() {
    if (ticketSwiper) return;
    ticketSwiper = new Swiper('.tickets-swiper', {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      loop: false,
      slidesPerView: 'auto',
      coverflowEffect: {
        rotate: 0,
        stretch: -40,
        depth: 160,
        modifier: 1.1,
        slideShadows: false,
      },
    });
  }

  function destroyTicketsSwiper() {
    if (!ticketSwiper) return;
    ticketSwiper.destroy(true, true);
    ticketSwiper = null;
  }

  function handleResponsiveSwiper() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      initTicketsSwiper();
    } else {
      destroyTicketsSwiper();
    }
  }

  document.addEventListener('DOMContentLoaded', handleResponsiveSwiper);
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResponsiveSwiper, 150);
  });
})();
