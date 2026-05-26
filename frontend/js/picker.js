let currentMovie      = null;
let listPickerTimer   = null;
let listPickerSeconds = 10;

const browse = {
    active:     false,
    batch:      [],
    index:      0,
    page:       1,
    minRating:  7,
    totalPages: 1,
    exhausted:  false,
    filters:    {},

    reset() {
        this.active     = false;
        this.batch      = [];
        this.index      = 0;
        this.page       = 1;
        this.minRating  = 7;
        this.totalPages = 1;
        this.exhausted  = false;
        this.filters    = {};
    }
};

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

async function pickMovie(random) {
    const loading = document.getElementById('picker-loading');
    const result  = document.getElementById('picker-result');
    result.classList.remove('visible');
    loading.style.display = 'block';
    closeListPicker();
    browse.reset();

    try {
        if (random) {
            const movie = await apiFetch('/movies/surprise');
            displayMovie(movie);
            hideBrowseNav();
        } else {
            browse.filters = {
                genreId:  document.getElementById('genre-select').value,
                mood:     document.getElementById('mood-select').value,
                duration: document.getElementById('duration-select').value,
            };
            browse.active = true;
            await loadBrowseBatch();
        }
    } catch {
        showToast("Couldn't reach the stars right now. Try again!");
        loading.style.display = 'none';
    }
}

async function loadBrowseBatch() {
    document.getElementById('picker-loading').style.display = 'block';

    // disable nav buttons while loading
    const prevBtn = document.getElementById('browse-prev');
    const nextBtn = document.getElementById('browse-next');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const { genreId, mood, duration } = browse.filters;
    const params = new URLSearchParams();

    if (genreId)  params.set('genreId',  genreId);
    if (mood)     params.set('mood',     mood);
    if (duration) params.set('duration', duration);
    params.set('minRating', browse.minRating);
    params.set('page',      browse.page);

    try {
        const data = await apiFetch(`/movies/browse?${params.toString()}`);
        browse.batch      = data.movies || [];
        browse.totalPages = data.totalPages || 1;
        document.getElementById('picker-loading').style.display = 'none';

        if (!browse.batch.length) {
            await tryLowerRating();
            return;
        }

        displayMovie(browse.batch[browse.index]);
        updateBrowseNav();
    } catch {
        document.getElementById('picker-loading').style.display = 'none';
        await tryLowerRating();
    }
}

async function tryLowerRating() {
    if (browse.page < browse.totalPages) {
        browse.page++;
        browse.index = 0;
        await loadBrowseBatch();
        return;
    }

    const newRating = browse.minRating - 1;

    if (newRating < 5) {
        browse.exhausted = true;
        showToast('No more movies found for these filters.');
        updateBrowseNav();
        return;
    }

    browse.minRating = newRating;
    browse.page      = 1;
    browse.index     = 0;
    browse.batch     = [];
    showToast(`Expanding search — showing movies rated ${browse.minRating}+`);
    await loadBrowseBatch();
}

function browseNext() {
    if (!browse.active || browse.exhausted) return;
    closeListPicker();

    if (browse.index < browse.batch.length - 1) {
        browse.index++;
        displayMovie(browse.batch[browse.index]);
        updateBrowseNav();
    } else {
        browse.index = 0;
        browse.batch = [];
        if (browse.page < browse.totalPages) browse.page++;
        loadBrowseBatch();
    }
}

function browsePrev() {
    if (!browse.active || browse.index === 0) return;
    closeListPicker();
    browse.index--;
    displayMovie(browse.batch[browse.index]);
    updateBrowseNav();
}

function updateBrowseNav() {
    const nav = document.getElementById('browse-nav');
    if (!nav) return;
    if (!browse.active) { nav.style.display = 'none'; return; }

    nav.style.display = 'flex';

    document.getElementById('browse-prev').disabled = browse.index === 0;
    document.getElementById('browse-next').disabled = browse.exhausted;

    const total = browse.batch.length;
    document.getElementById('browse-counter').textContent = total ? `${browse.index + 1} / ${total}` : '';

    const ratingEl = document.getElementById('browse-rating');
    if (browse.minRating < 7) {
        ratingEl.textContent = `Rating ≥ ${browse.minRating}`;
        ratingEl.style.color = browse.minRating < 6 ? '#ff6b35' : '#f6c90e';
    } else {
        ratingEl.textContent = 'Top rated';
        ratingEl.style.color = 'var(--lime)';
    }
}

function hideBrowseNav() {
    const nav = document.getElementById('browse-nav');
    if (nav) nav.style.display = 'none';
}

