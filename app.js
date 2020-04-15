const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");

const TWO_HOURS = 1000 * 60 * 60 * 2;

const {
  PORT = 3000,
  SESS_LIFETIME = TWO_HOURS,
  SESS_NAME = "sid",
  SESS_SECRET = "thecakeisalie",
  NODE_ENV = "development",
  DB_HOST = 'localhost',
  DB_NAME = 'cmpt470',
  DB_USER = 'readonlyuser',
  DB_PASS = 'readonly'
} = process.env;

const IN_PROD = NODE_ENV === "production";

const users = [
  { id: 1, name: "alex", password: "secret" },
  { id: 2, name: "bob", password: "secret" },
];

const app = express();

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    name: SESS_NAME,
    resave: false,
    saveUninitialized: false,
    secret: SESS_SECRET,
    cookie: {
      maxAge: SESS_LIFETIME,
      sameSite: true,
    //   secure: IN_PROD,
    },
  })
);

const redirectLogin = (req, res, next) => {
  if (!req.session.userId) {
    res.redirect("/login");
  } else {
    next();
  }
};

const redirectHome = (req, res, next) => {
  if (req.session.userId) {
    res.redirect("/home");
  } else {
    next();
  }
};

app.use((req, res, next) => {
  const { userId } = req.session;
  if (userId) {
    res.locals.user = users.find((user) => user.id === userId);
  }
  next();
});

app.get("/", (req, res) => {
  const { userId } = req.session;

  res.send(`
        <h1>Welcome!</h1>
        ${
          userId
            ? `
            <a href='/home'>Home</a>
            <form method='post' action='/logout'>
                <button>Logout</button>
            </form>
        `
            : `
            <a href='/login'>Login</a>
            <a href='/register'>Register</a>
        `
        }

    `);
});

app.get("/home", redirectLogin, (req, res) => {
  const { user } = res.locals;
  res.send(`
        <h1>Home</h1>
        <a href='/'>Main</a>
        <ul>
            <li>Hello ${user.name}</li>
        </ul>
    `);
});

app.get("/login", redirectHome, (req, res) => {
  res.send(`
        <h1>Login</h1>
        <form method='post' action='/login'>
            <input type='text' name='name' placeholder='name' required />
            <input type='password' name='password' placeholder='password' required />
            <input type='submit' />
        </form>
        <a href='/register'>Register</a>
    `);
});

app.get("/register", redirectHome, (req, res) => {
  res.send(`
    <h1>Register</h1>
    <form method='post' action='/register'>
        <input type='text' name='name' placeholder='name' required />
        <input type='password' name='password' placeholder='password' required />
        <input type='submit' />
    </form>
    <a href='/login'>Login</a>
`);
});

app.post("/login", redirectHome, (req, res) => {
  const name = req.body.name;
  const password = req.body.password;
  if (name && password) {
    const user = users.find(
      (user) => user.name === name && user.password === password
    );
    if (user) {
      req.session.userId = user.id;
      return res.redirect("/home");
    }
  }
  res.redirect("/login");
});

app.post("/register", redirectHome, (req, res) => {
  const name = req.body.name;
  const password = req.body.password;
  if (name && password) {
    // check if the user already exists
    const exists = users.some((user) => user.name === name);
    if (!exists) {
      // create a new user if the name is not taken
      const user = {
        // TODO: get user id from the database when connected
        id: users.length + 1,
        name,
        password, // hash the password
      };
      users.push(user);
      req.session.userId = user.id;
      return res.redirect("/home");
    }
  }

  res.redirect("/register");
});

app.post("/logout", redirectLogin, (req, res) => {
  req.session.destroy();
  res.clearCookie(SESS_NAME);
  res.redirect("/login");
});

app.listen(PORT, () => {
  console.log(`http://localhost: ${PORT}`);
});
