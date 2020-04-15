const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require('mysql')
const util = require('util')
const md5 = require('md5')

const TWO_HOURS = 1000 * 60 * 60 * 2;

const {
  PORT = 3000,
  SESS_LIFETIME = TWO_HOURS,
  SESS_NAME = "sid",
  SESS_SECRET = "thecakeisalie",
  NODE_ENV = "development",
  DB_HOST = '35.227.146.173', //35.227.146.173
  DB_NAME = 'cmpt470',
  DB_USER = 'readonlyuser',
  DB_PASS = 'readonly'
} = process.env;

const IN_PROD = NODE_ENV === "production";

const connection = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME
})

connection.connect(function(err) {
    if (err) {
        console.log(err)
    }
    console.log("Connected!")
})

var users = []

const app = express()

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
  if (!req.session.username) {
    res.redirect("/login");
  } else {
    next();
  }
};

const redirectHome = (req, res, next) => {
  if (req.session.username) {
    res.redirect("/home");
  } else {
    next();
  }
};

const getUsers = () => {
    var query = 'SELECT * FROM users'
    connection.query(query, function (err, result) {
        if (err) console.log(err)
        const users = JSON.parse(JSON.stringify(result))
        return users
    })
}

app.use((req, res, next) => {
  const { userId } = req.session;
  if (userId) {
    res.locals.user = users.find((user) => user.id === userId);
  }
  next();
});

app.get("/", (req, res) => {
  const username = req.session.username;

  res.send(`
        <h1>Welcome!</h1>
        ${
          username
            ? `
            <a href='/home'>Home</a>
            <form method='post' action='/logout'>
                <button>Logout</button>
            </form>
        `
            : `
            <a href='/login'>Login</a>
        `
        }

    `);
});

app.get("/home", redirectLogin, (req, res) => {
  const name = req.session.username
  res.send(`
        <h1>Home</h1>
        <a href='/'>Main</a>
        <ul>
            <li>Hello ${name}</li>
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
    `);
});

// app.get("/register", redirectHome, (req, res) => {
//   res.send(`
//     <h1>Register</h1>
//     <form method='post' action='/register'>
//         <input type='text' name='name' placeholder='name' required />
//         <input type='password' name='password' placeholder='password' required />
//         <input type='submit' />
//     </form>
//     <a href='/login'>Login</a>
// `);
// });

app.post("/login", redirectHome, async (req, res) => {
  const username = req.body.name;
  const password = md5(req.body.password);
  // console.log('username: ' + username)
  // console.log('password: ' + req.body.password)
  // console.log('md5: ' + password)
  console.log('=================================================')
    const query = connection.query('SELECT * FROM users', function (err, result) {
      // console.log(result)
      var userList = result
      // console.log(userList)
      const user = userList.find((user) => user.username === username && user.password === password)
      if (user) {
        // console.log('found')
        req.session.username = user.username;
        // console.log(req.session.username)
        return res.redirect('/home')
      }
      else {
        res.redirect('/login')
      }
    })
});

// app.post("/register", redirectHome, (req, res) => {
//   const name = req.body.name;
//   const password = req.body.password;
//   if (name && password) {
//     // check if the user already exists
//     const exists = users.some((user) => user.name === name);
//     if (!exists) {
//       // create a new user if the name is not taken
//       const user = {
//         // TODO: get user id from the database when connected
//         id: users.length + 1,
//         name,
//         password, // hash the password
//       };
//       users.push(user);
//       req.session.userId = user.id;
//       return res.redirect("/home");
//     }
//   }

//   res.redirect("/register");
// });

app.post("/logout", redirectLogin, (req, res) => {
  req.session.destroy();
  res.clearCookie(SESS_NAME);
  res.redirect("/login");
});

app.listen(PORT, () => {
  console.log(`http://localhost: ${PORT}`);
});
