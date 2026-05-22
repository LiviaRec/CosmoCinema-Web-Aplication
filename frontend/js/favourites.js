let allFavLists = [];
let undoTimers = {};
let favListPickerTimer = null;
let favListPickerSeconds = 10;

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

        allFavLists = lists;

        grid.innerHTML = '';

        if (favs.length === 0) {
            grid.innerHTML = '<div class="empty-state">No favourites yet. Pick a movie and save it!</div>';
            return;
        }

        favs.forEach(movie => {
            const inAnyList = lists.some(l => l.movies && l.movies.some(m => m.tmdb_id === movie.tmdb_id));
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
                    <button class="fav-btn bookmark ${inAnyList ? 'active' : ''}" data-id="${movie.tmdb_id}"
                        onclick="openFavListPicker(event, ${movie.tmdb_id}, '${escAttr(movie.title)}', '${escAttr(movie.poster_path||'')}', '${escAttr(movie.overview||'')}', ${movie.release_year})"
                        title="Save to list">
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

    card.style.opacity = '0.3';
    card.style.pointerEvents = 'none';

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
        try { await apiFetch(`/favourites/${tmdbId}`, { method: 'DELETE' }); } catch (e) { console.error(e); }
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

let currentFavMovie = null;

function openFavListPicker(event, tmdbId, title, posterPath, overview, releaseYear) {
    currentFavMovie = { tmdb_id: tmdbId, title, poster_path: posterPath, overview, release_year: releaseYear };

    const existing = document.getElementById(`fav-list-picker-${tmdbId}`);
    if (existing) { closeFavListPicker(tmdbId); return; }

    document.querySelectorAll('[id^="fav-list-picker-"]').forEach(el => el.remove());
    if (favListPickerTimer) { clearInterval(favListPickerTimer); favListPickerTimer = null; }

    showFavListPicker(allFavLists, tmdbId, event.currentTarget);
}

function showFavListPicker(lists, tmdbId, btn) {
    favListPickerSeconds = 10;

    const container = document.createElement('div');
    container.id = `fav-list-picker-${tmdbId}`;
    container.className = 'list-picker-inline';

    container.innerHTML = `
        <div class="list-picker-inline-header">
            <span>Save to list</span>
            <span class="list-picker-inline-timer" id="fav-list-picker-timer-${tmdbId}">${favListPickerSeconds}s</span>
            <button class="list-picker-inline-close" onclick="closeFavListPicker(${tmdbId})">✕</button>
        </div>
    `;

    lists.forEach(list => {
        const alreadySaved = list.movies && list.movies.some(m => m.tmdb_id === tmdbId);
        const item = document.createElement('button');
        item.className = `list-picker-inline-item ${alreadySaved ? 'saved' : ''}`;
        item.innerHTML = `
            <span>${list.name}</span>
            <span class="list-picker-inline-count">${list.movies ? list.movies.length : 0}</span>
            ${alreadySaved ? '<span class="list-picker-inline-check">✓</span>' : ''}
        `;
        item.onclick = () => favSaveToList(list, item, alreadySaved, tmdbId);
        container.appendChild(item);
    });

    const card = document.getElementById(`fav-card-${tmdbId}`);
    card.appendChild(container);
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    favListPickerTimer = setInterval(() => {
        favListPickerSeconds--;
        const timerEl = document.getElementById(`fav-list-picker-timer-${tmdbId}`);
        if (timerEl) timerEl.textContent = favListPickerSeconds + 's';
        if (favListPickerSeconds <= 0) closeFavListPicker(tmdbId);
    }, 1000);
}

function closeFavListPicker(tmdbId) {
    if (favListPickerTimer) { clearInterval(favListPickerTimer); favListPickerTimer = null; }
    const el = document.getElementById(`fav-list-picker-${tmdbId}`);
    if (el) el.remove();
}

async function favSaveToList(list, itemEl, alreadySaved, tmdbId) {
    try {
        if (alreadySaved) {
            await apiFetch(`/lists/${list.id}/movies/${tmdbId}`, { method: 'DELETE' });
            itemEl.classList.remove('saved');
            itemEl.querySelector('.list-picker-inline-check')?.remove();
            showToast(`Removed from ${list.name}`);
        } else {
            await apiFetch(`/lists/${list.id}/movies`, {
                method: 'POST',
                body: JSON.stringify({
                    tmdb_id:      currentFavMovie.tmdb_id,
                    title:        currentFavMovie.title,
                    poster_path:  currentFavMovie.poster_path,
                    overview:     currentFavMovie.overview,
                    release_year: currentFavMovie.release_year,
                })
            });
            itemEl.classList.add('saved');
            if (!itemEl.querySelector('.list-picker-inline-check')) {
                const check = document.createElement('span');
                check.className = 'list-picker-inline-check';
                check.textContent = '✓';
                itemEl.appendChild(check);
            }
            showToast(`Added to ${list.name}!`);
        }

        try {
            const updatedLists = await apiFetch('/lists');
            allFavLists = updatedLists;
            const inAnyList = updatedLists.some(l => l.movies && l.movies.some(m => m.tmdb_id === tmdbId));
            const bookmarkBtn = document.querySelector(`.fav-btn.bookmark[data-id="${tmdbId}"]`);
            if (bookmarkBtn) bookmarkBtn.classList.toggle('active', inAnyList);
        } catch {}

    } catch (err) { showToast(err.message); }
}

document.addEventListener('DOMContentLoaded', loadFavourites);