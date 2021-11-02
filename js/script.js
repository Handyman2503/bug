$(document).ready(function() {
  //$("#hide").click(function() {
  //  $("#warning").hide();
  //});
  $("#dec").hide();
  $("#specs").hide();
  $("#menuEnc").click(function() {
    $("body").children().not(".menu, .footer").hide();
    $("#enc").show();
    $(".menu button").removeClass("selected");
    $("#menuEnc").addClass("selected");
  });
  $("#menuDec").click(function() {
    $("body").children().not(".menu, .footer").hide();
    $("#dec").show();
    $(".menu button").removeClass("selected");
    $("#menuDec").addClass("selected");
  });
  $("#menuSpecs").click(function() {
    $("body").children().not(".menu, .footer").hide();
    $("#specs").show();
    $(".menu button").removeClass("selected");
    $("#menuSpecs").addClass("selected");
  });
  $('#encrypt').click(function() {
    var clearTextText = $("#clearTextInput").val();
    var keyText = $("#key").val();
    if (clearTextText.length === 0 || keyText.length === 0) {
      return;
    }
    var clearText = ASCII.decode(clearTextText);
    var key = ASCII.decode(keyText);
    $("#cipherTextOutput").val(Base64.encode(AES.encrypt(clearText, key)));
  });
  $('#decrypt').click(function() {
    var cipherTextText = $("#cipherTextInput").val();
    var keyText = $("#key2").val();
    if (cipherTextText.length === 0 || keyText.length === 0) {
      return;
    }
    var cipherText = Base64.decode(cipherTextText);
    if (cipherText === false) {
      return;
    } else {
      var key = ASCII.decode(keyText);
      $("#clearTextOutput").val(ASCII.encode(AES.decrypt(cipherText, key)));
    }
  });
});

