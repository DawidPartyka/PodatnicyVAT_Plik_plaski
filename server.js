const httpsPort = 8000;

/*Dependencies*/
var express = require('express');
var https = require('https');
var fs = require('fs');
var sha512 = require('js-sha512');
/*Dependencies*/

var app = express();

/*SSL*/
var options = {
    key: fs.readFileSync('key.pem', 'utf8'),
    cert: fs.readFileSync('server.crt', 'utf8')
};
//console.log("KEY: ", options.key);
//console.log("CERT: ", options.cert);
/*SSL*/

var serverHttps = https.createServer(options, app).listen(httpsPort, () => {
    console.log(">> Server listening at port " + httpsPort);
});

/*Request | routing handler*/
app.use('/index', express.static(__dirname + '/clientFiles'));  //main page https://localhost:8000/index/vat.html

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

app.post('/getInfo', function(req, res){
  //JSON plik płaski
  let jsonData = require("./20200507.json");

  let parsedData = {
    head: {
      date: jsonData.naglowek.dataGenerowaniaDanych,
      key: jsonData.naglowek.schemat.substring(0, jsonData.naglowek.schemat.indexOf(',')),
      transformations: jsonData.naglowek.liczbaTransformacji
    },
    podCzyn: jsonData.skrotyPodatnikowCzynnych,
    podZwol: jsonData.skrotyPodatnikowZwolnionych,
    masks: jsonData.maski
  }
  
  /*
  console.log(parsedData.head.key);
  console.log(parsedData.head.date);
  console.log(parsedData.head.transformations);
  console.log(parsedData.podCzyn.length);
  console.log(parsedData.podZwol.length);
  console.log(parsedData.masks.length);
  */

  //POSTed data
  req.on('data', chunk => {
      //No sanity checks whatsoever. Just a test build.
      let obj = {
        nip: '',    //Placeholder for NIP
        bank: '',   //Placeholder for bank account number
        status: '', //Placeholder for the status which will be the response for client
        create: function(){
          let x = chunk.toString().split(' '); //Data send as plain text divided with space "NIP Bank_account_number" for tests
          this.nip = x[0];                     //NIP
          this.bank = x[1];                    //Bank account number
          console.log(this.nip);
          console.log(this.bank);
            
          this.start();                        //Start processing data
        },
        getBatch: function(nip, bank){
          let date = parsedData.head.date; //Date from the JSON file
          let key = parsedData.head.key;   //Key based on which the batch while be set
          let batch = '';                  //Variable for the batch that will be returned

          /*Hard coded date split for the purpose of creating batch for the hashing*/
          //Attributes named after corresponding letters in scheme given in JSON file
          let source = {
            R: date.slice(0, 4), //Year
            M: date.slice(4, 6), //Month
            D: date.slice(6, 8), //Date
            N: nip,              //NIP
            B: bank              //Bank account number
          }
          /*Hard coded date split for the purpose of creating batch for the hashing*/

          while(key){
            batch += source[key[0]][0];                //Character to add to the batch

            source[key[0]] = source[key[0]].substr(1); //Removes first character from the attribute corresponding to the current one needed by key
            key = key.substring(1);                    //Removes first character from key
          }

          console.log('batch: ' + batch);
          return batch;
        },
        calcSHA512: function(content, transformations){ //Transforming the string given number of times
          let x = content;
          for(let i = 0; i < transformations; i++){
            x = sha512(x);
          }
          return x;
        },
        start: function(){
          let val = this.getBatch(this.nip, this.bank); //Get batch for current NIP and bank account based on received key from json file
          let search = this.calcSHA512(val, parsedData.head.transformations); //Hash the batch
          console.log(search);
          this.checkStatus(search); //Find the hashed string in JSON file
        },
        checkStatus: function(shaCheck){
          if(parsedData.podCzyn.indexOf(shaCheck) >= 0)
            this.status = 'Czynny podatnik VAT';
          else if(parsedData.podZwol.indexOf(shaCheck) >= 0)
            this.status = 'Zwolniony podatnik VAT';
          else
            this.status = 'Nie widnieje na liście podatników VAT';

          res.end(this.status); //Send response to client
          console.log(this.status);
        }
      }

      obj.create(); //Start processing data
  });
});
