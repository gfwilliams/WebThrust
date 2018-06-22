var C = require("./server/const.js");


var world = require("./server/world.js");
var httpServer = require("./server/httpserver.js");
httpServer.onNewConnection = function(uuid) {
  world.players[uuid] = newPlayer(uuid);
};

Math.randomInt = function(m) {
  return (0|(Math.random()+1)*0x7FFFFFFF) % m;
};

function newPlayer(uuid) {
  do {
    var n = Math.randomInt(world.spawnPoints.length);
    var spawnPt = world.spawnPoints[n]
    var p = {
      uuid : uuid,
      x : spawnPt.x,
      y : spawnPt.y,
      rot : 0,
      velx : 0,
      vely : 0,
      health : 10,
      reloadtime : 0,
      alive : true
    };
    var inAsteroid = false;

  } while (inAsteroid);
  return p;
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

function checkBoundaries(p) {
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
      if (p.left) p.rot -= C.PLAYER.ROT_SPEED;
      if (p.right) p.rot += C.PLAYER.ROT_SPEED;
    }
    p.velx *= C.PLAYER.FRICTION;
    p.vely *= C.PLAYER.FRICTION;
    p.velx += Math.cos(p.rot)*acc;
    p.vely += Math.sin(p.rot)*acc;
    p.x += p.velx;
    p.y += p.vely;
    checkBoundaries(p);
    if (p.alive) {
      if (p.reloadtime>0) p.reloadtime--;
      if (p.reloadtime==0 && p.shoot) {
        p.reloadtime = C.PLAYER.RELOADTIME;
        world.bullets.push({
          x : p.x + Math.cos(p.rot)*C.PLAYER.GUNPOS,
          y : p.y + Math.sin(p.rot)*C.PLAYER.GUNPOS,
          velx : p.velx + Math.cos(p.rot)*C.PLAYER.BULLETSPEED,
          vely : p.vely + Math.sin(p.rot)*C.PLAYER.BULLETSPEED,
        });
      }
    }
  }

  for (var i=0;i<world.bullets.length;i++) {
    var p = world.bullets[i];
    p.x += p.velx;
    p.y += p.vely;
    checkBoundaries(p);
    var bulletHit = false;

    for (var uuid in world.players) {
      if (!world.players[uuid].alive) continue;
      if (dist(world.players[uuid],p) < C.PLAYER.COLLIDE_RAD) {
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
  httpServer.sendUpdates();
}, 1000/30);

// ============================================================ Housekeeping
// Frame counter
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
