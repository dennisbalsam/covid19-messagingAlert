// for env variables
require('dotenv').config()
//bring in libraries
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cron = require('node-cron')
const admin = require('firebase-admin')
//const serviceAccount = require('./firebasecreds.json')
const axios = require('axios');

//trying to fix request issues
const cors = require('cors')
app.use(cors())

// for parsing
app.use(bodyParser.json())

//firebase activation local
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

//firebase activation for heroku
admin.initializeApp({
  credential: admin.credential.cert({
    "type": process.env.FIREBASE_TYPE,
    "project_id": process.env.FIREBASE_PROJECT_ID,
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
    "private_key": JSON.parse(process.env.FIREBASE_PRIVATE_KEY),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "client_id": process.env.FIREBASE_CLIENT_ID,
    "auth_uri": process.env.FIREBASE_AUTH_URI,
    "token_uri": process.env.FIREBASE_TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
 }),
 databaseURL: "https://covid19-tracker-edc90.firebaseio.com"
})
const db = admin.firestore()

// twilio credentials
var client = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
    
)

const fetchData = async(country) => {
  
  //url to use
  const url = 'https://covid19.mathdro.id/api';

  //try catch for api
  try {
      // use axios to make api call
      const { data: { confirmed, recovered, deaths, lastUpdate }} = await axios.get(url);

      const modifiedData = {
          confirmed,
          recovered,
          deaths,
          lastUpdateDate: new Date(lastUpdate).toDateString(),
          lastUpdateTime: new Date(lastUpdate).toLocaleTimeString("en-US", {timeZone: "America/New_York"})
      }
      
      return modifiedData;

  } catch (error) {
      console.log(error)        
  }
}

// send out
function sendOut(confirmed, recovered, deaths, date,time) {
  console.log(confirmed);
  console.log(deaths);
  console.log(recovered);
  console.log(date);
  console.log(time)
  // get all subscirbed users
    var users = db.collection('users');
    var list = new Object();
    var allUsers = users.get()
    .then(response => {
        response.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
            list[doc.data().name] = doc.data().number;

            
        });
        // send the messages here
        for (var key in list){
          console.log( key, list[key] );

          try {
            client.messages.create({
              from: process.env.TWILIO_NUMBER,
              to: list[key],
              body: `  Hello ${key} \n Covid-19 Stats - Last Update: \n ${date} \n ${time} \n ${confirmed} \n ${recovered} \n ${deaths}`
            }).then((message) => console.log(message.sid));
            } catch (err) {
              console.log(err);
          }
        }


          })
          .catch(err => {
              console.log('Error getting documents', err);
          });

}


cron.schedule("15 33 * * *", function() {
  console.log("cron function starting");
  fetchData().then((res)=> {
    //prepare values for send out
    let confirmed = 'Confirmed Cases: ' +  new Intl.NumberFormat('en-US').format(res.confirmed.value);
    let recovered = 'Amount of Recoveries: ' + new Intl.NumberFormat('en-US').format(res.recovered.value);
    let deaths = 'Amount of Deaths: ' + new Intl.NumberFormat('en-US').format(res.deaths.value);
    let date = res.lastUpdateDate
    let time = res.lastUpdateTime + ' EST ';
  
    // call the send out function
    sendOut(confirmed,recovered,deaths,date,time);
  
  })
  
});





//create a basic post route for front end to store the user
app.post('/api/data/', async (req, response) => {

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
  response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type'); // If needed
  response.setHeader('Access-Control-Allow-Credentials', true); // If needed
  
  // create object for add
  let test  = {
    name: req.body.name,
    number: req.body.number
  }

  //phone validation
  let url = `http://apilayer.net/api/validate?access_key=${process.env.PHONE_VALID_KEY}&number=${test.number}&country_code=US&format=1`

  //check if the number is valid 
  let valid = axios.get(url).then((res) => {
    if(res.data.valid){
       //check to see if this person already registered for this service
      var exists = db.collection('users').doc(req.body.number);

      exists.get().then((doc) => {
        if (doc.exists) {
          console.log("EXISTS ALREADY");
          //send back message
          response.json({ response: 'This number already registered for this service' })
        }
        else {
            // add user to database
            db.collection('users').doc(req.body.number).set(test).then(()=> {
              console.log("added a user");
            });
            //for the logs
            console.log(`New User Added: ${test.name}  ${test.number}`)
            //sned back message
            response.json({ response: 'Successfully registered for this service'});
            
        }
      })
    }
    else {
      response.json({ response: 'This phone number is not a valid registered one, please try again'});
    }
  });

 

});

// Choose the port and start the server
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
console.log(`Using Port: ${PORT}`)
})

















