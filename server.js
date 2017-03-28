const SERVER_PORT = 8000;
var PLAYER = {
  ROT_SPEED : Math.PI*1.5/30,
  FRICTION : 0.95,
  GUNPOS : 14, // distance that bullets come out from
  COLLIDE_RAD : 10, // radius for collisions
  BULLETSPEED : 4,
  RELOADTIME : 5, // frames for a reload
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
 if (["/client.html","/client.js","/explode.png"].indexOf(request.url)>=0) {
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
  do {
    var p = {
      uuid : uuid,
      x : Math.random()*WORLD.WIDTH,
      y : Math.random()*WORLD.HEIGHT,
      rot : Math.random()*Math.PI*2,
      velx : 0,
      vely : 0,
      health : 10,
      reloadtime : 0,
      alive : true
    };
    var inAsteroid = false;
    world.asteroids.forEach(function(a) {
      if (dist(a,p) < a.rad+20) {
        inAsteroid = true;
      }
    });
  } while (inAsteroid);
  return p;
}
function newAsteroid(size) {
  var rads = [];
  for (var i=0;i<size/4;i++)
    rads.push((0.95+Math.random()*0.15)*size);
    
  do {  
    var p = {
      x : Math.random()*WORLD.WIDTH,
      y : Math.random()*WORLD.HEIGHT,
      rot : 0,
      velx : (Math.random()-0.5)*5,
      vely : (Math.random()-0.5)*5,
      velr : (Math.random()-0.5)*5 / size,
      rad : size,
      rads : rads,
      health : size/10,
    };
    var inAsteroid = false;
    world.asteroids.forEach(function(a) {
      if (dist(a,p) < a.rad+20) {
        inAsteroid = true;
      }
    });
  } while (inAsteroid);
  return p;
}
function splitAsteroid(ast, bullet) {
  // split angle
  var dx = ast.y - bullet.y;
  var dy = bullet.x - ast.x;
  var d = Math.sqrt(dx*dx + dy*dy);  
  var vel = 2;
  // New asteroids
  var newSize = ast.rad/2;  
  var ast1 = newAsteroid(newSize);
  var ast2 = newAsteroid(newSize);
  // set pos and velocity
  ast1.x = ast.x + dx*newSize/d;
  ast1.y = ast.y + dy*newSize/d;
  ast2.x = ast.x - dx*newSize/d;
  ast2.y = ast.y - dy*newSize/d;
  ast1.velx = ast.velx + dx*vel/d;
  ast1.vely = ast.vely + dy*vel/d;
  ast2.velx = ast.velx - dx*vel/d;
  ast2.vely = ast.vely - dy*vel/d;
  // add new asteroid, replace current
  world.asteroids.push(ast1);
  world.asteroids.push(ast2);
}

function killPlayer(uuid) {
  world.players[uuid].alive = false;
  world.players[uuid].explodeIdx = 0;
  setTimeout(function() {
    world.players[uuid] = newPlayer(uuid);
  }, 2000);
}

function dist(a,b) {
  var dx = b.x-a.x;
  var dy = b.y-a.y;
  return Math.sqrt(dx*dx + dy*dy);
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
    if (p.explodeIdx!==undefined) p.explodeIdx++;
    if (p.explodeIdx>63) p.explodeIdx=undefined;
    var acc = 0;
    if (p.alive) {      
      if (p.up) acc += 1;
      if (p.down) acc -= 0.1;
      if (p.left) p.rot -= PLAYER.ROT_SPEED;
      if (p.right) p.rot += PLAYER.ROT_SPEED;
    }
    p.velx *= PLAYER.FRICTION;
    p.vely *= PLAYER.FRICTION;
    p.velx += Math.cos(p.rot)*acc;
    p.vely += Math.sin(p.rot)*acc;
    p.x += p.velx;
    p.y += p.vely;
    checkBoundaries(p);
    if (p.alive) {      
      if (p.reloadtime>0) p.reloadtime--;
      if (p.reloadtime==0 && p.shoot) {
        p.reloadtime = PLAYER.RELOADTIME;
        world.bullets.push({
          x : p.x + Math.cos(p.rot)*PLAYER.GUNPOS,
          y : p.y + Math.sin(p.rot)*PLAYER.GUNPOS, 
          velx : p.velx + Math.cos(p.rot)*PLAYER.BULLETSPEED,
          vely : p.vely + Math.sin(p.rot)*PLAYER.BULLETSPEED,
        });
      }
    }    
  }
  world.asteroids.forEach(function(p) {
    p.x += p.velx;
    p.y += p.vely;
    p.rot += p.velr;
    checkBoundaries(p);
    world.asteroids.forEach(function(a) {
      if (a==p) return;
      if (dist(a,p) < a.rad+p.rad) {
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
    for (var uuid in world.players) {
      if (!world.players[uuid].alive) continue;
      if (dist(world.players[uuid],p) < p.rad + PLAYER.COLLIDE_RAD) {
        killPlayer(uuid);
      }
    }    
  });  
  for (var i=0;i<world.bullets.length;i++) {
    var p = world.bullets[i];
    p.x += p.velx;
    p.y += p.vely;
    checkBoundaries(p);
    var bulletHit = false;
    for (var ai=0;ai<world.asteroids.length;ai++) {
      var a = world.asteroids[ai];
      if (dist(a,p) < a.rad) {
        bulletHit = true;
        // now hurt asteroid
        a.health--;
        if (a.health <= 0) {
          if (a.rad > 24)
            splitAsteroid(a, p);
          // remove asteroid
          world.asteroids.splice(ai,1);
          ai--;
        }        
      }
    }
    for (var uuid in world.players) {
      if (!world.players[uuid].alive) continue;
      if (dist(world.players[uuid],p) < PLAYER.COLLIDE_RAD) {
        world.players[uuid].health--;
        if (world.players[uuid].health<=0)
          killPlayer(uuid);
      }
    }
    if (bulletHit) {
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
  for (var i in connections) {
    world.uuid = i;
    connections[i].sendUTF(JSON.stringify(world));
  }
  world.uuid = undefined;
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