//AES
var AES = {};
AES.encrypt = function(clearText, password) {
  //Derive the key
  //Generate a random salt for the key derivation

  var PBKDF2Salt = SecureRNG.generate(32);
  //Derive the key

  var key = PBKDF2.derive(Hmac_Sha256.hash, 32, password, PBKDF2Salt, 8192, 32);
  var hmacKey = key.splice(16, 16);

  //Generate a random salt for encryption
  var AESSalt = SecureRNG.generate(8);
  //Split the key in 4 bytes long words and expand it
  var keys = AES.expandKey(Utilities.split(key, 4));
  //Split the clearText in 16 bytes long blocks
  var clearTextSplitted = Utilities.split(clearText, 16);
  var cipherTextSplitted = [];
  //Encrypt each block
  for (var i = 0; i < clearTextSplitted.length; i++) {
    cipherTextSplitted[i] = Utilities.xorBytes(clearTextSplitted[i], Utilities.join(AES.encryptBlock(Utilities.split(AESSalt.concat(Utilities.intToBytes(i, 8)), 4), keys)));
  }
  //Join all the blocks and preappend the salt and the hmac
  var cipherText = Utilities.join(cipherTextSplitted);

  var hmac = Hmac_Sha256.hash(hmacKey, cipherText);

  return PBKDF2Salt.concat(AESSalt).concat(hmac).concat(cipherText);
}
AES.decrypt = function(cipherText, password) {
  var clearTextSplitted = [];
  //Derive the key
  //Get the random salt for the key derivation
  var PBKDF2Salt = cipherText.splice(0, 32);
  //Derive the key

  var key = PBKDF2.derive(Hmac_Sha256.hash, 32, password, PBKDF2Salt, 8192, 32);
  var hmacKey = key.splice(16, 16);
  //Get the random salt for decryption
  var AESSalt = cipherText.splice(0, 8);
  //Get the hmac
  var hmac = cipherText.splice(0, 32);
  //Test the hmac

  var hmac2 = Hmac_Sha256.hash(hmacKey, cipherText);
  for (var i = 0; i < 32; i++) {
    if (hmac[i] != hmac2[i]) {
      Status.set("Wrong key or corrupted message.");
      return [];
    }
  }

  //Split the key in 4 bytes long words and expand it
  var keys = AES.expandKey(Utilities.split(key, 4));
  //Split the cipherText in 16 bytes long blocks
  var cipherTextSplitted = Utilities.split(cipherText, 16);
  //Decrypt each block
  for (var i = 0; i < cipherTextSplitted.length; i++) {
    clearTextSplitted[i] = Utilities.xorBytes(cipherTextSplitted[i], Utilities.join(AES.encryptBlock(Utilities.split(AESSalt.concat(Utilities.intToBytes(i, 8)), 4), keys)));
  }
  //Join all the blocks
  var clearText = Utilities.join(clearTextSplitted);

  return clearText;
}
AES.padding = function(input) {
  var paddingLength = 16 - (input.length % 16);
  for (var i = 0; i < paddingLength; i++) {
    input.push(paddingLength);
  }
  return input;
}
AES.removePadding = function(input) {
  //Get the length of the padding
  var paddingLength = input[input.length - 1];
  //Check for padding
  if (paddingLength > 16) {
    return input;
  }
  for (var i = input.length - 1; i >= input.length - paddingLength; i--) {
    if (input[i] != paddingLength) {
      return input;
    }
  }
  //Remove padding
  input.splice(input.length - paddingLength, paddingLength);
  return input;
}
AES.encryptBlock = function(clearText, key) {
  var state = AES.addRoundKey(clearText, key[0]);
  for (var i = 1; i < 10; i++) {
    state = AES.subBytes(state);
    state = AES.shiftRows(state);
    state = AES.mixColumns(state);
    state = AES.addRoundKey(state, key[i]);
  }
  state = AES.subBytes(state);
  state = AES.shiftRows(state);
  state = AES.addRoundKey(state, key[10]);
  return state;
}
AES.decryptBlock = function(cipherText, key) {
  cipherText = AES.addRoundKey(cipherText, key[10]);
  cipherText = AES.shiftRowsInv(cipherText);
  cipherText = AES.subBytesInv(cipherText);
  for (var i = 9; i > 0; i--) {
    cipherText = AES.addRoundKey(cipherText, key[i]);
    cipherText = AES.mixColumnsInv(cipherText);
    cipherText = AES.shiftRowsInv(cipherText);
    cipherText = AES.subBytesInv(cipherText);
  }
  cipherText = AES.addRoundKey(cipherText, key[0]);
  return cipherText;
}
AES.shiftRows = function(state) {
  var tmp;
  for (var i = 1; i < 4; i++) {
    tmp = state[i].splice(0, i);
    state[i] = state[i].concat(tmp);
  }
  return state;
}
AES.shiftRowsInv = function(state) {
  var tmp;
  for (var i = 1; i < 4; i++) {
    tmp = state[i].splice(4 - i, i);
    state[i] = tmp.concat(state[i]);
  }
  return state;
}
AES.addRoundKey = function(state, key) {
  for (var i = 0; i < 4; i++) {
    for (var i2 = 0; i2 < 4; i2++) {
      state[i][i2] = state[i][i2] ^ key[i][i2];
    }
  }
  return state;
}
AES.subTables = { 'direct': [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
], 'inverse':  [
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
]};
AES.subBytes = function(state) {
  for (var i = 0; i < 4; i++) {
    for (var i2 = 0; i2 < 4; i2++) {
      state[i][i2] = AES.subTables.direct[state[i][i2]];
    }
  }
  return state;
}
AES.subBytesInv = function(state) {
  for (var i = 0; i < 4; i++) {
    for (var i2 = 0; i2 < 4; i2++) {
      state[i][i2] = AES.subTables.inverse[state[i][i2]];
    }
  }
  return state;
}
AES.mixColumnsTables = {
  'tab2': [
    0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e, 0x10, 0x12, 0x14, 0x16, 0x18, 0x1a, 0x1c, 0x1e,
    0x20, 0x22, 0x24, 0x26, 0x28, 0x2a, 0x2c, 0x2e, 0x30, 0x32, 0x34, 0x36, 0x38, 0x3a, 0x3c, 0x3e,
    0x40, 0x42, 0x44, 0x46, 0x48, 0x4a, 0x4c, 0x4e, 0x50, 0x52, 0x54, 0x56, 0x58, 0x5a, 0x5c, 0x5e,
    0x60, 0x62, 0x64, 0x66, 0x68, 0x6a, 0x6c, 0x6e, 0x70, 0x72, 0x74, 0x76, 0x78, 0x7a, 0x7c, 0x7e,
    0x80, 0x82, 0x84, 0x86, 0x88, 0x8a, 0x8c, 0x8e, 0x90, 0x92, 0x94, 0x96, 0x98, 0x9a, 0x9c, 0x9e,
    0xa0, 0xa2, 0xa4, 0xa6, 0xa8, 0xaa, 0xac, 0xae, 0xb0, 0xb2, 0xb4, 0xb6, 0xb8, 0xba, 0xbc, 0xbe,
    0xc0, 0xc2, 0xc4, 0xc6, 0xc8, 0xca, 0xcc, 0xce, 0xd0, 0xd2, 0xd4, 0xd6, 0xd8, 0xda, 0xdc, 0xde,
    0xe0, 0xe2, 0xe4, 0xe6, 0xe8, 0xea, 0xec, 0xee, 0xf0, 0xf2, 0xf4, 0xf6, 0xf8, 0xfa, 0xfc, 0xfe,
    0x1b, 0x19, 0x1f, 0x1d, 0x13, 0x11, 0x17, 0x15, 0x0b, 0x09, 0x0f, 0x0d, 0x03, 0x01, 0x07, 0x05,
    0x3b, 0x39, 0x3f, 0x3d, 0x33, 0x31, 0x37, 0x35, 0x2b, 0x29, 0x2f, 0x2d, 0x23, 0x21, 0x27, 0x25,
    0x5b, 0x59, 0x5f, 0x5d, 0x53, 0x51, 0x57, 0x55, 0x4b, 0x49, 0x4f, 0x4d, 0x43, 0x41, 0x47, 0x45,
    0x7b, 0x79, 0x7f, 0x7d, 0x73, 0x71, 0x77, 0x75, 0x6b, 0x69, 0x6f, 0x6d, 0x63, 0x61, 0x67, 0x65,
    0x9b, 0x99, 0x9f, 0x9d, 0x93, 0x91, 0x97, 0x95, 0x8b, 0x89, 0x8f, 0x8d, 0x83, 0x81, 0x87, 0x85,
    0xbb, 0xb9, 0xbf, 0xbd, 0xb3, 0xb1, 0xb7, 0xb5, 0xab, 0xa9, 0xaf, 0xad, 0xa3, 0xa1, 0xa7, 0xa5,
    0xdb, 0xd9, 0xdf, 0xdd, 0xd3, 0xd1, 0xd7, 0xd5, 0xcb, 0xc9, 0xcf, 0xcd, 0xc3, 0xc1, 0xc7, 0xc5,
    0xfb, 0xf9, 0xff, 0xfd, 0xf3, 0xf1, 0xf7, 0xf5, 0xeb, 0xe9, 0xef, 0xed, 0xe3, 0xe1, 0xe7, 0xe5
  ],
  'tab3': [
    0x00, 0x03, 0x06, 0x05, 0x0c, 0x0f, 0x0a, 0x09, 0x18, 0x1b, 0x1e, 0x1d, 0x14, 0x17, 0x12, 0x11,
    0x30, 0x33, 0x36, 0x35, 0x3c, 0x3f, 0x3a, 0x39, 0x28, 0x2b, 0x2e, 0x2d, 0x24, 0x27, 0x22, 0x21,
    0x60, 0x63, 0x66, 0x65, 0x6c, 0x6f, 0x6a, 0x69, 0x78, 0x7b, 0x7e, 0x7d, 0x74, 0x77, 0x72, 0x71,
    0x50, 0x53, 0x56, 0x55, 0x5c, 0x5f, 0x5a, 0x59, 0x48, 0x4b, 0x4e, 0x4d, 0x44, 0x47, 0x42, 0x41,
    0xc0, 0xc3, 0xc6, 0xc5, 0xcc, 0xcf, 0xca, 0xc9, 0xd8, 0xdb, 0xde, 0xdd, 0xd4, 0xd7, 0xd2, 0xd1,
    0xf0, 0xf3, 0xf6, 0xf5, 0xfc, 0xff, 0xfa, 0xf9, 0xe8, 0xeb, 0xee, 0xed, 0xe4, 0xe7, 0xe2, 0xe1,
    0xa0, 0xa3, 0xa6, 0xa5, 0xac, 0xaf, 0xaa, 0xa9, 0xb8, 0xbb, 0xbe, 0xbd, 0xb4, 0xb7, 0xb2, 0xb1,
    0x90, 0x93, 0x96, 0x95, 0x9c, 0x9f, 0x9a, 0x99, 0x88, 0x8b, 0x8e, 0x8d, 0x84, 0x87, 0x82, 0x81,
    0x9b, 0x98, 0x9d, 0x9e, 0x97, 0x94, 0x91, 0x92, 0x83, 0x80, 0x85, 0x86, 0x8f, 0x8c, 0x89, 0x8a,
    0xab, 0xa8, 0xad, 0xae, 0xa7, 0xa4, 0xa1, 0xa2, 0xb3, 0xb0, 0xb5, 0xb6, 0xbf, 0xbc, 0xb9, 0xba,
    0xfb, 0xf8, 0xfd, 0xfe, 0xf7, 0xf4, 0xf1, 0xf2, 0xe3, 0xe0, 0xe5, 0xe6, 0xef, 0xec, 0xe9, 0xea,
    0xcb, 0xc8, 0xcd, 0xce, 0xc7, 0xc4, 0xc1, 0xc2, 0xd3, 0xd0, 0xd5, 0xd6, 0xdf, 0xdc, 0xd9, 0xda,
    0x5b, 0x58, 0x5d, 0x5e, 0x57, 0x54, 0x51, 0x52, 0x43, 0x40, 0x45, 0x46, 0x4f, 0x4c, 0x49, 0x4a,
    0x6b, 0x68, 0x6d, 0x6e, 0x67, 0x64, 0x61, 0x62, 0x73, 0x70, 0x75, 0x76, 0x7f, 0x7c, 0x79, 0x7a,
    0x3b, 0x38, 0x3d, 0x3e, 0x37, 0x34, 0x31, 0x32, 0x23, 0x20, 0x25, 0x26, 0x2f, 0x2c, 0x29, 0x2a,
    0x0b, 0x08, 0x0d, 0x0e, 0x07, 0x04, 0x01, 0x02, 0x13, 0x10, 0x15, 0x16, 0x1f, 0x1c, 0x19, 0x1a
  ],
  'tab9': [
    0x00, 0x09, 0x12, 0x1b, 0x24, 0x2d, 0x36, 0x3f, 0x48, 0x41, 0x5a, 0x53, 0x6c, 0x65, 0x7e, 0x77,
    0x90, 0x99, 0x82, 0x8b, 0xb4, 0xbd, 0xa6, 0xaf, 0xd8, 0xd1, 0xca, 0xc3, 0xfc, 0xf5, 0xee, 0xe7,
    0x3b, 0x32, 0x29, 0x20, 0x1f, 0x16, 0x0d, 0x04, 0x73, 0x7a, 0x61, 0x68, 0x57, 0x5e, 0x45, 0x4c,
    0xab, 0xa2, 0xb9, 0xb0, 0x8f, 0x86, 0x9d, 0x94, 0xe3, 0xea, 0xf1, 0xf8, 0xc7, 0xce, 0xd5, 0xdc,
    0x76, 0x7f, 0x64, 0x6d, 0x52, 0x5b, 0x40, 0x49, 0x3e, 0x37, 0x2c, 0x25, 0x1a, 0x13, 0x08, 0x01,
    0xe6, 0xef, 0xf4, 0xfd, 0xc2, 0xcb, 0xd0, 0xd9, 0xae, 0xa7, 0xbc, 0xb5, 0x8a, 0x83, 0x98, 0x91,
    0x4d, 0x44, 0x5f, 0x56, 0x69, 0x60, 0x7b, 0x72, 0x05, 0x0c, 0x17, 0x1e, 0x21, 0x28, 0x33, 0x3a,
    0xdd, 0xd4, 0xcf, 0xc6, 0xf9, 0xf0, 0xeb, 0xe2, 0x95, 0x9c, 0x87, 0x8e, 0xb1, 0xb8, 0xa3, 0xaa,
    0xec, 0xe5, 0xfe, 0xf7, 0xc8, 0xc1, 0xda, 0xd3, 0xa4, 0xad, 0xb6, 0xbf, 0x80, 0x89, 0x92, 0x9b,
    0x7c, 0x75, 0x6e, 0x67, 0x58, 0x51, 0x4a, 0x43, 0x34, 0x3d, 0x26, 0x2f, 0x10, 0x19, 0x02, 0x0b,
    0xd7, 0xde, 0xc5, 0xcc, 0xf3, 0xfa, 0xe1, 0xe8, 0x9f, 0x96, 0x8d, 0x84, 0xbb, 0xb2, 0xa9, 0xa0,
    0x47, 0x4e, 0x55, 0x5c, 0x63, 0x6a, 0x71, 0x78, 0x0f, 0x06, 0x1d, 0x14, 0x2b, 0x22, 0x39, 0x30,
    0x9a, 0x93, 0x88, 0x81, 0xbe, 0xb7, 0xac, 0xa5, 0xd2, 0xdb, 0xc0, 0xc9, 0xf6, 0xff, 0xe4, 0xed,
    0x0a, 0x03, 0x18, 0x11, 0x2e, 0x27, 0x3c, 0x35, 0x42, 0x4b, 0x50, 0x59, 0x66, 0x6f, 0x74, 0x7d,
    0xa1, 0xa8, 0xb3, 0xba, 0x85, 0x8c, 0x97, 0x9e, 0xe9, 0xe0, 0xfb, 0xf2, 0xcd, 0xc4, 0xdf, 0xd6,
    0x31, 0x38, 0x23, 0x2a, 0x15, 0x1c, 0x07, 0x0e, 0x79, 0x70, 0x6b, 0x62, 0x5d, 0x54, 0x4f, 0x46
  ],
  'tab11': [
    0x00, 0x0b, 0x16, 0x1d, 0x2c, 0x27, 0x3a, 0x31, 0x58, 0x53, 0x4e, 0x45, 0x74, 0x7f, 0x62, 0x69,
    0xb0, 0xbb, 0xa6, 0xad, 0x9c, 0x97, 0x8a, 0x81, 0xe8, 0xe3, 0xfe, 0xf5, 0xc4, 0xcf, 0xd2, 0xd9,
    0x7b, 0x70, 0x6d, 0x66, 0x57, 0x5c, 0x41, 0x4a, 0x23, 0x28, 0x35, 0x3e, 0x0f, 0x04, 0x19, 0x12,
    0xcb, 0xc0, 0xdd, 0xd6, 0xe7, 0xec, 0xf1, 0xfa, 0x93, 0x98, 0x85, 0x8e, 0xbf, 0xb4, 0xa9, 0xa2,
    0xf6, 0xfd, 0xe0, 0xeb, 0xda, 0xd1, 0xcc, 0xc7, 0xae, 0xa5, 0xb8, 0xb3, 0x82, 0x89, 0x94, 0x9f,
    0x46, 0x4d, 0x50, 0x5b, 0x6a, 0x61, 0x7c, 0x77, 0x1e, 0x15, 0x08, 0x03, 0x32, 0x39, 0x24, 0x2f,
    0x8d, 0x86, 0x9b, 0x90, 0xa1, 0xaa, 0xb7, 0xbc, 0xd5, 0xde, 0xc3, 0xc8, 0xf9, 0xf2, 0xef, 0xe4,
    0x3d, 0x36, 0x2b, 0x20, 0x11, 0x1a, 0x07, 0x0c, 0x65, 0x6e, 0x73, 0x78, 0x49, 0x42, 0x5f, 0x54,
    0xf7, 0xfc, 0xe1, 0xea, 0xdb, 0xd0, 0xcd, 0xc6, 0xaf, 0xa4, 0xb9, 0xb2, 0x83, 0x88, 0x95, 0x9e,
    0x47, 0x4c, 0x51, 0x5a, 0x6b, 0x60, 0x7d, 0x76, 0x1f, 0x14, 0x09, 0x02, 0x33, 0x38, 0x25, 0x2e,
    0x8c, 0x87, 0x9a, 0x91, 0xa0, 0xab, 0xb6, 0xbd, 0xd4, 0xdf, 0xc2, 0xc9, 0xf8, 0xf3, 0xee, 0xe5,
    0x3c, 0x37, 0x2a, 0x21, 0x10, 0x1b, 0x06, 0x0d, 0x64, 0x6f, 0x72, 0x79, 0x48, 0x43, 0x5e, 0x55,
    0x01, 0x0a, 0x17, 0x1c, 0x2d, 0x26, 0x3b, 0x30, 0x59, 0x52, 0x4f, 0x44, 0x75, 0x7e, 0x63, 0x68,
    0xb1, 0xba, 0xa7, 0xac, 0x9d, 0x96, 0x8b, 0x80, 0xe9, 0xe2, 0xff, 0xf4, 0xc5, 0xce, 0xd3, 0xd8,
    0x7a, 0x71, 0x6c, 0x67, 0x56, 0x5d, 0x40, 0x4b, 0x22, 0x29, 0x34, 0x3f, 0x0e, 0x05, 0x18, 0x13,
    0xca, 0xc1, 0xdc, 0xd7, 0xe6, 0xed, 0xf0, 0xfb, 0x92, 0x99, 0x84, 0x8f, 0xbe, 0xb5, 0xa8, 0xa3
  ],
  'tab13': [
    0x00, 0x0d, 0x1a, 0x17, 0x34, 0x39, 0x2e, 0x23, 0x68, 0x65, 0x72, 0x7f, 0x5c, 0x51, 0x46, 0x4b,
    0xd0, 0xdd, 0xca, 0xc7, 0xe4, 0xe9, 0xfe, 0xf3, 0xb8, 0xb5, 0xa2, 0xaf, 0x8c, 0x81, 0x96, 0x9b,
    0xbb, 0xb6, 0xa1, 0xac, 0x8f, 0x82, 0x95, 0x98, 0xd3, 0xde, 0xc9, 0xc4, 0xe7, 0xea, 0xfd, 0xf0,
    0x6b, 0x66, 0x71, 0x7c, 0x5f, 0x52, 0x45, 0x48, 0x03, 0x0e, 0x19, 0x14, 0x37, 0x3a, 0x2d, 0x20,
    0x6d, 0x60, 0x77, 0x7a, 0x59, 0x54, 0x43, 0x4e, 0x05, 0x08, 0x1f, 0x12, 0x31, 0x3c, 0x2b, 0x26,
    0xbd, 0xb0, 0xa7, 0xaa, 0x89, 0x84, 0x93, 0x9e, 0xd5, 0xd8, 0xcf, 0xc2, 0xe1, 0xec, 0xfb, 0xf6,
    0xd6, 0xdb, 0xcc, 0xc1, 0xe2, 0xef, 0xf8, 0xf5, 0xbe, 0xb3, 0xa4, 0xa9, 0x8a, 0x87, 0x90, 0x9d,
    0x06, 0x0b, 0x1c, 0x11, 0x32, 0x3f, 0x28, 0x25, 0x6e, 0x63, 0x74, 0x79, 0x5a, 0x57, 0x40, 0x4d,
    0xda, 0xd7, 0xc0, 0xcd, 0xee, 0xe3, 0xf4, 0xf9, 0xb2, 0xbf, 0xa8, 0xa5, 0x86, 0x8b, 0x9c, 0x91,
    0x0a, 0x07, 0x10, 0x1d, 0x3e, 0x33, 0x24, 0x29, 0x62, 0x6f, 0x78, 0x75, 0x56, 0x5b, 0x4c, 0x41,
    0x61, 0x6c, 0x7b, 0x76, 0x55, 0x58, 0x4f, 0x42, 0x09, 0x04, 0x13, 0x1e, 0x3d, 0x30, 0x27, 0x2a,
    0xb1, 0xbc, 0xab, 0xa6, 0x85, 0x88, 0x9f, 0x92, 0xd9, 0xd4, 0xc3, 0xce, 0xed, 0xe0, 0xf7, 0xfa,
    0xb7, 0xba, 0xad, 0xa0, 0x83, 0x8e, 0x99, 0x94, 0xdf, 0xd2, 0xc5, 0xc8, 0xeb, 0xe6, 0xf1, 0xfc,
    0x67, 0x6a, 0x7d, 0x70, 0x53, 0x5e, 0x49, 0x44, 0x0f, 0x02, 0x15, 0x18, 0x3b, 0x36, 0x21, 0x2c,
    0x0c, 0x01, 0x16, 0x1b, 0x38, 0x35, 0x22, 0x2f, 0x64, 0x69, 0x7e, 0x73, 0x50, 0x5d, 0x4a, 0x47,
    0xdc, 0xd1, 0xc6, 0xcb, 0xe8, 0xe5, 0xf2, 0xff, 0xb4, 0xb9, 0xae, 0xa3, 0x80, 0x8d, 0x9a, 0x97
  ],
  'tab14': [
    0x00, 0x0e, 0x1c, 0x12, 0x38, 0x36, 0x24, 0x2a, 0x70, 0x7e, 0x6c, 0x62, 0x48, 0x46, 0x54, 0x5a,
    0xe0, 0xee, 0xfc, 0xf2, 0xd8, 0xd6, 0xc4, 0xca, 0x90, 0x9e, 0x8c, 0x82, 0xa8, 0xa6, 0xb4, 0xba,
    0xdb, 0xd5, 0xc7, 0xc9, 0xe3, 0xed, 0xff, 0xf1, 0xab, 0xa5, 0xb7, 0xb9, 0x93, 0x9d, 0x8f, 0x81,
    0x3b, 0x35, 0x27, 0x29, 0x03, 0x0d, 0x1f, 0x11, 0x4b, 0x45, 0x57, 0x59, 0x73, 0x7d, 0x6f, 0x61,
    0xad, 0xa3, 0xb1, 0xbf, 0x95, 0x9b, 0x89, 0x87, 0xdd, 0xd3, 0xc1, 0xcf, 0xe5, 0xeb, 0xf9, 0xf7,
    0x4d, 0x43, 0x51, 0x5f, 0x75, 0x7b, 0x69, 0x67, 0x3d, 0x33, 0x21, 0x2f, 0x05, 0x0b, 0x19, 0x17,
    0x76, 0x78, 0x6a, 0x64, 0x4e, 0x40, 0x52, 0x5c, 0x06, 0x08, 0x1a, 0x14, 0x3e, 0x30, 0x22, 0x2c,
    0x96, 0x98, 0x8a, 0x84, 0xae, 0xa0, 0xb2, 0xbc, 0xe6, 0xe8, 0xfa, 0xf4, 0xde, 0xd0, 0xc2, 0xcc,
    0x41, 0x4f, 0x5d, 0x53, 0x79, 0x77, 0x65, 0x6b, 0x31, 0x3f, 0x2d, 0x23, 0x09, 0x07, 0x15, 0x1b,
    0xa1, 0xaf, 0xbd, 0xb3, 0x99, 0x97, 0x85, 0x8b, 0xd1, 0xdf, 0xcd, 0xc3, 0xe9, 0xe7, 0xf5, 0xfb,
    0x9a, 0x94, 0x86, 0x88, 0xa2, 0xac, 0xbe, 0xb0, 0xea, 0xe4, 0xf6, 0xf8, 0xd2, 0xdc, 0xce, 0xc0,
    0x7a, 0x74, 0x66, 0x68, 0x42, 0x4c, 0x5e, 0x50, 0x0a, 0x04, 0x16, 0x18, 0x32, 0x3c, 0x2e, 0x20,
    0xec, 0xe2, 0xf0, 0xfe, 0xd4, 0xda, 0xc8, 0xc6, 0x9c, 0x92, 0x80, 0x8e, 0xa4, 0xaa, 0xb8, 0xb6,
    0x0c, 0x02, 0x10, 0x1e, 0x34, 0x3a, 0x28, 0x26, 0x7c, 0x72, 0x60, 0x6e, 0x44, 0x4a, 0x58, 0x56,
    0x37, 0x39, 0x2b, 0x25, 0x0f, 0x01, 0x13, 0x1d, 0x47, 0x49, 0x5b, 0x55, 0x7f, 0x71, 0x63, 0x6d,
    0xd7, 0xd9, 0xcb, 0xc5, 0xef, 0xe1, 0xf3, 0xfd, 0xa7, 0xa9, 0xbb, 0xb5, 0x9f, 0x91, 0x83, 0x8d
  ]
};
AES.mixColumns = function(state) {
  var tmp = [];
  for (var i = 0; i < 4; i++) {
    tmp[0] = AES.mixColumnsTables.tab2[state[0][i]] ^ AES.mixColumnsTables.tab3[state[1][i]] ^ state[2][i] ^ state[3][i];
    tmp[1] = state[0][i] ^ AES.mixColumnsTables.tab2[state[1][i]] ^ AES.mixColumnsTables.tab3[state[2][i]] ^ state[3][i];
    tmp[2] = state[0][i] ^ state[1][i] ^ AES.mixColumnsTables.tab2[state[2][i]] ^ AES.mixColumnsTables.tab3[state[3][i]];
    tmp[3] = AES.mixColumnsTables.tab3[state[0][i]] ^ state[1][i] ^ state[2][i] ^ AES.mixColumnsTables.tab2[state[3][i]];
    for (var i2 = 0; i2 < 4; i2++) {
      state[i2][i] = tmp[i2];
    }
  }
  return state;
}
AES.mixColumnsInv = function(state) {
    var tmp = [];
    for (var i = 0; i < 4; i++) {
      tmp[0] = AES.mixColumnsTables.tab14[state[0][i]] ^ AES.mixColumnsTables.tab11[state[1][i]] ^ AES.mixColumnsTables.tab13[state[2][i]] ^ AES.mixColumnsTables.tab9[state[3][i]];
      tmp[1] = AES.mixColumnsTables.tab9[state[0][i]] ^ AES.mixColumnsTables.tab14[state[1][i]] ^ AES.mixColumnsTables.tab11[state[2][i]] ^ AES.mixColumnsTables.tab13[state[3][i]];
      tmp[2] = AES.mixColumnsTables.tab13[state[0][i]] ^ AES.mixColumnsTables.tab9[state[1][i]] ^ AES.mixColumnsTables.tab14[state[2][i]] ^ AES.mixColumnsTables.tab11[state[3][i]];
      tmp[3] = AES.mixColumnsTables.tab11[state[0][i]] ^ AES.mixColumnsTables.tab13[state[1][i]] ^ AES.mixColumnsTables.tab9[state[2][i]] ^ AES.mixColumnsTables.tab14[state[3][i]];
      for (var i2 = 0; i2 < 4; i2++) {
        state[i2][i] = tmp[i2];
      }
    }
    return state;
  }
