import movieDatabase from '../data/movies.js';

const movieContainer = document.getElementById('movieContainer');
const moviePoster = document.getElementById('moviePoster');
const movieTitle = document.getElementById('movieTitle');
const movieDescription = document.getElementById('movieDescription');

function displayMovie(movie) {
    moviePoster.src = movie.poster;
    movieTitle.innerText = movie.title;
    movieDescription.innerText = movie.desc;

    // Show the Flexbox container (removes 'hidden' class)
    movieContainer.classList.remove('hidden');
    
    // Auto-scroll to the result so the user sees it
    movieContainer.scrollIntoView({ behavior: 'smooth' });
}

// Logic for "Pick a Movie"
document.getElementById('pick-btn').addEventListener('click', () => {
    const genre = document.getElementById('genre-filter').value;
    const mood = document.getElementById('mood-filter').value;
    const duration = document.getElementById('duration-filter').value;

    const filtered = movieDatabase.filter(m => 
        (genre === 'any' || m.genre === genre) &&
        (mood === 'any' || m.mood === mood) &&
        (duration === 'any' || m.duration === duration)
    );

    if (filtered.length > 0) {
        const randomChoice = filtered[Math.floor(Math.random() * filtered.length)];
        displayMovie(randomChoice);
    } else {
        alert("The stars haven't aligned for that combination. Try different filters!");
    }
});

// Logic for "Surprise Me!"
document.getElementById('surprise-btn').addEventListener('click', () => {
    const surpriseChoice = movieDatabase[Math.floor(Math.random() * movieDatabase.length)];
    displayMovie(surpriseChoice);
});