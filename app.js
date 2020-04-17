const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const util = require("util");
const md5 = require("md5");

const fs = require("fs");
const http = require("http");
const multer = require("multer");
// const upload = require('express-fileupload')
const csv = require("csv");
const csvConvert = require("csvtojson");

const upload = multer({ inMemory: true });
var csvdata = [];
var totalGrade = [];
var cutoffs = 10;

const TWO_HOURS = 1000 * 60 * 60 * 2;

const {
  PORT = 3000,
  SESS_LIFETIME = TWO_HOURS,
  SESS_NAME = "sid",
  SESS_SECRET = "thecakeisalie",
  NODE_ENV = "development",
  DB_HOST = "35.227.146.173", //35.227.146.173
  DB_NAME = "cmpt470",
  DB_USER = "readonlyuser",
  DB_PASS = "readonly",
} = process.env;

const IN_PROD = NODE_ENV === "production";

const connection = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
});

connection.connect(function (err) {
  if (err) {
    console.log(err);
  }
  console.log("Connected!");
});

const app = express();

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// app.use(upload())

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
// =================================================
// redirect to login if user is not logged in
// =================================================
const redirectLogin = (req, res, next) => {
  if (!req.session.username) {
    res.redirect("/login");
  } else {
    next();
  }
};
// =================================================
// redirect to the home if the user tries to
// go to login after they are logged in
// =================================================
const redirectHome = (req, res, next) => {
  if (req.session.username) {
    res.redirect("/home");
  } else {
    next();
  }
};

// =================================================
// main page that allows you to login or to logout
// =================================================
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

// =================================================
// Show home page
// =================================================
app.get("/home", redirectLogin, (req, res) => {
  const name = req.session.username;
  res.send(`
        <h1>Home</h1>
        <a href='/'>Main</a>
        <form method='post' action='/logout'>
          <button>Logout</button>
        </form>
        <ul>
            <li>Hello ${name}</li>
        </ul>
        <form action='/upload' method='post' enctype='multipart/form-data' />
          Select CSV: <input type='file' name='csvInput' />\n
          Choose between 2 and 10 cutoffs: <input type='number' name='cutoffs' />
          <input type='submit' value='Upload'>
        </form>
    `);
});

// =================================================
// Shows the login page
// =================================================
app.get("/login", redirectHome, (req, res) => {
  res.send(`
        <h1>Login</h1>
        <form method='post' action='/login'>
            <input type='text' name='name' placeholder='name' required />
            <input type='password' name='password' placeholder='password' required />
            <input type='submit' value='Login'/>
        </form>
    `);
});

// =================================================
// Shows the grades page
// =================================================
app.get("/grades", redirectLogin, (req, res) => {
  // console.log("show grades");
  // console.log(cutoffs)
  // console.log(csvdata)
  res.write(`
    <h1>Grades</h1>
    <a href='/home'>Go Home</a>
    <form method='post' action='/cutoffs'>
    <p>Update Cutoffs: </p>
      <input type='number' name='updatedCutoffs' />
      <input type='submit' value='Submit' />
    </form>
    <p>Histogram of grades with ${cutoffs} cutoffs</p>
  `);
  histogram = []
  increment = 100/cutoffs
  // for each section of the cutoff,
  // search through every total grade
  // and add to the histogram if it falls
  // within that section
  for(i=0; i < cutoffs; i++) {
    // find the grades that fall within
    // the bounds of this section
    const lowerBound = increment * i
    const higherBound = increment * (i + 1)
    var histEntry = '{ '
    totalGrade.forEach(grade => {
      if (grade > lowerBound && grade < higherBound) {
        histEntry = histEntry + '[*] '
      }
    })
    histEntry = histEntry + '}'
    histogram.push(histEntry)
  }
  // Draw the histogram
  for(i=0; i < cutoffs; i++) {
    res.write(`<p>${i * increment}%</p>`)
    res.write(`<p>${histogram[i]}</p>`)
  }
  res.write(`<p>100%</p>`)
  res.end()
});

// =================================================
// Connect to the database and check the username and password
// for a match. Only allow for a session if there is a match
// =================================================
app.post("/login", redirectHome, async (req, res) => {
  const username = req.body.name;
  const password = md5(req.body.password);
  // console.log('username: ' + username)
  // console.log('password: ' + req.body.password)
  // console.log('md5: ' + password)
  // console.log('=================================================')
  connection.query("SELECT * FROM users", function (err, result) {
    // console.log(result)
    var userList = result;
    // console.log(userList)
    const user = userList.find(
      (user) => user.username === username && user.password === password
    );
    if (user) {
      // console.log('found')
      req.session.username = user.username;
      // console.log(req.session.username)
      return res.redirect("/home");
    } else {
      res.redirect("/login");
    }
  });
});

// =================================================
// Deletes the session and redirects to the login page
// =================================================
app.post("/logout", redirectLogin, (req, res) => {
  req.session.destroy();
  res.clearCookie(SESS_NAME);
  res.redirect("/");
});

// =================================================
// Fetches the uploaded csv and stores it into memory
// =================================================
app.post("/upload", upload.single("csvInput"), function (req, res) {
  // console.log("attempt upload");
  // var csvString = req.files.csvInput.buffer.toString()
  const rawInput = req.file.buffer.toString();
  csvConvert({ noheader: true, output: "csv" })
    .fromString(rawInput)
    .then((csvRow) => {
      csvdata = csvRow;
      cutoffs = req.body.cutoffs;
      // get the number of cutoffs and reject invalid ones
      if (cutoffs && cutoffs >= 2 && cutoffs <= 10) {
        // look for the totals row
        total = csvdata.find((entry) => entry[0] === "total");
        totalGrade = [];
        // console.log(total[1]);
        grades = csvdata.forEach((entry) => {
          // dont record the label row or the totals row
          if (entry[0] !== "studentID" && entry[0] !== "total") {
            // console.log(entry[0])
            const quizzes = entry[1] * (total[1] / 100);
            const midterm = entry[2] * (total[2] / 100);
            const final = entry[3] * (total[3] / 100);
            totalGrade.push(quizzes + midterm + final);
          }
        });
        return res.redirect("/grades");
      }
      // console.log("invalid cutoff");
      return res.redirect("/home");
    });
});

app.post("/cutoffs", redirectLogin, (req, res) => {
  if(req.body.updatedCutoffs && req.body.updatedCutoffs >= 2 && req.body.updatedCutoffscutoffs <= 10) {
    cutoffs = req.body.updatedCutoffs
  }
  res.redirect('/grades')
});

app.listen(PORT, () => {
  console.log(`http://localhost: ${PORT}`);
});
