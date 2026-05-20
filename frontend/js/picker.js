let currentMovie = null;

// =================== LOAD DROPDOWNS ===================
async function loadDropdowns() {
  try {
    // Genres from TMDB via backend
    const genres = await apiFetch('/movies/genres');
    const genreSelect = document.getElementById('genre-select');
    genres.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      genreSelect.appendChild(opt);
    });

    // Moods
    const moods = await apiFetch('/movies/moods');
    const moodSelect = document.getElementById('mood-select');
    moods.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      moodSelect.appendChild(opt);
    });

    // Durations
    const durations = await apiFetch('/movies/durations');
    const durationSelect = document.getElementById('duration-select');
    durations.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      durationSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load dropdowns:', err);
  }
}

// =================== PICK MOVIE ===================
async function pickMovie(random) {
  const loading = document.getElementById('picker-loading');
  const result = document.getElementById('picker-result');
  result.classList.remove('visible');
  loading.style.display = 'block';

  try {
    let movie;
    if (random) {
      movie = await apiFetch('/movies/surprise');
    } else {
      const genreId = document.getElementById('genre-select').value;
      const mood = document.getElementById('mood-select').value;
      const duration = document.getElementById('duration-select').value;
      const params = new URLSearchParams();
      if (genreId) params.set('genreId', genreId);
      if (mood) params.set('mood', mood);
      if (duration) params.set('duration', duration);
      movie = await apiFetch(`/movies/pick?${params.toString()}`);
    }

    currentMovie = movie;
    document.getElementById('picker-poster').src = movie.poster_path || '';
    document.getElementById('picker-poster').alt = movie.title;
    document.getElementById('picker-title').textContent = `${movie.title} (${movie.release_year || '—'})`;
    document.getElementById('picker-desc').textContent = movie.overview;

    // Check saved states if logged in
    if (auth.isLoggedIn()) {
      try {
        const favRes = await apiFetch(`/favourites/${movie.tmdb_id}`);
        document.getElementById('picker-heart').classList.toggle('active', favRes.isFavourite);
      } catch { /* ignore */ }

      try {
        const lists = await apiFetch('/lists');
        const watchlist = lists.find(l => l.is_watchlist);
        if (watchlist) {
          const inWatchlist = watchlist.movies.some(m => m.tmdb_id === movie.tmdb_id);
          document.getElementById('picker-bookmark').classList.toggle('active', inWatchlist);
        }
      } catch { /* ignore */ }
    } else {
      document.getElementById('picker-heart').classList.remove('active');
      document.getElementById('picker-bookmark').classList.remove('active');
    }

    result.classList.add('visible');
  } catch (err) {
    showToast('Could not find a movie. Try different filters!');
  } finally {
    loading.style.display = 'none';
  }
}

// =================== HEART ===================
async function toggleHeart() {
  if (!auth.isLoggedIn()) { openModal('signin'); return; }
  if (!currentMovie) return;

  const btn = document.getElementById('picker-heart');
  const isActive = btn.classList.contains('active');

  try {
    if (isActive) {
      await apiFetch(`/favourites/${currentMovie.tmdb_id}`, { method: 'DELETE' });
      btn.classList.remove('active');
      showToast('Removed from Favourites');
    } else {
      await apiFetch('/favourites', {
        method: 'POST',
        body: JSON.stringify({
          tmdb_id: currentMovie.tmdb_id,
          title: currentMovie.title,
          poster_path: currentMovie.poster_path,
          overview: currentMovie.overview,
          release_year: currentMovie.release_year,
        })
      });
      btn.classList.add('active');
      showToast('Added to Favourites!');
    }
  } catch (err) {
    showToast(err.message);
  }
}

// =================== BOOKMARK (WATCHLIST) ===================
async function toggleBookmark() {
  if (!auth.isLoggedIn()) { openModal('signin'); return; }
  if (!currentMovie) return;

  const btn = document.getElementById('picker-bookmark');
  const isActive = btn.classList.contains('active');

  try {
    const lists = await apiFetch('/lists');
    const watchlist = lists.find(l => l.is_watchlist);
    if (!watchlist) { showToast('No watchlist found'); return; }

    if (isActive) {
      await apiFetch(`/lists/${watchlist.id}/movies/${currentMovie.tmdb_id}`, { method: 'DELETE' });
      btn.classList.remove('active');
      showToast('Removed from Watchlist');
    } else {
      await apiFetch(`/lists/${watchlist.id}/movies`, {
        method: 'POST',
        body: JSON.stringify({
          tmdb_id: currentMovie.tmdb_id,
          title: currentMovie.title,
          poster_path: currentMovie.poster_path,
          overview: currentMovie.overview,
          release_year: currentMovie.release_year,
        })
      });
      btn.classList.add('active');
      showToast('Added to Watchlist!');
    }
  } catch (err) {
    showToast(err.message);
  }
}

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', loadDropdowns);
