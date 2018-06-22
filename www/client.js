var canvas, ctx, connection;
var player = {
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function loadImage(fn) {
  var img = new Image();
  img.src = fn;
  return img;
}
var IMAGES = {
  explode : loadImage("explode.png")
};
function drawImageTile(ctx, img, x,y, idx, tsize) {
  idx=0|idx;
  var s = img.width;
  var ts = s/tsize;
  var ix = idx%tsize;
  var iy = 0|(idx/tsize);
  ctx.drawImage(img,
    ix*ts,iy*ts,ts,ts,
    x - (ts/2), y - (ts/2),ts,ts);
}


window.addEventListener("load", function(event) {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  window.addEventListener('resize', resizeCanvas, false);
  resizeCanvas();



  // if user is running mozilla then use it's built-in WebSocket
  window.WebSocket = window.WebSocket || window.MozWebSocket;

  connection = ws = new WebSocket("ws://" + location.host, 'game-protocol');

  connection.onopen = function () {
      // connection is opened and ready to use
      console.log("Connection open");
  };

  connection.onerror = function (error) {
      // an error occurred when sending/receiving data
  };

  connection.onmessage = function (message) {
    // try to decode json (I assume that each message from server is json)
    try {
        var world = JSON.parse(message.data);
    } catch (e) {
        console.log('This doesn\'t look like a valid JSON: ', message.data);
        return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    /*var sx = canvas.width / world.width;
    var sy = canvas.height / world.height;
    var scale = Math.min(sx,sy);
    ctx.scale(scale, scale);*/
    var us = world.players[world.uuid];
    // Clear screen
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "white";
    // Translate so we're in the middle
    ctx.translate(canvas.width/2 - us.x, canvas.height/2 - us.y);
    // Draw static geometry
    ctx.strokeStyle = "white";
    GEOMETRY.static.forEach(function(path) {
      ctx.beginPath();
      path.forEach(xy=>ctx.lineTo(xy.x, xy.y));
      ctx.stroke();
    });
    // Draw bodies
    ctx.strokeStyle = "red";
    world.bodies.forEach(function(body) {
      ctx.save();
      ctx.translate(body.x, body.y);
      ctx.rotate(body.r);
      ctx.beginPath();
      GEOMETRY.bodies[body.geometry].forEach(xy=>ctx.lineTo(xy.x, xy.y));
      ctx.stroke();
      ctx.restore();
    });

    // draw players
    for (var uuid in world.players) {
      if (uuid == world.uuid)
        ctx.fillStyle = "#FF0000";  // us
      else
        ctx.fillStyle = "#00FF00"; // others
      var p = world.players[uuid];
      if (p.alive) {
        var s = 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(p.rot)*s+p.x, Math.sin(p.rot)*s+p.y);
        ctx.lineTo(Math.cos(p.rot+2.5)*s+p.x, Math.sin(p.rot+2.5)*s+p.y);
        ctx.lineTo(Math.cos(p.rot+Math.PI)*s/1.5+p.x, Math.sin(p.rot+Math.PI)*s/1.5+p.y);
        ctx.lineTo(Math.cos(p.rot-2.5)*s+p.x, Math.sin(p.rot-2.5)*s+p.y);
        ctx.fill();
      } else if (p.explodeIdx !== undefined) {
        drawImageTile(ctx, IMAGES.explode, p.x, p.y, p.explodeIdx, 8);
      }
    };
    // actual parts of the world
    /*ctx.fillStyle = "black";
    world.asteroids.forEach(function(p) {
      drawAsteroid(p, 0, 0);
      if (p.x > world.width-p.rad) drawAsteroid(p, -world.width, 0);
      if (p.x < p.rad) drawAsteroid(p, world.width, 0);
      if (p.y > world.height-p.rad) drawAsteroid(p, 0,-world.height);
      if (p.y < p.rad) drawAsteroid(p, 0,world.height);
    });*/
    // bullets
    ctx.fillStyle = "red";
    world.bullets.forEach(function(b) {
      ctx.fillRect(b.x-1, b.y-1, 3,3);
    });


    // handle incoming message
  };

  window.addEventListener("keydown", keyListener);
  window.addEventListener("keyup", keyListener);
  window.addEventListener("touchstart", touchListener);
  window.addEventListener("touchend", touchListener);
  window.addEventListener("touchmove", touchListener);
});

function sendPlayerUpdate() {
  connection.send(JSON.stringify(player));
}

function keyListener(event) {
  if (event.defaultPrevented) {
    return;
  }
  var down = event.type=="keydown";
  switch (event.key) {
    case "ArrowDown":
      player.down = down;
      break;
    case "ArrowUp":
      player.up = down;
      break;
    case "ArrowLeft":
      player.left = down;
      break;
    case "ArrowRight":
      player.right = down;
      break;
    case " ":
      player.shoot = down;
      break;
    default:
      return; // Quit when this doesn't handle the key event.
  }
  sendPlayerUpdate();

  // Cancel the default action to avoid it being handled twice
  event.preventDefault();
}

var oldBtn = 0;
function touchListener(e) {
  e.preventDefault();
  var touches = e.changedTouches;
  var w = window.innerWidth;
  var h = window.innerHeight;
  var btn = 0;
  for (var i = 0; i < touches.length; i++) {
    var t = touches[i];
    if (t.pageY > h*3/4) {
      if (t.pageX < w/3) btn|=8;
      else if (t.pageX < w*2/3) btn|=16;
      else btn |= 32;
    } else if (t.pageY > h*2/4) {
      if (t.pageX < w/3) btn|=1;
      else if (t.pageX < w*2/3) btn|=2;
      else btn |= 4;
    }
  }
  if (btn!=oldBtn) {
    player.up = !!(btn&2);
    player.left = !!(btn&8);
    player.right = !!(btn&32);
    player.shoot = !!(btn&16);
    sendPlayerUpdate();
  }
  oldBtn = btn;
}
