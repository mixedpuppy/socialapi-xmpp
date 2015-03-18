
var nxb    = require('node-xmpp-bosh');
var server_options = {
  logging: "WARN", 
  port: 5280, 
  path: /^\/http-bind(\/+)?$/
};

var http = require("http");
var express = require('express');
var app = express();
var server, bosh_server, ws_server, proxy;


var httpProxy = require('http-proxy');
  proxy = httpProxy.createProxyServer({});
  bosh_server = nxb.start_bosh(server_options);
  ws_server   = nxb.start_websocket(bosh_server, server_options);

proxy.on('error', function (error, req, res) {
    var json;
    console.log('proxy error', error);
    if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
    }

    json = { error: 'proxy_error', reason: error.message };
    res.end(JSON.stringify(json));
});

app.all(server_options.path, function(req, res){
  proxy.web(req, res, {target: 'http://127.0.0.1:' + server_options.port});
});

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
  try {
    proxy.close();
  } catch(e) {
    console.log("closing proxy caused error "+e);
  }
};

app.set('port', (process.env.PORT || 5000))

var server = app.listen(app.get('port'), function() {
  console.log('NODE_ENV=%s http://%s:%d', app.settings.env, server.address().address, server.address().port);
});
