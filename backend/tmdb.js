const fetch = require('node-fetch');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;

const MOOD_MAP = {
    'Lighthearted': {'with_genres': '35,10751', 'vote_average.gte': 6},
    'Thought-Provoking': {'with_genres': '878,9648', 'vote_average.gte': 6},
    'Intense': {'with_genres': '28,53', 'vote_average.gte': 6},
    'Relaxing': {'with_genres': '16,10751', 'vote_average.gte': 6},
    'Nostalgic': {'primary_release_date.lte': '2005-01-01', 'vote_average.gte': 6},
    'Emotional': {'with_genres': '18', 'vote_average.gte': 6},
    'Funny': {'with_genres': '35', 'vote_average.gte': 6},
    'Scary': {'with_genres': '27', 'vote_average.gte': 6},
};

const DURATION_MAP = {
    'Short (< 90 min)' : {'with_runtime.lte': 89 },
    'Medium (90-120 min)' : {'with_runtime.gte': 90, 'with_runtime.lte': 120 },
    'Long (> 120 min)' : { 'with_runtime.gte': 121 }
};

async function tmdbFetch(path, params = {}) {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set('api_key', TMDB_KEY);
    url.searchParams.set('language', 'en-US');
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
    return res.json();
}

async function getGenres() {
    const data = await tmdbFetch('/genre/movie/list');
    return data.genres;
}

async function discoverMovies({ genreId, mood, duration }) {
    const sortOptions = [
        'popularity.desc',
        'vote_average.desc',
        'revenue.desc',
        'primary_release_date.desc',
        'vote_count.desc',
    ];

    // pick two different sort strategies — doubles pool diversity
    const shuffledSorts = [...sortOptions].sort(() => Math.random() - 0.5);
    const [sortA, sortB] = shuffledSorts;

    // vary vote threshold so obscure films can surface too
    const voteThresholds = [50, 80, 150, 300];
    const voteMin = voteThresholds[Math.floor(Math.random() * voteThresholds.length)];

    const baseParams = {
        'vote_count.gte': voteMin,
        include_adult: false,
    };

    if (genreId) baseParams.with_genres = genreId;

    if (mood && MOOD_MAP[mood]) {
        for (const [k, v] of Object.entries(MOOD_MAP[mood])) {
            if (k === 'with_genres' && genreId) continue;
            baseParams[k] = v;
        }
    }

    if (duration && DURATION_MAP[duration]) {
        Object.assign(baseParams, DURATION_MAP[duration]);
    }

    // probe total pages with sortA
    const probe = await tmdbFetch('/discover/movie', { ...baseParams, sort_by: sortA, page: 1 });
    const totalPages = Math.min(probe.total_pages || 1, 40);

    // pick random pages spread across the result space
    const pickPages = (total, count) => {
        const pages = new Set([1]);
        while (pages.size < Math.min(count, total)) {
            pages.add(Math.floor(Math.random() * total) + 1);
        }
        return [...pages];
    };

    const pagesA = pickPages(totalPages, 3);
    const pagesB = pickPages(totalPages, 2);

    // fetch all pages in parallel
    const fetchPage = (sort, page) =>
        page === 1 && sort === sortA
            ? Promise.resolve(probe.results || [])
            : tmdbFetch('/discover/movie', { ...baseParams, sort_by: sort, page })
                .then(d => d.results || [])
                .catch(() => []);

    const allResults = await Promise.all([
        ...pagesA.map(p => fetchPage(sortA, p)),
        ...pagesB.map(p => fetchPage(sortB, p)),
    ]);

    // flatten, deduplicate by id, and fisher-yates shuffle
    const seen = new Set();
    const pool = allResults.flat().filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool;
}

async function getRandomMovie() {
    const page = Math.floor(Math.random() * 20) + 1;
    const data = await tmdbFetch('/discover/movie', { sort_by: 'popularity.desc', 'vote_count.gte': 200, include_adult: false, page});
    return data.results || [];
}

async function getMovieDetails(tmdbId) {
    return tmdbFetch(`/movie/${tmdbId}`);
}

function formatMovie(movie) {
    return {
        tmdb_id: movie.id,
        title: movie.title,
        overview: movie.overview,
        poster_path: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        release_year: movie.release_date ? parseInt(movie.release_date) : null,
        vote_average: movie.vote_average,
        genre_ids: movie.genre_ids || []
    };
}

async function discoverMoviesBatch({ genreId, mood, duration, minRating = 7, page = 1 }) {
  const params = {
    sort_by: 'vote_average.desc',
    'vote_count.gte': 150,
    'vote_average.gte': minRating,
    include_adult: false,
    page,
  };

  if (genreId) params.with_genres = genreId;

  if (mood && MOOD_MAP[mood]) {
    for (const [k, v] of Object.entries(MOOD_MAP[mood])) {
      if (k === 'with_genres' && genreId) continue;
      if (k === 'vote_average.gte') continue;
      params[k] = v;
    }
  }

  if (duration && DURATION_MAP[duration]) {
    Object.assign(params, DURATION_MAP[duration]);
  }

  const data = await tmdbFetch('/discover/movie', params);
  return {
    results: data.results || [],
    totalPages: data.total_pages || 1,
    totalResults: data.total_results || 0,
  };
}

module.exports = {getGenres, discoverMovies, discoverMoviesBatch, getRandomMovie, getMovieDetails, formatMovie};