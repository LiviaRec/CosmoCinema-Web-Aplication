
# <img src="https://i.imgur.com/a9HeiDw.gif" alt="stars" width="25"/> CosmoCinema - Movie Picker Web Application

Thisis a movie picker web application using TMDB, it help you choose a movie based on the filters you want and saves the m to watchlists and favourites. Movie data is fetched from TMDB on the backend and forwarded to the frontend.


## Pages


### Home (index.html)

The landing/hero page has a centered navbar with links to all pages and a Sign In button. CosmoCinema title with animated starfield background and a "Get Started" button navigates to the Picker.


### Picker (picker.html)

The main feature of the web application. It has three dropdown filters: 
- Genre (loaded from TMDB)
- Mood
- Duration

Two buttons:
- Pick a movie — fetches a movie matching the selected filters from TMDB
- Surprise me! — fetches a completely random movie

After a movie is returned, a result card appears showing the poster, title, year, and description. 

Two icon buttons let the user save the movie to Favourites (heart) or Watchlist (bookmark). 

Both icons update visually when active. If the user is not signed in, clicking either button opens the sign-in modal.


### Favourites (favourites.html)

Displays all movies saved as favourites in a 5-column grid. Each card shows:

- Movie poster with white border
- Movie title underneath
- A red heart button -> clicking it starts a 10-second undo countdown. Turns red when active.
- A bookmark button -> toggles whether the movie is also saved to the Watchlist. Turns green when active.


### Lists (lists.html)

Displays all the user's lists as rows. The Watchlist is always pinned at the top. Each row shows:

- List Title and description on the left
- Movie posters scrolling horizontally on the right, each with a white border
- Under each poster: a heart button (adds to Favourites) and an × button (removes from the list)
- Custom lists have a red "Delete list" button


## Database 

SQLite database stored at backend/cosmocinema.db. 

It has four tables:

users — id, username, email, hashed password, created_at

favourites — id, user_id, tmdb_id, title, poster_path, overview, release_year

lists — id, user_id, name, description, is_watchlist (1 = Watchlist, always created on register), created_at

list_movies — id, list_id, tmdb_id, title, poster_path, overview, release_year, added_at

## Authentication

Passwords are hashed with bcrypt. 

On login or register the server returns a JWT token valid for 7 days. 

The token is stored in localStorage and sent as a Bearer token on every API request that requires authentication.

## Figma Prototype

<img width="8201" height="1082" alt="CosmoCinemaCut API" src="https://github.com/user-attachments/assets/8017f170-a50b-4183-8495-3c8a0814755a" />


## Color Theme Inspiration

<img src="https://i.pinimg.com/736x/66/3c/14/663c14db147e662e2cfc4991e09d1153.jpg" height="500"/>


## Notes

node_modules/ is in .gitignore — run npm install after cloning

The Watchlist cannot be deleted — it is always present for every user

TMDB movie data (poster, description, title) is stored locally in SQLite when saved, so it remains available even if TMDB is temporarily unreachable



