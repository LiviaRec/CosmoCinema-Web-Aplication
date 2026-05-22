let listUndoTimers = {};

let favouriteIds = new Set();

async function loadLists() {
    const container = document.getElementById('lists-container');

    if (!auth.isLoggedIn()) {
        container.innerHTML = '<div class="empty-state">Sign in to see your lists.</div>';
        return;
    }

    try {
        const [lists, favs] = await Promise.all([
            apiFetch('/lists'),
            apiFetch('/favourites'),
        ]);

        favouriteIds = new Set(favs.map(f => f.tmdb_id));

        container.innerHTML = '';
        lists.forEach(list => renderListRow(list, container));
    } catch (err) {
        container.innerHTML = '<div class="empty-state">Failed to load lists.</div>';
    }
}

function renderListRow(list, container) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.id = `list-row-${list.id}`;

    const info = document.createElement('div');
    info.className = 'list-info';
    info.innerHTML = `
        <div class="list-title">${list.name}</div>
        <div class="list-desc">${list.description || ''}</div>
        ${!list.is_watchlist ? `<button class="list-delete-btn" onclick="deleteList(${list.id})">Delete list</button>` : ''}
    `;

    const posters = document.createElement('div');
    posters.className = 'list-posters';
    posters.id = `list-posters-${list.id}`;

    if (!list.movies || list.movies.length === 0) {
        posters.innerHTML = '<span class="list-empty">No movies saved yet.</span>';
    } else {
        list.movies.forEach(movie => posters.appendChild(createMovieTile(movie, list.id)));
    }

    row.appendChild(info);
    row.appendChild(posters);
    container.appendChild(row);
}

function createMovieTile(movie, listId) {
    const tile = document.createElement('div');
    tile.className = 'list-movie-tile';
    tile.id = `tile-${listId}-${movie.tmdb_id}`;
    const isFav = favouriteIds.has(movie.tmdb_id);
    tile.innerHTML = `
        <img class="list-poster" src="${movie.poster_path || ''}" alt="${movie.title}" title="${movie.title}">
        <div class="list-movie-actions">
            <button class="list-movie-btn heart ${isFav ? 'active' : ''}"
                data-id="${movie.tmdb_id}"
                onclick="addToFavFromList(${movie.tmdb_id}, '${escAttr(movie.title)}', '${escAttr(movie.poster_path||'')}', '${escAttr(movie.overview||'')}', ${movie.release_year})"
                title="${isFav ? 'Already in Favourites' : 'Add to Favourites'}">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button class="list-movie-btn remove" onclick="removeFromList(${listId}, ${movie.tmdb_id})" title="Remove from list">
                <svg viewBox="0 0 24 24" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    `;
    return tile;
}

function escAttr(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function removeFromList(listId, tmdbId) {
    const tile = document.getElementById(`tile-${listId}-${tmdbId}`);
    if (!tile) return;

    // Dim immediately
    tile.style.opacity = '0.3';
    tile.style.pointerEvents = 'none';

    const key = `${listId}-${tmdbId}`;

    if (listUndoTimers[key]) {
        clearTimeout(listUndoTimers[key].timeout);
        clearInterval(listUndoTimers[key].interval);
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
        toast.innerHTML = `Removed from list &nbsp;<button class="undo-btn" onclick="undoListRemove('${key}')">Undo</button>&nbsp;<span class="undo-timer">(${secondsLeft}s)</span>`;
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
            await apiFetch(`/lists/${listId}/movies/${tmdbId}`, { method: 'DELETE' });
        } catch (e) { console.error(e); }
        delete listUndoTimers[key];
        tile.remove();
        const posters = document.getElementById(`list-posters-${listId}`);
        if (posters && posters.querySelectorAll('.list-movie-tile').length === 0) {
            posters.innerHTML = '<span class="list-empty">No movies saved yet.</span>';
        }
    }, 10000);

    listUndoTimers[key] = { timeout, interval, tile };
}

function undoListRemove(key) {
    if (!listUndoTimers[key]) return;
    clearTimeout(listUndoTimers[key].timeout);
    clearInterval(listUndoTimers[key].interval);
    const tile = listUndoTimers[key].tile;
    if (tile) { tile.style.opacity = '1'; tile.style.pointerEvents = 'auto'; }
    delete listUndoTimers[key];
    const toast = document.getElementById('undo-toast');
    if (toast) toast.classList.remove('show');
}

async function addToFavFromList(tmdbId, title, posterPath, overview, releaseYear) {
    const btn = document.querySelector(`.list-movie-btn.heart[data-id="${tmdbId}"]`);
    const isFav = favouriteIds.has(tmdbId);
    try {
        if (isFav) {
            await apiFetch(`/favourites/${tmdbId}`, { method: 'DELETE' });
            favouriteIds.delete(tmdbId);
            document.querySelectorAll(`.list-movie-btn.heart[data-id="${tmdbId}"]`).forEach(b => {
                b.classList.remove('active');
                b.title = 'Add to Favourites';
            });
            showToast('Removed from Favourites');
        } else {
            await apiFetch('/favourites', {
                method: 'POST',
                body: JSON.stringify({ tmdb_id: tmdbId, title, poster_path: posterPath, overview, release_year: releaseYear })
            });
            favouriteIds.add(tmdbId);
            document.querySelectorAll(`.list-movie-btn.heart[data-id="${tmdbId}"]`).forEach(b => {
                b.classList.add('active');
                b.title = 'Already in Favourites';
            });
            showToast('Added to Favourites!');
        }
    } catch (err) { showToast(err.message); }
}

async function deleteList(listId) {
    if (!confirm('Delete this list?')) return;
    try {
        await apiFetch(`/lists/${listId}`, { method: 'DELETE' });
        const row = document.getElementById(`list-row-${listId}`);
        if (row) row.remove();
        showToast('List deleted');
    } catch (err) { showToast(err.message); }
}

function openCreateList() {
    document.getElementById('create-list-modal').classList.add('visible');
}

function closeCreateList() {
    document.getElementById('create-list-modal').classList.remove('visible');
    document.getElementById('new-list-name').value = '';
    document.getElementById('new-list-desc').value = '';
}

async function submitCreateList() {
    const name = document.getElementById('new-list-name').value.trim();
    const desc = document.getElementById('new-list-desc').value.trim();
    if (!name) { showToast('Please enter a list name'); return; }
    try {
        await apiFetch('/lists', {
            method: 'POST',
            body: JSON.stringify({ name, description: desc })
        });
        closeCreateList();
        showToast(`"${name}" created!`);
        loadLists();
    } catch (err) { showToast(err.message); }
}

document.addEventListener('DOMContentLoaded', loadLists);