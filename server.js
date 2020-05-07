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

/*routing handler*/
app.use('/index', express.static(__dirname + '/clientFiles'));  //main page

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

/*Request from the site with NIP and bank account*/
app.post('/getInfo', function(req, res){
  //JSON plik płaski
  let jsonData = require("./20200507.json"); //Fixed file set only for tests

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
      let obj = {
        nip: '',
        bank: '',
        status: '',
        create: function(){
          let x = chunk.toString().split(' ');
          this.nip = x[0];
          this.bank = x[1];
          console.log(this.nip);
          console.log(this.bank);

          this.start();
        },
        calcSHA512: function(content, transformations){
          let x = content;
          for(let i = 0; i < transformations; i++){
            x = sha512(x);
          }
          return x;
        },
        start: function(){
          let val = parsedData.head.date + this.nip + this.bank;
          console.log(val + '\n' + val.length + '\n' + parsedData.head.key.length);
          let search = this.calcSHA512(val, parsedData.head.transformations);
          console.log(search);
          this.checkStatus(search);
        },
        checkStatus: function(shaCheck){
          if(parsedData.podCzyn.indexOf(shaCheck) >= 0)
            this.status = 'Czynny podatnik VAT';
          else if(parsedData.podZwol.indexOf(shaCheck) >= 0)
            this.status = 'Zwolniony podatnik VAT';
          else
            this.status = 'Nie widnieje na liście podatników VAT';

          res.end(this.status);
          console.log(this.status);
        }
      }

      obj.create();
  });
});
