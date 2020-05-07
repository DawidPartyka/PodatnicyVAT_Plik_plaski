function find(){
  let nip = $("#nip").val();
  let bank = $("#bank").val();
  $.ajax({
          url: '/getInfo',
          type: 'POST',
          contentType: 'plain/text',
          //contentType: 'application/json',
          //data: '5223071241 5223071242 5223071243', //NIPy
          data: nip + ' ' + bank, //NIPy
          //data: '5223071241',
          /*body: JSON.stringify({
            contents: {
                nips: ['5223071241 ','5223071242 ','5223071243']
              }
          }),*/
          success: function(response){
            alert(response);
            console.log(response);
          }
        });
}
