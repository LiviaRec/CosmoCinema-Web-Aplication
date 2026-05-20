require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { register, login, requireAuth } = require('./auth');
const { favouriteQueries, listQueries, listMovieQueries } = require('./database');
const { getGenres, discoverMovies, getRandomMovie, formatMovie } = require('./tmdb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username });
});

//movie routes

//genres dropdown
app.get('/api/movies/genres', async (req, res) => {
    try {
        const genres = await getGenres();
        res.json(genres);
    } 
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

//mood dropdown
app.get('/api/movies/moods', (req, res) => {
    res.json([ 'Lighthearted', 'Though-Provoking', 'Intense', 'Relaxing', 'Nostalgic', 'Emotional', 'Funny', 'Scary']);
});

//duration dropdown
app.get('/api/movies/durations', (req, res) => {
    res.json(['Short (< 90 min)', 'Medium (90-120 min)', 'Long (> 120 min)']);
});

//discover movies based on filters
app.get('/api/movies/pick', async (req, res) => {
    try {
        const { genreId, mood, duration } = req.query;
        const movies = await discoverMovies({ genreId, mood, duration });
        if (!movies.length) return res.status(404).json({ error: 'No movies found for those filters' });
        const picked = movies[Math.floor(Math.random() * movies.length)];
        res.json(formatMovie(picked));
    } 
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to pick a movie' });
    }
});

//surprise random movie
app.get('/api/movies/surprise', async (req, res) => {
    try {
        const movies = await getRandomMovie();
        if (!movies.length) return res.status(404).json({ error: 'No movies found' });
        const picked = movies[Math.floor(Math.random() * movies.length)];
        res.json(formatMovie(picked));
    } 
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get random movie' });
    }
});

//favourites routes
