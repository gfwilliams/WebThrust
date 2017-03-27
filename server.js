const SERVER_PORT = 8000;
var PLAYER = {
  ROT_SPEED : Math.PI*1.5/30,
  FRICTION : 0.95,
  GUNPOS : 14,
  BULLETSPEED : 2,
};
var WORLD = {
  WIDTH : 1280,
  HEIGHT : 720
};

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var server = http.createServer(function(request, response) { 
  if (request.url=="/") request.url="/client.html";
 if (["/client.html","/client.js"].indexOf(request.url)>=0) {
   response.end(require("fs").readFileSync(request.url.substr(1)));
   return;
 }
 console.log((new Date()) + ' Received request for ' + request.url);
 response.writeHead(404);
 response.end();
});
server.listen(SERVER_PORT, function() {
  console.log((new Date()) + " Server is listening on port " + SERVER_PORT);
});
var wsServer = new webSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

var connections = {};
var world = {
  width : WORLD.WIDTH,
  height : WORLD.HEIGHT,
  players : {},
  bullets : [],
  asteroids : []
};
world.asteroids.push(newAsteroid(100));
world.asteroids.push(newAsteroid(200));
world.asteroids.push(newAsteroid(50));
function newPlayer(uuid) {
  return {
    x : Math.random()*WORLD.WIDTH,
    y : Math.random()*WORLD.HEIGHT,
    rot : Math.random()*Math.PI*2,
    velx : 0,
    vely : 0,
    
    uuid : uuid
  };
}
function newAsteroid(size) {
  var rads = [];
  for (var i=0;i<size/10;i++)
    rads.push((1+Math.random()*0.1)*size);
  return {
    x : Math.random()*WORLD.WIDTH,
    y : Math.random()*WORLD.HEIGHT,
    rot : 0,
    velx : (Math.random()-0.5)*5,
    vely : (Math.random()-0.5)*5,
    velr : (Math.random()-0.5)*5 / size,
    rads : rads
  };
}
function asteroidInside(a, p) {
  var dx = p.x-a.x;
  var dy = p.y-a.y;
  var ang = Math.atan2(dy, dx) + a.rot;
  var r = Math.sqrt(dx*dx + dy*dy);
  var i = (Math.round(ang * a.rads.length)+0x1000000)%a.rads.length;
  
  return (r < a.rads[i]) ? i : undefined;
}

wsServer.on('request', function(request) {
  var uuid = 0|(Math.random()*0xFFFFFFFF)
  var connection = request.accept('game-protocol', request.origin);
  console.log((new Date()) + ' Connection accepted.');
  connections[uuid] = connection;
  world.players[uuid] = newPlayer(uuid);
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
    delete connections[uuid];
    delete world.players[uuid];
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
  });
});

function checkBoundaries(p) {
  while (p.x<0) p.x+=WORLD.WIDTH;
  while (p.y<0) p.y+=WORLD.HEIGHT;
  while (p.x>WORLD.WIDTH) p.x-=WORLD.WIDTH;
  while (p.y>WORLD.HEIGHT) p.y-=WORLD.HEIGHT;
}

function updateWorld() {
  for (var uuid in world.players) {
    var p = world.players[uuid];
    var acc = 0;
    if (p.up) acc += 1;
    if (p.down) acc -= 0.1;
    if (p.left) p.rot -= PLAYER.ROT_SPEED;
    if (p.right) p.rot += PLAYER.ROT_SPEED;
    p.velx *= PLAYER.FRICTION;
    p.vely *= PLAYER.FRICTION;
    p.velx += Math.cos(p.rot)*acc;
    p.vely += Math.sin(p.rot)*acc;
    p.x += p.velx;
    p.y += p.vely;
    checkBoundaries(p);
    if (p.shoot) {
      world.bullets.push({
        x : p.x + Math.cos(p.rot)*PLAYER.GUNPOS,
        y : p.y + Math.sin(p.rot)*PLAYER.GUNPOS, 
        velx : p.velx + Math.cos(p.rot)*PLAYER.BULLETSPEED,
        vely : p.vely + Math.sin(p.rot)*PLAYER.BULLETSPEED,
      });
    }
  }
  world.asteroids.forEach(function(p) {
    p.x += p.velx;
    p.y += p.vely;
    p.rot += p.velr;
    checkBoundaries(p);
    for (var i=0;i<p.rads.length;i++) {
      var a = p.rot + i*Math.PI*2/p.rads.length;
      var pt = {x:Math.cos(a)*p.rads[i%p.rads.length]+p.x, y:Math.sin(a)*p.rads[i%p.rads.length]+p.y};
      world.asteroids.forEach(function(a) {
        if (a==p) return;
        if (asteroidInside(a,pt) !== undefined) {
          console.log("Hit");
          var v = (Math.sqrt(p.velx*p.velx + p.vely*p.vely) + Math.sqrt(a.velx*a.velx + a.vely*a.vely))/2;
          var dx = p.x - a.x;
          var dy = p.y - a.y;
          var d = Math.sqrt(dx*dx + dy*dy);
          dx /= d;
          dy /= d;
          p.velx = dx*v;
          p.vely = dy*v;
          a.velx = -dx*v;
          a.vely = -dy*v;
        }
      });
    }
  });  
  for (var i=0;i<world.bullets.length;i++) {
    var p = world.bullets[i];
    p.x += p.velx;
    p.y += p.vely;
    checkBoundaries(p);
    var dead = false;
    world.asteroids.forEach(function(a) {
      var idx = asteroidInside(a,p);
      if (idx !== undefined) {
        a.rads[idx]-=5;
        dead = true;
      }
    });      
    if (dead) {
      world.bullets.splice(i,1);
      i--;
    }      
  }
}

frames=0;
setInterval(function() {
  frames++;

  updateWorld();
  // send updates
  for (var i in connections)
    connections[i].sendUTF(JSON.stringify(world));
}, 1000/30);

setInterval(function() {
  console.log(frames/10 + " FPS");
  frames=0;
}, 10000);


// Add a REPL - so we can interact with the code while this is running
if (require.main === module){
    (function() {
        var _context = require('repl').start({prompt: 'srv> '}).context;
        var scope = require('lexical-scope')(require('fs').readFileSync(__filename));
        for (var name in scope.locals[''] )
            _context[scope.locals[''][name]] = eval(scope.locals[''][name]);
        for (name in scope.globals.exported)
            _context[scope.globals.exported[name]] = eval(scope.globals.exported[name]);
    })();
}

// Deal with socket errors/etc
process.on('uncaughtException', function (err) {
  console.error(err.message, err.stack);
  console.log("Carrying on regardless...");
});
