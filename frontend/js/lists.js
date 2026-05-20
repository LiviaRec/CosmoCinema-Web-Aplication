async function loadLists() {
  const container = document.getElementById('lists-container');

  if (!auth.isLoggedIn()) {
    container.innerHTML = '<div class="empty-state" style="position:relative;z-index:1">Sign in to see your lists.</div>';
    return;
  }

  try {
    const lists = await apiFetch('/lists');
    container.innerHTML = '';

    lists.forEach(list => {
      const row = document.createElement('div');
      row.className = 'list-row';

      const info = document.createElement('div');
      info.className = 'list-info';
      info.innerHTML = `
        <div class="list-title">${list.name}</div>
        <div class="list-desc">${list.description || ''}</div>
      `;

      const posters = document.createElement('div');
      posters.className = 'list-posters';

      if (!list.movies || list.movies.length === 0) {
        posters.innerHTML = '<span class="list-empty">No movies saved yet.</span>';
      } else {
        list.movies.forEach(movie => {
          const img = document.createElement('img');
          img.className = 'list-poster';
          img.src = movie.poster_path || '';
          img.alt = movie.title;
          img.title = movie.title;
          posters.appendChild(img);
        });
      }

      row.appendChild(info);
      row.appendChild(posters);
      container.appendChild(row);
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state" style="position:relative;z-index:1">Failed to load lists.</div>';
  }
}

document.addEventListener('DOMContentLoaded', loadLists);
