const fetch = require('node-fetch');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;

const MOOD_MAP = { //all averate rating over 7 to ensure quality
    'Lighthearted': {'with_genres': '35,10751', 'vote_average.gte': 7}, // Comedy, Romance
    'Thought-Provoking': {'with_genres': '878,9648', 'vote_average.gte': 7}, // Sci fi, Mystery
    'Intense': {'with_genres': '28,53', 'vote_average.gte': 7}, // Action, Thriller
    'Relaxing': {'with_genres': '16,10751', 'vote_average.gte': 7}, // Animation, Family
    'Nostalgic': {'primary_release_date.lte': '2005-01-01', 'vote_average.gte': 7}, // Nostalgic
    'Emotional': {'with_genres': '18', 'vote_average.gte': 7}, // Drama
    'Funny': {'with_genres': '35', 'vote_average.gte': 7}, // Comedy
    'Scary': {'with_genres': '27', 'vote_average.gte': 7}, // Horror

};

const DURATION_MAP = {
    'Short (< 90 min)' : {'with_runtime.lte': 89 },
    'Medium (90-120 min)' : {'with_runtime.gte': 90, 'with_runtime.lte': 120 },
    'Long (> 120 min)' : { 'with_runtime.gte': 121 }
};

async function tmdbFetch(path, param = {}) {
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
    const params = { sort_by: 'popularity.desc', 'vote_count.gte': 100, include_adult: false };
    
    if (genreId) param.with_genres = genreId;

    if (mood && MOOD_MAP[mood]) {
        const moodParams = MOOD_MAP[mood];

        for(const [k, v] of Object.entries(moodParams)) {
            if (k == 'with_genres' && genreId) continue;
            params[k] = v;
        }
    }

    if (duration && DURATION_MAP[duration]) {
        Object.assign(params, DURATION_MAP[duration]);
    }

    const page = Math.floor(Math.random() * 3) +  1;
    params.page = page;

    const data = await tmdbFetch('/discover/movie', params);
    return data.results || [];
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

module.exports = {getGenres, discoverMovies, getRandomMovie, getMovieDetails, formatMovie};