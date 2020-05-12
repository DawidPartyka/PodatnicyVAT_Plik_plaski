const httpsPort = 8000;

/*Dependencies*/
var express = require('express');
var https = require('https');
var fs = require('fs');
var sha512 = require('js-sha512');
var JSONStream = require('JSONStream');
var es = require('event-stream');
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
  let stream;                 //Placeholder for creating a JSON stream to parse
  let parser;                 //Placeholder for JSON parser to pipe
  let hash = '';              //Placeholder for hashed string
  let status = '';            //Placeholder for status to be returned
  let nip = '';               //Placeholder for NIP
  let bank = '';              //Placeholder for bank account number
  let startTime = new Date(); //..Only for tests.
  let switchArray = 0;        /*..Variable to differenciate currently processed arrays.
                              Data in parsed streams won't have property "skrotyPodatnikowCzynnych" nor "skrotyPodatnikowZwolnionych",
                              instead will pass only an array.
                              */

  req.on('data', chunk => {
    let x = chunk.toString().split(' '); //Data sent as plain text divided with space "NIP Bank_account_number" for tests
    nip = x[0];               //NIP
    bank = x[1];              //Bank account numver
  });
  //console.log(data);
  let parsedData = {
    head: {
      date: '',               //Placeholder for date from given file
      key: '',                //Placeholder for scheme to create batch for SHA512 from given file
      transformations: ''     //Placeholder for number of SHA512 transformations from given file
    }
  }

  function getHash(){
    let date = parsedData.head.date;          //Date from the JSON file
    let key = parsedData.head.key;            //Key based on which the batch while be set
    let t = parsedData.head.transformations;  //Number of transformations
    delete parsedData.head;                   //Header data no longer needed
    let batch = '';                           //Variable for the batch that will be returned

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

    //Create batch for SHA512 transformation according to scheme given in the header of JSON file
    while(key){
      batch += source[key[0]][0];                //Character to add to the batch

      source[key[0]] = source[key[0]].substr(1); //Removes first character from the attribute corresponding to the current one needed by key
      key = key.substring(1);                    //Removes first character from key
    }

    for(let i = 0; i < t; i++){ //..t - number of transformations given in file
      batch = sha512(batch);    //..one SHA512 transformations
    }

    return batch;
  }

  let getStream = function () {
    let jsonData = './20200507.json'; //JSON file
    stream = fs.createReadStream(jsonData, { encoding: 'utf8' });
    parser = JSONStream.parse('*');

    return stream.pipe(parser);       //Start reading JSON
  };

  getStream().pipe(es.mapSync(function (data){
    /*
    Checks if current data in stream is the header
    (parsed stream omits the 'header' and returns date, number of transformations and scheme as independent object)
    */
    if(data.dataGenerowaniaDanych && parsedData.head.transformations == false){
        parsedData.head.date = data.dataGenerowaniaDanych;
        parsedData.head.transformations = data.liczbaTransformacji;
        parsedData.head.key = data.schemat.substring(0, data.schemat.indexOf(','));
    }
    else{
      if(hash == false)
        hash = getHash(); //Create hashed string based on received data from header

      if(data instanceof Array){ //Check if currently processed data is an array (only SHA512 data will be passed in array)
        switchArray++;           /*..Tells which array is currently processed
                                 1 - skrotyPodatnikowCzynnych
                                 2 - skrotyPodatnikowZwolnionych
                                 3 - maski - not serv
                                 ..*/

        if(data.indexOf(hash) >= 0 || switchArray > 2){   //Returns -1 for not found or all arrays have been processed
            stream.unpipe(parser);                        //End stream
            data = [];                                    //Try to empty data
            delete data.skrotyPodatnikowCzynnych;         //Try to empty data
            delete data.skrotyPodatnikowZwolnionych;      //Try to empty data
            delete data.maski;                            //Try to empty data

            switch (switchArray) {                        //Distinguish in which array has the hashed string appeared
              case 1:                                     //First array. "podatnicy czynni"
                status = 'Czynny podatnik VAT';
                break;
              case 2:                                     //Second array. "podatnicy zwolnieni"
                status = 'Zwolniony podatnik VAT';
                break;
              default:                                    //No result. Temporary.
                status = 'Brak podmiotu na liście podatników VAT';
            }

            let end = new Date() - startTime;             //Only for tests
            console.info('Execution time: %dms', end);    //Only for tests

            res.end(status);                              //Return data to client
            res.status(200).send();                       //Everything's OK
        }
        else{
          data = [];                                      //Try to empty current data if hashed string not in array
        }
      }
    }

  }));
});
