//Cowin Slots prototype V2 - Whatsapp API Bot
// This prototype allows users to ping a whatsapp API bot with the distrcit name
// and it provides you the nearest vaccination slots available near them
// In addition to that, it will notify you when a slot opens up
// created by https://twitter.com/akhiljp_dev

//initialize required libraries
var fs = require("fs");
const url = require("url");
const MessagingResponse = require("twilio").twiml.MessagingResponse;
var bodyParser = require("body-parser");
const express = require("express");
//express app created
const app = express();
const router = express.Router();
var fetch = require("node-fetch");

//initialize the twillio tokens
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

//initialize the tables that will be used across these apps
//creating the first table of phone numbers
var obj = {
  table: []
};
//creating the second table with district ids.
// update this file with the district name and ID mapping
var dist = {
  table: []
};

//important functions used by this app
//Function 1 : sleep - allows the program to sleep for a bit
// before rechecking the APIs for data
function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

//Function 2: sendToWA - allows the program to send a message to
// the numbers stored in mynumber.json file. This is the file
// where we are stroing all phone numbers. Can move this to a secure
// repo once we take this to prod
async function sendToWA(message) {
  return fs.readFile("mynumber.json", "utf8", function readFileCallback(
    err,
    data
  ) {
    if (err) {
      console.log("couldnt read file");
    } else {
      console.log("trying to send message ");
      obj = JSON.parse(data); //now it an object
      var data1 = obj.table;
      data1.forEach((tbl) => {
        client.messages.create({
          from: "whatsapp:+14155238886",
          body: message,
          to: "whatsapp:+91" + tbl.number
        });
        console.log("sent message to " + tbl.number);
      });
    }
  });
}
//Function 2.1: sendToWANumber - allows the program to send a message to a specific
//number
async function sendToWANumber(message, phoneNumber) {
  //check if the message is beyond 1600 characters
  console.log(message.length);
  console.log(message.match(/.{1,1600}/g));

  var parts = message.match(/[\s\S]{1,1550}/g) || [];
  console.log(parts);
  console.log("".match(/[\s\S]{1,1550}/g) || []);
  parts.forEach((part) => {
    client.messages.create({
      from: "whatsapp:+14155238886",
      body: part,
      to: phoneNumber
    });
  });
}

// Function 3: uniq - No idea what this does, need to find out from
//unmag
function uniq(arr) {
  const s = new Set(arr);
  return Array.from(s);
}

//function 4: extractcenters - this helps extract details of centers that has
// available vaccination slots more than 1 or 1
function extractcenters(respjson) {
  let centers = [];
  //console.log(respjson);
  //if you dont find any valid response send back empty
  if (!("centers" in respjson)) {
    return centers;
  }
  centers = respjson.centers.filter((centre) => {
    return centre.sessions.some((session) => session.available_capacity >= 1);
  });
  return centers.map((c) => {
    return {
      name: c.name,
      pin: c.pincode,
      vaccines:
        uniq(c.sessions.map((s) => s.vaccine).filter(Boolean)).join(" ") ||
        "Not specified",
      min_age_limit: uniq(c.sessions.map((s) => s.min_age_limit)),
      available_capacity: uniq(c.sessions.map((s) => s.available_capacity)),
      dates_available: uniq(c.sessions.map((s) => s.date))
    };
  });
}

