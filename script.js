// Nav transparency on scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// Audio player
const audio = new Audio();
let currentTrackIndex = -1;

const tracks = window.__SDB_TRACKS__ || [];

function formatTime(s) {
  if (!isFinite(s)) return '--:--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const playerTitle    = document.getElementById('player-title');
const playerStatus   = document.getElementById('player-status');
const playBtn        = document.getElementById('play-btn');
const playIcon       = document.getElementById('play-icon');
const progressFill   = document.getElementById('progress-fill');
const progressTrack  = document.getElementById('progress-track');
const playerTime     = document.getElementById('player-time');
const trackItems     = document.querySelectorAll('.track-item');

function loadTrack(index) {
  if (index < 0 || index >= tracks.length) return;

  trackItems.forEach(el => el.classList.remove('active'));
  if (trackItems[index]) trackItems[index].classList.add('active');

  currentTrackIndex = index;
  audio.src = tracks[index].src;
  audio.load();

  if (playerTitle) playerTitle.textContent = tracks[index].name;
  if (playerStatus) playerStatus.textContent = 'Loading…';

  audio.play().then(() => {
    if (playerStatus) playerStatus.textContent = 'Now playing';
    updatePlayIcon(true);
  }).catch(() => {
    if (playerStatus) playerStatus.textContent = 'Tap play to listen';
  });
}

function updatePlayIcon(playing) {
  if (!playIcon) return;
  playIcon.innerHTML = playing
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<polygon points="5,3 19,12 5,21"/>';
}

if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (currentTrackIndex === -1 && tracks.length > 0) {
      loadTrack(0);
      return;
    }
    if (audio.paused) {
      audio.play();
      updatePlayIcon(true);
      if (playerStatus) playerStatus.textContent = 'Now playing';
    } else {
      audio.pause();
      updatePlayIcon(false);
      if (playerStatus) playerStatus.textContent = 'Paused';
    }
  });
}

trackItems.forEach((item, i) => {
  item.addEventListener('click', () => {
    if (currentTrackIndex === i && !audio.paused) {
      audio.pause();
      updatePlayIcon(false);
      if (playerStatus) playerStatus.textContent = 'Paused';
    } else {
      loadTrack(i);
    }
  });
});

audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  if (progressFill) progressFill.style.width = pct + '%';
  if (playerTime) {
    playerTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  }
});

audio.addEventListener('ended', () => {
  updatePlayIcon(false);
  if (playerStatus) playerStatus.textContent = 'Ended';
  const next = currentTrackIndex + 1;
  if (next < tracks.length) loadTrack(next);
});

audio.addEventListener('error', () => {
  if (playerStatus) playerStatus.textContent = 'Error loading track — ensure Drive file is set to public';
});

if (progressTrack) {
  progressTrack.addEventListener('click', e => {
    if (!audio.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });
}