function displayMovie(movie) {
    currentMovie = movie;

    const poster = document.getElementById('picker-poster');

    // fade out, swap src, fade in once loaded
    poster.style.transition = 'opacity 0.2s';
    poster.style.opacity = '0';

    const newImg = new Image();
    newImg.src = movie.poster_path || '';
    newImg.onload = () => {
        poster.src = newImg.src;
        poster.style.opacity = '1';
    };
    newImg.onerror = () => {
        poster.src = '';
        poster.style.opacity = '1';
    };
    // if no poster_path at all, show immediately
    if (!movie.poster_path) {
        poster.src = '';
        poster.style.opacity = '1';
    }

    poster.alt = movie.title;
    document.getElementById('picker-title').textContent = `${movie.title} (${movie.release_year || '—'})`;
    document.getElementById('picker-desc').textContent  = movie.overview;
    document.getElementById('picker-heart').classList.remove('active');
    document.getElementById('picker-bookmark').classList.remove('active');

    if (auth.isLoggedIn()) {
        apiFetch(`/favourites/${movie.tmdb_id}`)
            .then(res => { if (res.isFavourite) document.getElementById('picker-heart').classList.add('active'); })
            .catch(() => {});
        apiFetch('/lists')
            .then(lists => {
                const inAnyList = lists.some(l => l.movies && l.movies.some(m => m.tmdb_id === movie.tmdb_id));
                if (inAnyList) document.getElementById('picker-bookmark').classList.add('active');
            }).catch(() => {});
    }

    document.getElementById('picker-result').classList.add('visible');
    document.getElementById('picker-result').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('picker-loading').style.display = 'none';
}

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
                    tmdb_id: currentMovie.tmdb_id, title: currentMovie.title,
                    poster_path: currentMovie.poster_path, overview: currentMovie.overview,
                    release_year: currentMovie.release_year,
                })
            });
            btn.classList.add('active');
            showToast('Added to Favourites!');
        }
    } catch (err) { showToast(err.message); }
}

async function toggleBookmark() {
    if (!auth.isLoggedIn()) { openModal('signin'); return; }
    if (!currentMovie) return;
    if (document.getElementById('list-picker-inline')) { closeListPicker(); return; }
    try {
        const lists = await apiFetch('/lists');
        showListPicker(lists);
    } catch (err) { showToast(err.message); }
}

function showListPicker(lists) {
    closeListPicker();
    listPickerSeconds = 10;

    const container = document.createElement('div');
    container.id = 'list-picker-inline';
    container.className = 'list-picker-inline';
    container.innerHTML = `
        <div class="list-picker-inline-header">
            <span>Save to list</span>
            <span class="list-picker-inline-timer" id="list-picker-timer">${listPickerSeconds}s</span>
            <button class="list-picker-inline-close" onclick="closeListPicker()">✕</button>
        </div>
    `;

    lists.forEach(list => {
        const alreadySaved = list.movies && list.movies.some(m => m.tmdb_id === currentMovie.tmdb_id);
        const item = document.createElement('button');
        item.className = `list-picker-inline-item ${alreadySaved ? 'saved' : ''}`;
        item.innerHTML = `
            <span>${list.name}</span>
            <span class="list-picker-inline-count">${list.movies ? list.movies.length : 0}</span>
            ${alreadySaved ? '<span class="list-picker-inline-check">✓</span>' : ''}
        `;
        item.onclick = () => saveToList(list, item, alreadySaved);
        container.appendChild(item);
    });

    const actions = document.querySelector('.picker-actions');
    actions.parentNode.insertBefore(container, actions.nextSibling);
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    listPickerTimer = setInterval(() => {
        listPickerSeconds--;
        const timerEl = document.getElementById('list-picker-timer');
        if (timerEl) timerEl.textContent = listPickerSeconds + 's';
        if (listPickerSeconds <= 0) closeListPicker();
    }, 1000);
}

function closeListPicker() {
    if (listPickerTimer) { clearInterval(listPickerTimer); listPickerTimer = null; }
    const el = document.getElementById('list-picker-inline');
    if (el) el.remove();
}

async function saveToList(list, itemEl, alreadySaved) {
    try {
        if (alreadySaved) {
            await apiFetch(`/lists/${list.id}/movies/${currentMovie.tmdb_id}`, { method: 'DELETE' });
            itemEl.classList.remove('saved');
            itemEl.querySelector('.list-picker-inline-check')?.remove();
            showToast(`Removed from ${list.name}`);
        } else {
            await apiFetch(`/lists/${list.id}/movies`, {
                method: 'POST',
                body: JSON.stringify({
                    tmdb_id: currentMovie.tmdb_id, title: currentMovie.title,
                    poster_path: currentMovie.poster_path, overview: currentMovie.overview,
                    release_year: currentMovie.release_year,
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
            const allLists = await apiFetch('/lists');
            const inAnyList = allLists.some(l => l.movies && l.movies.some(m => m.tmdb_id === currentMovie.tmdb_id));
            document.getElementById('picker-bookmark').classList.toggle('active', inAnyList);
        } catch {}
    } catch (err) { showToast(err.message); }
}

document.addEventListener('DOMContentLoaded', loadGenres);