// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var world = require('./world.js');
var C = require("./const.js");

var httpServer = {
  connections : {},
}

// Standard HTTP
httpServer.httpServer = http.createServer(function(request, response) {
  if (request.url=="/") request.url="/client.html";
  if (["/client.html","/client.js","/explode.png"].indexOf(request.url)>=0) {
    response.end(require("fs").readFileSync("www"+request.url));
    return;
  }
  if (["/geometry.js"].indexOf(request.url)>=0) {
    response.end("var GEOMETRY = "+JSON.stringify(world.geometry,null,2)+"\n;");
    return;
  }
  console.log((new Date()) + ' Received request for ' + request.url);
  response.writeHead(404);
  response.end();
}).listen(C.SERVER_PORT, function() {
  console.log((new Date()) + " Server is listening on port " + C.SERVER_PORT);
});
// WEBSOCKETS
httpServer.webSocketServer = new webSocketServer({
  httpServer: httpServer.httpServer,
  autoAcceptConnections: false
});

// =============================================== NEW PLAYER
httpServer.webSocketServer.on('request', function(request) {
  var uuid = 0|((Math.random()+1)*0x7FFFFFFF)
  var connection = request.accept('game-protocol', request.origin);
  console.log((new Date()) + ' Connection accepted,' + uuid);
  httpServer.connections[uuid] = connection;
  httpServer.onNewConnection(uuid);
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log('Received Message: ' + message.utf8Data);
      try {
        var j = JSON.parse(message.utf8Data);
        for (var i in j)
          world.players[uuid][i] = j[i];
      } catch (e) {
        console.warn(e.toString());
      }
    }
  });
  connection.on('close', function(reasonCode, description) {
    delete httpServer.connections[uuid];
    delete world.players[uuid];
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
  });
});

httpServer.sendUpdates = function() {
  var w = {
    players : world.players,
    bullets : world.bullets,
    bodies : world.bodies,
    sprites : world.sprites
  };
  //console.log(w);
  for (var i in httpServer.connections) {
    w.uuid = i;
    httpServer.connections[i].sendUTF(JSON.stringify(w));
  }
  world.uuid = undefined;
};

module.exports = httpServer;
