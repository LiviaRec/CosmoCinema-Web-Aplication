const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {userQueries, listQueries} = require('./database');
const JWT_SECRET = process.env.JWT_SECRET

//creates json web token , expires in 7 days
function generateToken(user) {
    return jwt.sign({id: user.id, username: user.username}, JWT_SECRET, {expiresIn : '7d'});
}

//middleware  , next() if token valid, else 401 error
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } 
    catch (err){
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

async function register(req, res) {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
        return res.status(400).json({ error: 'All fields are required' });
 
    // email format validation 
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
        return res.status(400).json({ error: 'Invalid email address' });
 
    // username rules
    if (username.length < 3 || username.length > 30)
        return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
 
    if (!/^[a-zA-Z0-9_]+$/.test(username))
        return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' });
 
    // password strength
    if (password.length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' });

    try { //hash password, create user, create watchlist, generate token
        const hashed = await bcrypt.hash(password, 10);
        const result = await userQueries.create.run(username, email, hashed);
        const userRow = await userQueries.findByEmail.get(email);
        const user = { id: userRow.id, username, email };

        await listQueries.ensureWatchlist.run(user.id, user.id);

        const token = generateToken(user);
        res.status(201).json({ token, user: { id: user.id, username, email } });
    } 
    catch (err) {
        console.error("Registration Error Details:", err.message);
        if (err.message.includes('UNIQUE')) {
            if (err.message.includes('username'))
                return res.status(409).json({ error: 'Username already taken' });
            if (err.message.includes('email'))
                return res.status(409).json({ error: 'Email already registered' });
        }
    res.status(500).json({ error: 'Server error' });
  }
}


async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required' });
    try { //find user, compare password, ensure watchlist, generate token
        const user = await userQueries.findByEmail.get(email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        await listQueries.ensureWatchlist.run(user.id, user.id);

        const token = generateToken(user);
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } 
    catch (err) { 
        console.error("Login Error Details:", err.message);
        res.status(500).json({ error: 'Server error during login' });
    }
}

module.exports = {requireAuth, register, login};

