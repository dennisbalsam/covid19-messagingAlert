// for env variables
require('dotenv').config()
//bring in libraries
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cron = require('node-cron')
const admin = require('firebase-admin')
const serviceAccount = require('./firebasecreds.json')
const axios = require('axios');
// for parsing
app.use(bodyParser.json())

//firebase activation
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
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
          lastUpdateTime: new Date(lastUpdate).toLocaleTimeString()
      }
      
      return modifiedData;

  } catch (error) {
      console.log(error)        
  }
}

// send out
function sendOut(confirmed, recovered, deaths, date) {
  console.log(confirmed);
  console.log(deaths);
  console.log(recovered);
  console.log(date);
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
              body: ` Hello ${key} \n Covid-19 Stats - Last Update: \n ${date} \n ${confirmed} \n ${recovered} \n ${deaths}`
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

cron.schedule("* * * * *", function() {
  fetchData().then((res)=> {
    //prepare values for send out
    let confirmed = 'Confirmed Cases: ' +  new Intl.NumberFormat('en-US').format(res.confirmed.value);
    let recovered = 'Amount of Recoveries: ' + new Intl.NumberFormat('en-US').format(res.recovered.value);
    let deaths = 'Amount of Deaths: ' + new Intl.NumberFormat('en-US').format(res.deaths.value);
    let date = res.lastUpdateDate + ' - ' + res.lastUpdateTime;
  
    // call the send out function
    sendOut(confirmed,recovered,deaths,date);
  
  })
  
});





//create a basic post route for front end to store the user
app.post('/api/data/', async (req, response) => {

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

















