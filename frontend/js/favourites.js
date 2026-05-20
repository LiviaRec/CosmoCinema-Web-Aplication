let watchlistId = null;

async function loadFavourites() {
  const grid = document.getElementById('fav-grid');

  if (!auth.isLoggedIn()) {
    grid.innerHTML = '<div class="empty-state">Sign in to see your favourites.</div>';
    return;
  }

  try {
    const [favs, lists] = await Promise.all([
      apiFetch('/favourites'),
      apiFetch('/lists'),
    ]);

    const watchlist = lists.find(l => l.is_watchlist);
    if (watchlist) watchlistId = watchlist.id;
    const watchlistMovieIds = new Set((watchlist?.movies || []).map(m => m.tmdb_id));

    grid.innerHTML = '';

    if (favs.length === 0) {
      grid.innerHTML = '<div class="empty-state">No favourites yet. Pick a movie and save it!</div>';
      return;
    }

    favs.forEach(movie => {
      const inWatchlist = watchlistMovieIds.has(movie.tmdb_id);
      const card = document.createElement('div');
      card.className = 'fav-card';
      card.innerHTML = `
        <img class="fav-poster" src="${movie.poster_path || ''}" alt="${movie.title}">
        <div class="fav-actions">
          <button class="fav-icon-btn heart" data-id="${movie.tmdb_id}" onclick="removeFav(${movie.tmdb_id})" title="Remove from Favourites">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="fav-icon-btn bookmark ${inWatchlist ? 'active' : ''}" data-id="${movie.tmdb_id}" onclick="toggleWatchlist(${movie.tmdb_id}, '${movie.title}', '${movie.poster_path}', '${(movie.overview||'').replace(/'/g,"\\'")}', ${movie.release_year})" title="Toggle Watchlist">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Failed to load favourites.</div>`;
  }
}

async function removeFav(tmdbId) {
  try {
    await apiFetch(`/favourites/${tmdbId}`, { method: 'DELETE' });
    showToast('Removed from Favourites');
    loadFavourites();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleWatchlist(tmdbId, title, posterPath, overview, releaseYear) {
  if (!watchlistId) return;
  const btn = document.querySelector(`.fav-icon-btn.bookmark[data-id="${tmdbId}"]`);
  const inWatchlist = btn.classList.contains('active');

  try {
    if (inWatchlist) {
      await apiFetch(`/lists/${watchlistId}/movies/${tmdbId}`, { method: 'DELETE' });
      btn.classList.remove('active');
      showToast('Removed from Watchlist');
    } else {
      await apiFetch(`/lists/${watchlistId}/movies`, {
        method: 'POST',
        body: JSON.stringify({ tmdb_id: tmdbId, title, poster_path: posterPath, overview, release_year: releaseYear })
      });
      btn.classList.add('active');
      showToast('Added to Watchlist!');
    }
  } catch (err) {
    showToast(err.message);
  }
}

document.addEventListener('DOMContentLoaded', loadFavourites);
