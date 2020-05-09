function find(){
  let nip = $("#nip").val();   //Get value of nip input field
  let bank = $("#bank").val(); //Get value of bank account number input field
  $.ajax({
          url: '/getInfo',
          type: 'POST',
          contentType: 'plain/text',
          data: nip + ' ' + bank, //NIP and bank account
          success: function(response){
            alert(response);
            console.log(response);
          }
        });
}
