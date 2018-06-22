var C = require("./server/const.js");


var world = require("./server/world.js");
world.load();
world.initialize();
var httpServer = require("./server/httpserver.js");
httpServer.onNewConnection = function(uuid) {
  world.addPlayer(uuid);
};

Math.randomInt = function(m) {
  var r = (0|((Math.random()+10)*0xFFFFF));
  return r % m;
};

function killPlayer(uuid) {
  world.players[uuid].alive = false;
  world.players[uuid].explodeIdx = 0;
  setTimeout(function() {
    world.addPlayer(uuid);
  }, 2000);
}

function dist(a,b) {
  var dx = b.x-a.x;
  var dy = b.y-a.y;
  return Math.sqrt(dx*dx + dy*dy);
}


frames=0;
setInterval(function() {
  frames++;
  world.step( 1/30 ); // box2d
  httpServer.sendUpdates();
}, 1000/30);

// ============================================================ Housekeeping
// Frame counter
setInterval(function() {
  console.log(frames/10 + " FPS");
  frames=0;
}, 10000);
// Add a REPL - so we can interact with the code while this is running
/*if (require.main === module){
    (function() {
        var _context = require('repl').start({prompt: 'srv> '}).context;
        var scope = require('lexical-scope')(require('fs').readFileSync(__filename));
        for (var name in scope.locals[''] )
            _context[scope.locals[''][name]] = eval(scope.locals[''][name]);
        for (name in scope.globals.exported)
            _context[scope.globals.exported[name]] = eval(scope.globals.exported[name]);
    })();
}*/

// Deal with socket errors/etc
/*process.on('uncaughtException', function (err) {
  console.error(err.message, err.stack);
  console.log("Carrying on regardless...");
});*/
