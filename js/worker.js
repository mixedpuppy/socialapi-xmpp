onconnect = function(e) {
    console.log("worker onconnect");
    var port = e.ports[0];

    port.onmessage = function(e) {
      dump("got a message");
      port.postMessage(e.data);
    }

    port.start();
console.log("navigator: ", self);
console.log("ihazstorage: ", indexedDB);
console.log("ihazstorage: ", localStorage);
}
