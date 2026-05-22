let currentMovie = null;
let listPickerTimer = null;
let listPickerSeconds = 10;

// =================== LOAD GENRES FROM TMDB VIA BACKEND ===================
async function loadGenres() {
    try {
        const genres = await apiFetch('/movies/genres');
        const select = document.getElementById('genre-select');
        select.innerHTML = '<option value="">Genre</option>';
        genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            select.appendChild(opt);
        });

        const moods = await apiFetch('/movies/moods');
        const moodSelect = document.getElementById('mood-select');
        moodSelect.innerHTML = '<option value="">Mood</option>';
        moods.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            moodSelect.appendChild(opt);
        });

        const durations = await apiFetch('/movies/durations');
        const durationSelect = document.getElementById('duration-select');
        durationSelect.innerHTML = '<option value="">Duration</option>';
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
    const result  = document.getElementById('picker-result');
    result.classList.remove('visible');
    loading.style.display = 'block';
    closeListPicker();

    try {
        let movie;
        if (random) {
            movie = await apiFetch('/movies/surprise');
        } else {
            const genreId  = document.getElementById('genre-select').value;
            const mood     = document.getElementById('mood-select').value;
            const duration = document.getElementById('duration-select').value;
            const params = new URLSearchParams();
            if (genreId)  params.set('genreId',  genreId);
            if (mood)     params.set('mood',     mood);
            if (duration) params.set('duration', duration);
            movie = await apiFetch(`/movies/pick?${params.toString()}`);
        }

        currentMovie = movie;
        document.getElementById('picker-poster').src = movie.poster_path || '';
        document.getElementById('picker-poster').alt = movie.title;
        document.getElementById('picker-title').textContent = `${movie.title} (${movie.release_year || '—'})`;
        document.getElementById('picker-desc').textContent  = movie.overview;

        // Reset button states
        document.getElementById('picker-heart').classList.remove('active');
        document.getElementById('picker-bookmark').classList.remove('active');

        // Check saved states if logged in
        if (auth.isLoggedIn()) {
            apiFetch(`/favourites/${movie.tmdb_id}`)
                .then(res => {
                    if (res.isFavourite) document.getElementById('picker-heart').classList.add('active');
                }).catch(() => {});

            apiFetch('/lists')
                .then(lists => {
                    const inAnyList = lists.some(l => l.movies && l.movies.some(m => m.tmdb_id === movie.tmdb_id));
                    if (inAnyList) document.getElementById('picker-bookmark').classList.add('active');
                }).catch(() => {});
        }

        result.classList.add('visible');
        result.scrollIntoView({ behavior: 'smooth' });
    } catch {
        showToast("The stars haven't aligned for that combination. Try different filters!");
    } finally {
        loading.style.display = 'none';
    }
}

// =================== HEART (FAVOURITES) ===================
async function toggleHeart() {
    if (!auth.isLoggedIn()) { openModal('signin'); return; }
    if (!currentMovie) return;

    const btn      = document.getElementById('picker-heart');
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
                    tmdb_id:      currentMovie.tmdb_id,
                    title:        currentMovie.title,
                    poster_path:  currentMovie.poster_path,
                    overview:     currentMovie.overview,
                    release_year: currentMovie.release_year,
                })
            });
            btn.classList.add('active');
            showToast('Added to Favourites!');
        }
    } catch (err) { showToast(err.message); }
}

// =================== BOOKMARK — opens list picker popup ===================
async function toggleBookmark() {
    if (!auth.isLoggedIn()) { openModal('signin'); return; }
    if (!currentMovie) return;

    // If already open, close it
    const existing = document.getElementById('list-picker-popup');
    if (existing) { closeListPicker(); return; }

    try {
        const lists = await apiFetch('/lists');
        showListPicker(lists);
    } catch (err) { showToast(err.message); }
}

