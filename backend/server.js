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

//get all favourites for user
app.get('/api/favourites', requireAuth, (req, res) => {
    const favs = favouriteQueries.getAll.all(req.user.id);
    res.json(favs);
});

//add to favourites
app.post('/api/favourites', requireAuth, (req, res) => {
    const { tmdb_id, title, poster_path, overview, release_year } = req.body;
    if (!tmdb_id || !title) return res.status(400).json({ error: 'tmdb_id and title are required' });
    favouriteQueries.add.run(req.user.id, tmdb_id, title, poster_path, overview, release_year);
    res.status(201).json({ message: 'Added to favourites' });
});

//remove from favourites
app.delete('/api/favourites/:tmdbId', requireAuth, (req, res) => {
    favouriteQueries.remove.run(req.user.id, parseInt(req.params.tmdbId));
    res.json({ message: 'Removed from favourites' });
});

//check if movie is in favourites
app.get('/api/favourites/:tmdbId', requireAuth, (req, res) => {
    const row = favouriteQueries.exists.get(req.user.id, parseInt(req.params.tmdbId));
    res.json({ isFavourite: !!row });
});

//lists routes

//get all lists for user
app.get('/api/lists', requireAuth, (req, res) => {
    const lists = listQueries.getAll.all(req.user.id);
    const listsWithMovies = lists.map(list => ({...list, movies: listMovieQueries.getByList.all(list.id),
    }));
    res.json(listsWithMovies);
});

//create new list
app.post('/api/lists', requireAuth, (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'List name is required' });
    const result = listQueries.create.run(req.user.id, name, description || '', 0);
    res.status(201).json({ id: result.lastInsertRowid, name, description });
});

//update list
app.put('/api/lists/:id', requireAuth, (req, res) => {
    const { name, description } = req.body;
    listQueries.update.run(name, description, parseInt(req.params.id), req.user.id);
    res.json({ message: 'List updated' });
});

//delete list
app.delete('/api/lists/:id', requireAuth, (req, res) => {
    const list = listQueries.getById.get(parseInt(req.params.id), req.user.id);
    if (list && list.is_watchlist) return res.status(403).json({ error: 'Cannot delete watchlist' });
    listQueries.delete.run(parseInt(req.params.id), req.user.id);
    res.json({ message: 'List deleted' });
});

//add movie to list
app.post('/api/lists/:id/movies', requireAuth, (req, res) => {
    const { tmdb_id, title, poster_path, overview, release_year } = req.body;
    if (!tmdb_id || !title) return res.status(400).json({ error: 'tmdb_id and title are required' });

    //verify list belongs to user
    const list = listQueries.getById.get(parseInt(req.params.id), req.user.id);
    if (!list) return res.status(404).json({ error: 'List not found' });

    listMovieQueries.add.run(parseInt(req.params.id), tmdb_id, title, poster_path, overview, release_year);
    res.status(201).json({ message: 'Movie added to list' });
});

//remove movie from list
app.delete('/api/lists/:id/movies/:tmdbId', requireAuth, (req, res) => {
    listMovieQueries.remove.run(parseInt(req.params.id), parseInt(req.params.tmdbId));
    res.json({ message: 'Movie removed from list' });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`CosmoCinema server running at http://localhost:${PORT}`);
});
