/**
 * Six Demon Bag — script.js
 * Handles:
 *   1. Nav background on scroll
 *   2. Mobile hamburger menu
 *   3. Scroll-reveal animations (IntersectionObserver)
 *   4. Smooth close of mobile menu when a nav link is clicked
 */

(function () {
  'use strict';

  /* ─── 1. NAV — transparent → dark on scroll ──────────────────────────── */

  const nav = document.getElementById('nav');

  function updateNav() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav(); // run once on load in case page is already scrolled

  /* ─── 2. HAMBURGER MENU ──────────────────────────────────────────────── */

  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      // Prevent body scroll when menu is open
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close menu on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        hamburger.focus();
      }
    });

    // Close menu when clicking outside nav area
    document.addEventListener('click', function (e) {
      if (
        navLinks.classList.contains('open') &&
        !nav.contains(e.target)
      ) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ─── 3. SCROLL REVEAL (IntersectionObserver) ───────────────────────── */

  // Elements with class "reveal" or "reveal-grid" fade/slide in when visible.
  const revealTargets = document.querySelectorAll('.reveal, .reveal-grid');

  if ('IntersectionObserver' in window && revealTargets.length > 0) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // animate once only
          }
        });
      },
      {
        threshold: 0.12,   // trigger when 12 % is in view
        rootMargin: '0px 0px -40px 0px',
      }
    );

    revealTargets.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: just show everything immediately
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ─── 4. ACTIVE NAV LINK HIGHLIGHT ──────────────────────────────────── */

  // Highlights the nav link corresponding to the currently visible section.
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav__links a');

  if (sections.length > 0 && navAnchors.length > 0) {
    const sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navAnchors.forEach(function (a) {
              a.classList.toggle(
                'active',
                a.getAttribute('href') === '#' + entry.target.id
              );
            });
          }
        });
      },
      {
        rootMargin: '-50% 0px -50% 0px', // only trigger when section is centred
      }
    );

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  /* ─── 5. AUDIO PLAYER ───────────────────────────────────────────────── */

  const tracks       = window.__SDB_TRACKS__ || [];
  const audio        = new Audio();
  let   currentIndex = -1;

  const playerTitle   = document.getElementById('player-title');
  const playerStatus  = document.getElementById('player-status');
  const playBtn       = document.getElementById('play-btn');
  const playIcon      = document.getElementById('play-icon');
  const progressFill  = document.getElementById('progress-fill');
  const progressTrack = document.getElementById('progress-track');
  const playerTime    = document.getElementById('player-time');
  const trackItems    = document.querySelectorAll('.track-item');

  if (tracks.length === 0 || !playBtn) return;

  function fmt(s) {
    if (!isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  function setPlayIcon(playing) {
    if (!playIcon) return;
    playIcon.innerHTML = playing
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5,3 19,12 5,21"/>';
  }

  function loadTrack(idx) {
    if (idx < 0 || idx >= tracks.length) return;
    trackItems.forEach(function (el) { el.classList.remove('active'); });
    if (trackItems[idx]) trackItems[idx].classList.add('active');
    currentIndex = idx;
    audio.src = tracks[idx].src;
    audio.load();
    if (playerTitle)  playerTitle.textContent  = tracks[idx].name;
    if (playerStatus) playerStatus.textContent = 'Loading…';
    audio.play().then(function () {
      if (playerStatus) playerStatus.textContent = 'Now playing';
      setPlayIcon(true);
    }).catch(function () {
      if (playerStatus) playerStatus.textContent = 'Tap play to listen';
    });
  }

  playBtn.addEventListener('click', function () {
    if (currentIndex === -1) { loadTrack(0); return; }
    if (audio.paused) {
      audio.play();
      setPlayIcon(true);
      if (playerStatus) playerStatus.textContent = 'Now playing';
    } else {
      audio.pause();
      setPlayIcon(false);
      if (playerStatus) playerStatus.textContent = 'Paused';
    }
  });

  trackItems.forEach(function (item, i) {
    item.addEventListener('click', function () {
      if (currentIndex === i && !audio.paused) {
        audio.pause();
        setPlayIcon(false);
        if (playerStatus) playerStatus.textContent = 'Paused';
      } else {
        loadTrack(i);
      }
    });
  });

  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    if (playerTime)   playerTime.textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
  });

  audio.addEventListener('ended', function () {
    setPlayIcon(false);
    if (playerStatus) playerStatus.textContent = 'Ended';
    var next = currentIndex + 1;
    if (next < tracks.length) loadTrack(next);
  });

  audio.addEventListener('error', function () {
    if (playerStatus) playerStatus.textContent = 'Error — ensure Drive file is set to public';
  });

  if (progressTrack) {
    progressTrack.addEventListener('click', function (e) {
      if (!audio.duration) return;
      var rect = progressTrack.getBoundingClientRect();
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });
  }

})();