//Key schedule
AES.expandKey = function(key) {
  var keys = [];
  keys[0] = key;
  for (var i = 0; i < 10; i++) {
    keys[i + 1] = AES.keySchedule.nextKey(keys[i], i);
  }
  return keys;
}
AES.keySchedule = {};
AES.keySchedule.Rcon = [
  [0x01, 0x00, 0x00, 0x00],
  [0x02, 0x00, 0x00, 0x00],
  [0x04, 0x00, 0x00, 0x00],
  [0x08, 0x00, 0x00, 0x00],
  [0x10, 0x00, 0x00, 0x00],
  [0x20, 0x00, 0x00, 0x00],
  [0x40, 0x00, 0x00, 0x00],
  [0x80, 0x00, 0x00, 0x00],
  [0x1b, 0x00, 0x00, 0x00],
  [0x36, 0x00, 0x00, 0x00]
];
AES.keySchedule.nextKey = function(key, round) {
  var oldLastWord = [key[0][3], key[1][3], key[2][3], key[3][3]];
  //Rotate lastWord
  oldLastWord = AES.keySchedule.rotateWord(oldLastWord);
  //Substitute lastWord
  oldLastWord = AES.keySchedule.subWord(oldLastWord);
  var newFirstWord = [];
  //Xor lastColumn with first column and Rcon
  for (var i = 0; i < 4; i++) {
    newFirstWord[i] = oldLastWord[i] ^ key[i][0] ^ AES.keySchedule.Rcon[round][i];
  }
  var nextKey = AES.keySchedule.getKey(key, newFirstWord);
  return nextKey;
}
AES.keySchedule.rotateWord = function(word) {
  var buffer = word.splice(0, 1);
  word = word.concat(buffer);
  return word;
}
AES.keySchedule.subWord = function(word) {
  for (var i = 0; i < 4; i++) {
    word[i] = AES.subTables.direct[word[i]];
  }
  return word;
}
AES.keySchedule.getKey = function(oldKey, firstWord) {
  //Set the firstWord as the first word of the newKey
  var newKey = [
    [firstWord[0]],
    [firstWord[1]],
    [firstWord[2]],
    [firstWord[3]]
  ];
  //Set all the other word of the newKey to the result of a xor operation between the previous word of the newKey and the same word in the oldKey
  for (var i = 0; i < 4; i++) {
    for (var i2 = 1; i2 < 4; i2++) {
      newKey[i][i2] = newKey[i][i2 - 1] ^ oldKey[i][i2];
    }
  }
  return newKey;
}

var PBKDF2 = {};
PBKDF2.derive = function(Hmac, HmacLength, password, salt, iterations, keyLength) {
  var key = [];
  //For each block of length HmacLength needed to complete the key of length KeyLength, generate the block and append it to the key
  for (var i = 0; i < Math.ceil(keyLength / HmacLength); i++) {
    key = key.concat(PBKDF2.iterate(Hmac, password, salt, iterations, i + 1));
  }
  //Keep only keyLength bytes of key
  return key.splice(0, keyLength);
}
PBKDF2.iterate = function(Hmac, password, salt, iterations, blockId) {
  var tmp = Hmac(password, salt.concat(Utilities.intToBytes(blockId, 4)));
  var result = tmp;
  for (var i = 1; i < iterations; i++) {
    tmp = Hmac(password, tmp);
    result = Utilities.xorBytes(result, tmp);
  }
  return result;
}

var Hmac_Sha256 = {};
Hmac_Sha256.hash = function(key, message) {
  //If the key is longer than 64 bytes, hash it
  if (key.length > 64) {
    key = Sha256.hash(key);
  }
  //If the key is shorter than 64 bytes, pad it with 0's
  if (key.length < 64) {
    while (key.length != 64) {
      key.push(0x0);
    }
  }
  //Set the pads to the value of the key, then xor each byte of the pads with 0x5c for the outer pad, 0x36 for the inner one
  var o_key_pad = key;
  var i_key_pad = key;
  for (var i = 0; i < 64; i++) {
    o_key_pad[i] ^= 0x5c;
    i_key_pad[i] ^= 0x36;
  }
  //Return the hash of the outer pad concatenated with the hash of the inner pad concatenated with the given message.
  return Sha256.hash(o_key_pad.concat(Sha256.hash(i_key_pad.concat(message))));
}

var Sha256 = {};
Sha256.K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
Sha256.hash = function(message) {
  //Reset the hash values
  Sha256.H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  //Preprocessing
  message = Sha256.preProcessing(message);
  //Split the message in 64 bytes long blocks
  message = Utilities.split(message, 64);
  //Process each block
  for (var i = 0; i < message.length; i++) {
    //Split the block in 4 bytes long words
    message[i] = Utilities.split(message[i], 4);
    //Convert the words from byte arrays to intagers
    for (var i2 = 0; i2 < message[i].length; i2++) {
      message[i][i2] = Utilities.bytesToInt(message[i][i2]);
    }
    //Extend the block's words
    message[i] = Sha256.extendBlock(message[i]);
    //Main loop
    Sha256.mainLoop(message[i]);
  }
  //Convert the words from intagers to 4 byte long byte arrays
  for (var i = 0; i < Sha256.H.length; i++) {
    Sha256.H[i] = Utilities.intToBytes(Sha256.H[i], 4);
  }
  //Join the hash values
  var hash = Utilities.join(Sha256.H);
  //empty the hash values
  Sha256.H = null;
  return hash;
}
Sha256.preProcessing = function(message) {
  //Get the original length of the message
  var messageLength = message.length;
  //Append one bit and seven 0s (byte 80 in base 16)
  message.push(0x80);
  //Append the minimum number of bytes 0 until the length of the message modulo 64 is equal 56
  while (message.length % 64 != 56) {
    message.push(0x0);
  }
  //Append the length in bits of the original message as a 8 byte long intager
  message = message.concat(Utilities.intToBytes(messageLength * 8, 8));
  return message;
}
Sha256.extendBlock = function(words) {
  for (var i = 16; i < 64; i++) {
    words[i] = (words[i - 16] + Sha256.σ0(words[i - 15]) + words[i - 7] + Sha256.σ1(words[i - 2])) & 0xffffffff;
  }
  return words;
}
Sha256.mainLoop = function(words) {
  //Initialize variables
  var a = Sha256.H[0],
    b = Sha256.H[1],
    c = Sha256.H[2],
    d = Sha256.H[3],
    e = Sha256.H[4],
    f = Sha256.H[5],
    g = Sha256.H[6],
    h = Sha256.H[7],
    tmp0, tmp1;
  //Main loop
  for (var i = 0; i < 64; i++) {
    tmp0 = h + Sha256.Σ1(e) + Sha256.Ch(e, f, g) + Sha256.K[i] + words[i];
    tmp1 = Sha256.Σ0(a) + Sha256.Maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + tmp0 & 0xffffffff;
    d = c;
    c = b;
    b = a;
    a = tmp0 + tmp1 & 0xffffffff;
  }
  //Add the result of the loop to the hash's value's array
  Sha256.H[0] = (Sha256.H[0] + a) & 0xffffffff;
  Sha256.H[1] = (Sha256.H[1] + b) & 0xffffffff;
  Sha256.H[2] = (Sha256.H[2] + c) & 0xffffffff;
  Sha256.H[3] = (Sha256.H[3] + d) & 0xffffffff;
  Sha256.H[4] = (Sha256.H[4] + e) & 0xffffffff;
  Sha256.H[5] = (Sha256.H[5] + f) & 0xffffffff;
  Sha256.H[6] = (Sha256.H[6] + g) & 0xffffffff;
  Sha256.H[7] = (Sha256.H[7] + h) & 0xffffffff;
}
Sha256.RotR = function(input, places) {
  return (input >>> places) | (input << (32 - places));
}
Sha256.Σ0 = function(x) {
  return Sha256.RotR(x, 2) ^ Sha256.RotR(x, 13) ^ Sha256.RotR(x, 22);
}
Sha256.Σ1 = function(x) {
  return Sha256.RotR(x, 6) ^ Sha256.RotR(x, 11) ^ Sha256.RotR(x, 25);
}
Sha256.σ0 = function(x) {
  return Sha256.RotR(x, 7) ^ Sha256.RotR(x, 18) ^ (x >>> 3);
}
Sha256.σ1 = function(x) {
  return Sha256.RotR(x, 17) ^ Sha256.RotR(x, 19) ^ (x >>> 10);
}
Sha256.Ch = function(x, y, z) {
  return (x & y) ^ (~x & z);
}
Sha256.Maj = function(x, y, z) {
  return (x & y) ^ (x & z) ^ (y & z);
}

