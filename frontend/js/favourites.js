let watchlistId = null;
let undoTimers = {};

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
            card.id = `fav-card-${movie.tmdb_id}`;
            card.innerHTML = `
                <div class="fav-poster-wrap">
                    <img class="fav-poster" src="${movie.poster_path || ''}" alt="${movie.title}">
                </div>
                <div class="fav-title">${movie.title}</div>
                <div class="fav-actions">
                    <button class="fav-btn heart" data-id="${movie.tmdb_id}" onclick="removeFav(${movie.tmdb_id})" title="Remove from Favourites">
                        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                    <button class="fav-btn bookmark ${inWatchlist ? 'active' : ''}" data-id="${movie.tmdb_id}"
                        onclick="toggleWatchlistFav(${movie.tmdb_id}, '${escAttr(movie.title)}', '${escAttr(movie.poster_path||'')}', '${escAttr(movie.overview||'')}', ${movie.release_year})"
                        title="${inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = '<div class="empty-state">Failed to load favourites.</div>';
    }
}

function escAttr(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function removeFav(tmdbId) {
    const card = document.getElementById(`fav-card-${tmdbId}`);
    if (!card) return;

    // Dim card immediately
    card.style.opacity = '0.3';
    card.style.pointerEvents = 'none';

    // Clear any existing undo for this movie
    if (undoTimers[tmdbId]) {
        clearTimeout(undoTimers[tmdbId].timeout);
        clearInterval(undoTimers[tmdbId].interval);
    }

    let secondsLeft = 10;

    let toast = document.getElementById('undo-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'undo-toast';
        document.body.appendChild(toast);
    }

    const update = () => {
        toast.innerHTML = `Removed from Favourites &nbsp;<button class="undo-btn" onclick="undoRemove(${tmdbId})">Undo</button>&nbsp;<span class="undo-timer">(${secondsLeft}s)</span>`;
    };

    update();
    toast.classList.add('show');

    const interval = setInterval(() => {
        secondsLeft--;
        update();
        if (secondsLeft <= 0) clearInterval(interval);
    }, 1000);

    const timeout = setTimeout(async () => {
        clearInterval(interval);
        toast.classList.remove('show');
        try {
            await apiFetch(`/favourites/${tmdbId}`, { method: 'DELETE' });
        } catch (e) { console.error(e); }
        delete undoTimers[tmdbId];
        if (card) card.remove();
        const grid = document.getElementById('fav-grid');
        if (grid && grid.querySelectorAll('.fav-card').length === 0) {
            grid.innerHTML = '<div class="empty-state">No favourites yet. Pick a movie and save it!</div>';
        }
    }, 10000);

    undoTimers[tmdbId] = { timeout, interval, card };
}

function undoRemove(tmdbId) {
    if (!undoTimers[tmdbId]) return;
    clearTimeout(undoTimers[tmdbId].timeout);
    clearInterval(undoTimers[tmdbId].interval);
    const card = undoTimers[tmdbId].card;
    if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; }
    delete undoTimers[tmdbId];
    const toast = document.getElementById('undo-toast');
    if (toast) toast.classList.remove('show');
}

async function toggleWatchlistFav(tmdbId, title, posterPath, overview, releaseYear) {
    if (!watchlistId) return;
    const btn = document.querySelector(`.fav-btn.bookmark[data-id="${tmdbId}"]`);
    const inWatchlist = btn.classList.contains('active');
    try {
        if (inWatchlist) {
            await apiFetch(`/lists/${watchlistId}/movies/${tmdbId}`, { method: 'DELETE' });
            btn.classList.remove('active');
            btn.title = 'Add to Watchlist';
            showToast('Removed from Watchlist');
        } else {
            await apiFetch(`/lists/${watchlistId}/movies`, {
                method: 'POST',
                body: JSON.stringify({ tmdb_id: tmdbId, title, poster_path: posterPath, overview, release_year: releaseYear })
            });
            btn.classList.add('active');
            btn.title = 'Remove from Watchlist';
            showToast('Added to Watchlist!');
        }
    } catch (err) { showToast(err.message); }
}

document.addEventListener('DOMContentLoaded', loadFavourites);