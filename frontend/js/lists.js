async function loadLists() {
    const container = document.getElementById('lists-container');

    if (!auth.isLoggedIn()) {
        container.innerHTML = '<div class="empty-state">Sign in to see your lists.</div>';
        return;
    }

    try {
        const lists = await apiFetch('/lists');
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
    tile.innerHTML = `
        <img class="list-poster" src="${movie.poster_path || ''}" alt="${movie.title}" title="${movie.title}">
        <div class="list-movie-actions">
            <button class="list-movie-btn heart"
                onclick="addToFavFromList(${movie.tmdb_id}, '${escAttr(movie.title)}', '${escAttr(movie.poster_path||'')}', '${escAttr(movie.overview||'')}', ${movie.release_year})"
                title="Add to Favourites">
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

async function removeFromList(listId, tmdbId) {
    try {
        await apiFetch(`/lists/${listId}/movies/${tmdbId}`, { method: 'DELETE' });
        const tile = document.getElementById(`tile-${listId}-${tmdbId}`);
        if (tile) tile.remove();
        const posters = document.getElementById(`list-posters-${listId}`);
        if (posters && posters.querySelectorAll('.list-movie-tile').length === 0) {
            posters.innerHTML = '<span class="list-empty">No movies saved yet.</span>';
        }
        showToast('Removed from list');
    } catch (err) { showToast(err.message); }
}

async function addToFavFromList(tmdbId, title, posterPath, overview, releaseYear) {
    try {
        await apiFetch('/favourites', {
            method: 'POST',
            body: JSON.stringify({ tmdb_id: tmdbId, title, poster_path: posterPath, overview, release_year: releaseYear })
        });
        showToast('Added to Favourites!');
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