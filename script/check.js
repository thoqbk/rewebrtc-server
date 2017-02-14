/**
 * rewebrtc-server project
 *
 * Tho Q Luong <thoqbk@gmail.com>
 * Feb 14, 2017 <3 Do Hien
 */

//Redirect to https:
if(window.location.host.indexOf("herokuapp") >=0 && window.location.protocol == "http") {
  window.location.href = "https://rewebrtc.herokuapp.com/";
}

//Chrome
const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
if(!isChrome) {
  alert("Please open this page in Chrome Browser!");
}
