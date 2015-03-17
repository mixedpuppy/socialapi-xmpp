
var nxb    = require('node-xmpp-bosh');
var server_options = {
  logging: "WARN", 
  port: 5280, 
  path: /^\/http-bind(\/+)?$/
};
//var bosh_server = nxb.start();
var bosh_server = nxb.start_bosh(server_options);
var ws_server   = nxb.start_websocket(bosh_server, server_options);

var http = require("http");
var express = require('express');
var app = express();
var server;

app.use(express.static(__dirname));

app.start = function(serverPort, callback) {
  server = http.createServer(this);
  server.listen(serverPort);
  if (callback)
    callback();
};

app.shutdown = function(callback) {
  server.close(callback);
  bosh_server.stop();
  ws_server.stop();
};

var server = app.listen(Number(process.env.PORT || 8100), function() {
  console.log('NODE_ENV=%s http://%s:%d', app.settings.env, server.address().address, server.address().port);
});
