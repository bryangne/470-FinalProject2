const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const {
    PORT = 3000,
    SESS_LIFETIME = 60 * 60 * 1000,
    IN_PROD = true,
    SESS_NAME = 'sid',
    SECRET = 'thecakeisalie',
} = process.env

const redirectLogin = (req, res, next) => {
    console.log('redirect: ' + req.session);
    if (!req.session.username) {
        res.redirect('/login');
    } else {
        next();
    }
}

const redirectHome = (req, res, next) => {
    console.log('redirect home: ' + req.session);
    if (req.session.username) {
        res.redirect('/home');
    } else {
        next();
    }
}

const users = [
    {id: 1, username: 'joe', password: 'secret'},
    {id: 2, username: 'jim', password: 'password'},
]

const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}))

app.use(session({
    name: SESS_NAME,
    resave: false,
    saveUninitialized: false,
    secret: SECRET,
    cookie: {
        maxAge: SESS_LIFETIME,
        sameSite: true,
        secure: IN_PROD,
    }
}));

app.get('/', (req, res) => {
    const username = req.session.username;
    // console.log(req.session);
    res.send(`
    <html>
        <h1>Welcome!</h1>
        ${username ? `
            <form method='post' action='/logout'>
                <button type='submit'>Logout</button>
            </form>
        ` : `
            <a href='/login'>login</a>
            <a href='/register'>register</a>`
        }
    </html>
    `);
})

app.get('/home', redirectLogin, (req, res) => {
    console.log('going home!');
    const username = req.body.username;
    res.send(`
        <h1>Home</h1>
        <a href='/'>Main</a>
        <ul>
            <li>username: </li>
            <li>password: </li>
        </ul>
    `);
});

app.get('/login', redirectHome, (req, res) => {
    // console.log(req.session);
    res.send(`
        <h1>Login</h1>
        <form method='post' action='/login'>
            <input type='text' name='username' placeholder='username' required>
            <input type='password' name='password' placeholder='password' required>
            <button type='submit'>Login</button>
        </form>
        <a href='/register'>Register</a>
    `)
    // res.sendFile('/login.html', { root : __dirname});
});

app.get('/register', redirectHome, (req, res) => {
    res.send(`
    <h1>Register</h1>
    <form method='post' action='/register'>
        <input type='text' name='username' placeholder='username' required>
        <input type='password' name='password' placeholder='password' required>
        <button type='submit'>Register</button>
    </form>
    <a href='/login'>Login</a>
    `);
});

app.post('/login', (req, res) => {
    console.log('logging in!');
    const username = req.body.username;
    const password = req.body.password;
    console.log('Username: ' + username + " Password: " + password);
    if (username && password) {
        console.log('username and password entered')
        const user = users.find(user => user.username === username && user.password === password); // hash
        console.log(user);
        if (user) {
            console.log('user with valid password')
            req.session.username = user.username;
            console.log('Session username: ' + req.session.username);
            return res.redirect('/home');
        }
    }
    res.redirect('/login');
});

app.post('/register', (req, res) => {
    console.log('registering!');
    const username = req.body.username;
    const password = req.body.password;
    console.log('Username: ' + username + " Password: " + password);
    if (username && password) {
        const exists = users.some(
            user => user.username === username
        )
        if (!exists) {
            const user = {
                username,
                password //hash
            };
            users.push(user);
            req.session.username = user.username;
            return res.redirect('/home');
        }
    }
    res.redirect('/register');
});

app.post('/logout', redirectLogin, (req, res) => {
    console.log("logging out!");
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/home');
        }
        res.clearCookie(SESS_NAME);
        res.redirect('/login');
    });
})

app.listen(PORT, () => {
    console.log('local host port: ' + PORT);
});