const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'cosmocinema.db')
    : path.join(__dirname, 'cosmocinema.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database');
});

// wrapper functions to use async/await with sqlite3
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);         
        else resolve({ lastInsertRowid: this.lastID, changes: this.changes }); // this.lastID gives id of last inserted row, this.changes gives number of rows affected
    });
});

// for select queries dbGet
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// dbAll for multiple rows
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

db.serialize(() => {
    db.run('PRAGMA journal_mode = WAL');

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS favourites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        poster_path TEXT,
        overview TEXT,
        release_year INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, tmdb_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_watchlist INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS list_movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        poster_path TEXT,
        overview TEXT,
        release_year INTEGER,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
        UNIQUE(list_id, tmdb_id)
    )`);
});

const userQueries = {
    create: {
        run: (username, email, password) => dbRun(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, password]
        )
    },
    findByEmail: {
        get: (email) => dbGet('SELECT * FROM users WHERE email = ?', [email])
    },
    findById: {
        get: (id) => dbGet('SELECT id, username, email FROM users WHERE id = ?', [id])
    }
};

const favouriteQueries = {
    add: {
        run: (userId, tmdbId, title, posterPath, overview, releaseYear) => dbRun(
            'INSERT OR IGNORE INTO favourites (user_id, tmdb_id, title, poster_path, overview, release_year) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, tmdbId, title, posterPath, overview, releaseYear]
        )
    },
    remove: {
        run: (userId, tmdbId) => dbRun(
            'DELETE FROM favourites WHERE user_id = ? AND tmdb_id = ?',
            [userId, tmdbId]
        )
    },
    getAll: {
        all: (userId) => dbAll(
            'SELECT * FROM favourites WHERE user_id = ? ORDER BY id DESC',
            [userId]
        )
    },

    exists: {
        get: (userId, tmdbId) => dbGet(
            'SELECT id FROM favourites WHERE user_id = ? AND tmdb_id = ?',
            [userId, tmdbId]
        )
    }
};

const listQueries = {
    create: {
        run: (userId, name, description, isWatchlist) => dbRun(
            'INSERT INTO lists (user_id, name, description, is_watchlist) VALUES (?, ?, ?, ?)',
            [userId, name, description, isWatchlist]
        )
    },
    getAll: {
        all: (userId) => dbAll(
            'SELECT * FROM lists WHERE user_id = ? ORDER BY is_watchlist DESC, created_at ASC',
            [userId]
        )
    },
    getById: {
        get: (id, userId) => dbGet(
            'SELECT * FROM lists WHERE id = ? AND user_id = ?',
            [id, userId]
        )
    },
    update: {
        run: (name, description, id, userId) => dbRun(
            'UPDATE lists SET name = ?, description = ? WHERE id = ? AND user_id = ?',
            [name, description, id, userId]
        )
    },
    delete: {
        run: (id, userId) => dbRun(
            'DELETE FROM lists WHERE id = ? AND user_id = ?',
            [id, userId]
        )
    },
    // create watchlist if not existent
    ensureWatchlist: {
        run: (userId1, userId2) => dbRun(
            `INSERT OR IGNORE INTO lists (user_id, name, description, is_watchlist)
             SELECT ?, 'Watchlist', 'Your watchlist in CosmoCinema — save movies to watch later.', 1
             WHERE NOT EXISTS (SELECT 1 FROM lists WHERE user_id = ? AND is_watchlist = 1)`,
            [userId1, userId2]
        )
    },
    getWatchlist: {
        get: (userId) => dbGet(
            'SELECT * FROM lists WHERE user_id = ? AND is_watchlist = 1',
            [userId]
        )
    }
};

const listMovieQueries = {
    add: {
        run: (listId, tmdbId, title, posterPath, overview, releaseYear) => dbRun(
            'INSERT OR IGNORE INTO list_movies (list_id, tmdb_id, title, poster_path, overview, release_year) VALUES (?, ?, ?, ?, ?, ?)',
            [listId, tmdbId, title, posterPath, overview, releaseYear]
        )
    },
    remove: {
        run: (listId, tmdbId) => dbRun(
            'DELETE FROM list_movies WHERE list_id = ? AND tmdb_id = ?',
            [listId, tmdbId]
        )
    },
    getByList: {
        all: (listId) => dbAll(
            'SELECT * FROM list_movies WHERE list_id = ? ORDER BY added_at DESC',
            [listId]
        )
    }
};

module.exports = { db, userQueries, favouriteQueries, listQueries, listMovieQueries };