// =================== LIST PICKER POPUP ===================
function showListPicker(lists) {
    closeListPicker(); // clear any existing

    const popup = document.createElement('div');
    popup.id = 'list-picker-popup';
    popup.className = 'list-picker-popup';

    listPickerSeconds = 10;

    popup.innerHTML = `
        <div class="list-picker-header">
            <span>Save to list</span>
            <span class="list-picker-timer" id="list-picker-timer">${listPickerSeconds}s</span>
            <button class="list-picker-close" onclick="closeListPicker()">✕</button>
        </div>
        <div class="list-picker-items" id="list-picker-items"></div>
    `;

    const items = popup.querySelector('#list-picker-items');

    lists.forEach(list => {
        const alreadySaved = list.movies && list.movies.some(m => m.tmdb_id === currentMovie.tmdb_id);
        const item = document.createElement('button');
        item.className = `list-picker-item ${alreadySaved ? 'saved' : ''}`;
        item.innerHTML = `
            <span class="list-picker-name">${list.name}</span>
            <span class="list-picker-count">${list.movies ? list.movies.length : 0} movies</span>
            ${alreadySaved ? '<span class="list-picker-check">✓</span>' : ''}
        `;
        item.onclick = () => saveToList(list, item, alreadySaved);
        items.appendChild(item);
    });

    // Anchor popup near the bookmark button
    const btn = document.getElementById('picker-bookmark');
    const rect = btn.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = (rect.bottom + 10) + 'px';
    popup.style.left = rect.left + 'px';

    document.body.appendChild(popup);

    // 10-second countdown
    listPickerTimer = setInterval(() => {
        listPickerSeconds--;
        const timerEl = document.getElementById('list-picker-timer');
        if (timerEl) timerEl.textContent = listPickerSeconds + 's';
        if (listPickerSeconds <= 0) closeListPicker();
    }, 1000);

    // Close if clicking outside
    setTimeout(() => {
        document.addEventListener('click', outsideListPickerClick);
    }, 50);
}

function outsideListPickerClick(e) {
    const popup = document.getElementById('list-picker-popup');
    const btn   = document.getElementById('picker-bookmark');
    if (popup && !popup.contains(e.target) && e.target !== btn) {
        closeListPicker();
    }
}

function closeListPicker() {
    if (listPickerTimer) { clearInterval(listPickerTimer); listPickerTimer = null; }
    const popup = document.getElementById('list-picker-popup');
    if (popup) popup.remove();
    document.removeEventListener('click', outsideListPickerClick);
}

async function saveToList(list, itemEl, alreadySaved) {
    try {
        if (alreadySaved) {
            await apiFetch(`/lists/${list.id}/movies/${currentMovie.tmdb_id}`, { method: 'DELETE' });
            itemEl.classList.remove('saved');
            itemEl.querySelector('.list-picker-check')?.remove();
            showToast(`Removed from ${list.name}`);
        } else {
            await apiFetch(`/lists/${list.id}/movies`, {
                method: 'POST',
                body: JSON.stringify({
                    tmdb_id:      currentMovie.tmdb_id,
                    title:        currentMovie.title,
                    poster_path:  currentMovie.poster_path,
                    overview:     currentMovie.overview,
                    release_year: currentMovie.release_year,
                })
            });
            itemEl.classList.add('saved');
            if (!itemEl.querySelector('.list-picker-check')) {
                const check = document.createElement('span');
                check.className = 'list-picker-check';
                check.textContent = '✓';
                itemEl.appendChild(check);
            }
            showToast(`Added to ${list.name}!`);
        }

        // Update bookmark button state — active if saved in any list
        try {
            const allLists = await apiFetch('/lists');
            const inAnyList = allLists.some(l => l.movies && l.movies.some(m => m.tmdb_id === currentMovie.tmdb_id));
            document.getElementById('picker-bookmark').classList.toggle('active', inAnyList);
        } catch {}

    } catch (err) { showToast(err.message); }
}

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', loadGenres);