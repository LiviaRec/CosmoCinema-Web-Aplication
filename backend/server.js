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

app.use(express.static(path.join(__dirname, 'frontend')));

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username });
});


app.get('/api/movies/genres', async (req, res) => {
    try {
        const genres = await getGenres();
        res.json(genres);
    } 
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});


app.get('/api/movies/moods', (req, res) => {
    res.json([ 'Lighthearted', 'Thought-Provoking', 'Intense', 'Relaxing', 'Nostalgic', 'Emotional', 'Funny', 'Scary']);
});

app.get('/api/movies/durations', (req, res) => {
    res.json(['Short (< 90 min)', 'Medium (90-120 min)', 'Long (> 120 min)']);
});

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

app.get('/api/favourites', requireAuth, async (req, res) => {
    try {
        const favs = await favouriteQueries.getAll.all(req.user.id);
        res.json(favs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get favourites' });
    }
});

app.post('/api/favourites', requireAuth, async (req, res) => {
    const { tmdb_id, title, poster_path, overview, release_year } = req.body;
    if (!tmdb_id || !title) return res.status(400).json({ error: 'tmdb_id and title are required' });
    try {
        await favouriteQueries.add.run(req.user.id, tmdb_id, title, poster_path, overview, release_year);
        res.status(201).json({ message: 'Added to favourites' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add favourite' });
    }
});

app.delete('/api/favourites/:tmdbId', requireAuth, async (req, res) => {
    try {
        await favouriteQueries.remove.run(req.user.id, parseInt(req.params.tmdbId));
        res.json({ message: 'Removed from favourites' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove favourite' });
    }
});

app.get('/api/favourites/:tmdbId', requireAuth, async (req, res) => {
    try {
        const row = await favouriteQueries.exists.get(req.user.id, parseInt(req.params.tmdbId));
        res.json({ isFavourite: !!row });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check favourite' });
    }
});



app.get('/api/lists', requireAuth, async (req, res) => {
    try {
        const lists = await listQueries.getAll.all(req.user.id);
        const listsWithMovies = await Promise.all(
            lists.map(async list => ({
                ...list,
                movies: await listMovieQueries.getByList.all(list.id)
            }))
        );
        res.json(listsWithMovies);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get lists' });
    }
});

app.post('/api/lists', requireAuth, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'List name is required' });
    try {
        const result = await listQueries.create.run(req.user.id, name, description || '', 0);
        res.status(201).json({ id: result.lastInsertRowid, name, description });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create list' });
    }
});

app.put('/api/lists/:id', requireAuth, async (req, res) => {
    const { name, description } = req.body;
    try {
        await listQueries.update.run(name, description, parseInt(req.params.id), req.user.id);
        res.json({ message: 'List updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update list' });
    }
});

app.delete('/api/lists/:id', requireAuth, async (req, res) => {
    try {
        const list = await listQueries.getById.get(parseInt(req.params.id), req.user.id);
        if (list && list.is_watchlist) return res.status(403).json({ error: 'Cannot delete watchlist' });
        await listQueries.delete.run(parseInt(req.params.id), req.user.id);
        res.json({ message: 'List deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete list' });
    }
});

app.post('/api/lists/:id/movies', requireAuth, async (req, res) => {
    const { tmdb_id, title, poster_path, overview, release_year } = req.body;
    if (!tmdb_id || !title) return res.status(400).json({ error: 'tmdb_id and title are required' });
    try {
        const list = await listQueries.getById.get(parseInt(req.params.id), req.user.id);
        if (!list) return res.status(404).json({ error: 'List not found' });
        await listMovieQueries.add.run(parseInt(req.params.id), tmdb_id, title, poster_path, overview, release_year);
        res.status(201).json({ message: 'Movie added to list' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add movie to list' });
    }
});

app.delete('/api/lists/:id/movies/:tmdb_id', requireAuth, async (req, res) => {
    try {
        const list = await listQueries.getById.get(parseInt(req.params.id), req.user.id);
        if (!list) return res.status(404).json({ error: 'List not found' });
        await listMovieQueries.remove.run(parseInt(req.params.id), parseInt(req.params.tmdb_id));
        res.json({ message: 'Movie removed from list' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove movie from list' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`CosmoCinema server running at http://localhost:${PORT}`);
});