//function 5: checkviaWA(district) - this function onrequest check the API
// to see if there are any centers with available slots. This function
// specifically extract the response and queries function 5: extract center
// to get the details and usese function 2 sendtoWA to ping users
function checkviaWA(district_var_check, phoneNumbercheck) {
  var distID;
  fs.readFile("districts.json", "utf8", function readFileCallback(err, data) {
    if (err) {
      console.log("couldnt read file");
    } else {
      dist = JSON.parse(data);
      for (var i = 0; i < dist.table.length; i++) {
        if (dist.table[i].name === district_var_check) {
          //console.log(dist.table[i].districtID);
          distID = dist.table[i].districtID;
          //const d1 = new Date(); <-- fix this later
          var cowinurl_final =
            "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=" +
            distID +
            "&date=03-05-2021";

          fetch(cowinurl_final, {
            headers: {
              accept: "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "cache-control": "no-cache",
              pragma: "no-cache",
              "sec-ch-ua":
                '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
              "sec-ch-ua-mobile": "?0",
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "cross-site"
            },
            referrer: "https://selfregistration.cowin.gov.in/",
            referrerPolicy: "strict-origin-when-cross-origin",
            body: null,
            method: "GET"
          })
            .then((res) => res.json())
            .then((json) => {
              const slots = extractcenters(json);
              if (slots.length) {
                const msg = slots
                  .map(
                    (s) =>
                      `\nPin Code:[${s.pin}] \n${s.name}\nVaccines: ${
                        s.vaccines
                      },\nMin Age Limit: ${JSON.stringify(
                        s.min_age_limit
                      )},\nAvailable Capacity: ${
                        s.available_capacity
                      },\nDates Available: ${s.dates_available}`
                  )
                  .join("\n");
                var msg1 = `Found slots!\n${msg}\n\nShare this link with your loved ones so they know when a vaccination center is available nearby https://api.whatsapp.com/send?phone=+14155238886&text=join%20scene-difficult`;
                //console.log("fetch request sent");
                sendToWANumber(msg1, phoneNumbercheck);
                //console.log(msg1);
                return true;
              } else {
                var msg2 = `No Slots Found`;
                sendToWANumber(msg2, phoneNumbercheck);
                sendToWANumber(
                  'Type "yes" if you wish to be notified about when slots become available in this area',
                  phoneNumbercheck
                );
                return false;
              }
            })
            .catch((error) => {
              console.error(error);
              sendToWA("Script errored!", error);
              return true;
            });
        }
      }
    }
  });
}

//function 7: check(district) - this function checks the districts users are interested
// and sends them an available slot
function check() {
  //const d1 = new Date(); Need to find a way to forumalte date for API
  var cowinurl_final =
    "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=395&date=02-05-2021";

  return fetch(cowinurl_final, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "sec-ch-ua":
        '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
      "sec-ch-ua-mobile": "?0",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site"
    },
    referrer: "https://selfregistration.cowin.gov.in/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET"
  })
    .then((res) => res.json())
    .then((json) => {
      const slots = extractcenters(json);
      console.log(slots);
      if (slots.length) {
        console.log(slots.length);
        const msg = slots
          .map(
            (s) =>
              `\nPin Code:[${s.pin}] \n${s.name}\nVaccines: ${
                s.vaccines
              },\nMin Age Limit: ${JSON.stringify(
                s.min_age_limit
              )},\nAvailable Capacity: ${
                s.available_capacity
              },\nDates Available: ${s.dates_available}`
          )
          .join("\n");
        console.log("check function is executed");
        sendToWA(`Found slots!\n${msg}\n\n`);
        return true;
      } else {
        sendToWA(
          `No Found slots!\n\n**********************************************************************************************************************************************************************************************************************************************************************************************************`
        );
        return false;
      }
    })
    .catch((error) => {
      console.error(error);
      sendToWA("Script errored!", error);
      return true;
    });
}

// function 7: main - this is just a heartbeat function that
//checks the status of slots every 5 mins
async function main() {
  while (true) {
    const d = new Date();
    console.log("Checking at", d.toLocaleTimeString());
    const changed = await check();
    //if (changed) {
    //   break;
    // }
    // sleep for 5 mins
    await sleep(3600000);
  }
}

//initiatlize heartbeat
main();
//initiatlize express body parser
app.use(bodyParser.urlencoded({ extended: false }));
//initiatlize WA incoming message handler
app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  console.log(req.body.Body);
  if (req.body.Body !== "Hi") {
    console.log("entered not hi");

    if (req.body.Body !== "Yes") {
      var receiveddist = req.body.Body;
      var recievedPhone = req.body.From;
      //console.log(recievedPhone);
      //console.log(`Incoming message from ${req.body.From}: ${req.body.Body}`);
      //twiml.message("The Robots are coming! Head for the hills!");
      await checkviaWA(receiveddist, recievedPhone);
      twiml.message(`Sending you slots for ${receiveddist}...`);
      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(twiml.toString());
    } else {
      twiml.message(
        "Great! we will notify you via Whatsapp when a slot becomes  available near you"
      );

      twiml.message(
        "In the meanwhile feel free to share this link with your loved ones https://findslot.in so they can be notified when a slot opens up near them too."
      );

      res.writeHead(200, { "Content-Type": "text/xml" });
      res.end(twiml.toString());
    }
  } else {
    console.log("inside welcome msg");
    twiml.message(
      "Welcome to COWIN Slots! Enter the district you need slots for"
    );
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());
  }
});
//server listening to port 8080
app.listen(8080, () => {
  console.log(`Cowinslots WA Bot listening to port 8080`);
  console.log(
    `Send "join scene-difficult" to +1 415 523 8886 to start chatting with the bot`
  );
});
//create a server object:
