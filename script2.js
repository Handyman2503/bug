const input = document.getElementById("clearTextInput");
const canvas = document.getElementById("qr");

const createQR = v => {
  // https://github.com/neocotic/qrious
  return new QRious({
    element: canvas,
    value: v,
    size: 420,
    backgroundAlpha: 1,
    foreground: "black" });

};

const qr = createQR(input.value);

input.addEventListener("input", () => {
  const qr = createQR(input.value);
});


function download_image(){
  var canvas = document.getElementById("qr");
  image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
  var link = document.createElement('a');
  link.download = "QrCode.png";
  link.href = image;
  link.click();
}
