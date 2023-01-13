/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const {req, res} = require('express');
const express = require('express');
const app = express();
const csrf = require('tiny-csrf');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const passport = require('passport');
const connectEnsureLogin = require('connect-ensure-login');
const session = require('express-session');
const LocalStrategy = require('passport-local');

const bcrypt = require('bcrypt');
const saltRounds = 10;

const flash = require('connect-flash');

app.use(express.urlencoded({extended: false}));
const path = require('path');

app.set('views',path.join(__dirname,'views'));

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(flash());

app.use(bodyParser.json());
app.use(cookieParser('ssh!!!! some secret string'));
app.use(csrf('this_should_be_32_character_long', ['POST', 'PUT', 'DELETE']));

app.use(session({
  secret:"this is my secret-122333444455555",
  cookie:{
    maxAge: 24 * 60 * 60 * 1000 
  }
}))

const {
  Admins,Elections,
} = require("./models");

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next)=>{
  res.locals.messages = req.flash();
  next();
});

passport.use(new LocalStrategy({
  usernameField: 'email',
  password: 'password',
},(username, password, done) => {
  Admins.findOne({
    where:{
      email:username,
      
    }
  })
  .then(async(user) => {
    const result = await bcrypt.compare(password, user.password);
    if(result){
      return done(null,user);
    } else{
      return done(null, false, {message: "Invalid Password"});
    }
  })
  .catch((error) => {
    console.error(error);
    return done(null,false,{
      message: "You are not a registered user",
    })

  })
}))

passport.serializeUser((user, done)=>{
  console.log("Serializing user in session",user.id)
  done(null,user.id);
});

passport.deserializeUser((id,done) => {
  Admins.findByPk(id)
  .then(user => {
    done(null, user)
  })
  .catch(error =>{
    done(error, null)
  })
})

app.get('/', async (req, res)=>{
  if(req.user)
  {
    res.redirect('/firstPage');
  }
  else{  
  res.render('index', {
      title: 'Online Voting Platform',
      csrfToken: req.csrfToken(),
    });
  }
});

app.get('/signup',(req,res)=>{
  res.render('signup',{
    title: 'Sign Up',
    csrfToken: req.csrfToken(),
  });
});

app.post("/admins", async (req, res) => {
  let hashedPwd = await bcrypt.hash(req.body.password, saltRounds);
  if (req.body.password === "") hashedPwd = "";
  try {
    const user = await Admins.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPwd,
    });
    req.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      res.redirect("/firstPage");
    });
  } catch (error) {
    console.log(error);
    if ("errors" in error)
      req.flash(
        "error",
        error.errors.map((error) => error.message)
      );
    res.redirect("/signup");
  }
});

app.get('/firstPage',connectEnsureLogin.ensureLoggedIn(),async (req,res)=>{
  const currentUserId = req.user.id;
  const elections = await Elections.findAllElectionOfUser(currentUserId);  
  res.render('firstPage',{
    title: 'firstPage',
    elections,
    csrfToken: req.csrfToken(),
  });
});

app.get('/login',(req,res)=>{
  res.render('login',{
    title:"Login",
    csrfToken: req.csrfToken(),
  });
});

app.post('/session',passport.authenticate('local',{
  failureRedirect: '/login',
  failureFlash: true,
}),(req,res)=>{
  console.log(req.user);
  res.redirect('/firstPage');
})

app.get('/signout',(req,res, next) => {
  req.logOut((err)=>{
    if(err)
    {
      return next(err);
    }
    res.redirect('/');
  })
})

module.exports = app;