var SecureRNG = {};
SecureRNG.generate = function(size) {
  //Test for support
  if (window.crypto.getRandomValues.toString() !== "function getRandomValues() { [native code] }") {
    Status.set("getRandomValues function not supported!");
    return undefined;
  }
  //Get the random values
  var tmp1 = new Uint8Array(size);
  window.crypto.getRandomValues(tmp1);
  //Convert the random values from Uint8Array to array
  var tmp2 = new Array(size);
  for (var i = 0; i < size; i++) {
    tmp2[i] = tmp1[i];
  }
  return tmp2;
}

//ASCII Encoding and Decoding
var ASCII = {};
//Encodes byte array to ASCII string
ASCII.encode = function(bytes) {
    var str = "";
    for (var i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }
  //Decodes ASCII string to byte array
ASCII.decode = function(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}

//Hex Encoding and Decoding
var Hex = {};
//Character map
Hex.map = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
//Encodes byte array to hex string
Hex.encode = function(bytes) {
    var str = "";
    for (var i = 0; i < bytes.length; i++) {
      str += Hex.map[bytes[i] >> 4] + Hex.map[bytes[i] % 16];
    }
    return str;
  }
  //Decodes hex string to byte array
Hex.decode = function(str) {
  var bytes = [], tmp1, tmp2;
  for (var i = 0; i < Math.floor(str.length / 2); i++) {
    tmp1 = (Hex.map.indexOf(str[i * 2]) << 4);
    tmp2 = Hex.map.indexOf(str[i * 2 + 1]);
    if (tmp1 == -1 || tmp2 == -1) {
      Status.set("Invalid hex encoded string.");
      return false;
    }
    bytes.push(tmp1 + tmp2);
  }
  return bytes;
}

//Base 64 Encoding and Decoding
var Base64 = {};
//Encoding
Base64.encode = function(bytes) {
    return btoa(ASCII.encode(bytes));
  }
//Decoding
Base64.decode = function(str) {
  var bytes = undefined;
  try {
    bytes = ASCII.decode(atob(str));
  } catch (e) {
    Status.set("Invalid base 64 encoded string.");
  }
  return bytes;
}

var Utilities = {};
Utilities.split = function(input, size) {
  var output = [];
  while (input.length > 0) {
    output.push(input.splice(0, size));
  }
  return output;
}
Utilities.join = function(input) {
  var output = [];
  for (var i = 0; i < input.length; i++) {
    output = output.concat(input[i]);
  }
  return output;
}
Utilities.intToBytes = function(int, size) {
  var bytes = [];
  for (var i = size - 1; i >= 0; i--) {
    bytes[i] = int & 0xFF;
    int = int >> 8;
  }
  return bytes;
}
Utilities.bytesToInt = function(bytes) {
  var int = 0;
  for (var i = 0; i < bytes.length; i++) {
    int = int << 8;
    int += bytes[i];
  }
  return int;
}
Utilities.xorBytes = function(a, b) {
  for (var i = 0; i < a.length; i++) {
    a[i] ^= b[i];
  }
  return a;
}

//Status
var Status = {};
Status.set = function(Status) {
  $('#status').text(Status);
}
Status.clear = function() {
  $('#status').text('');
}
