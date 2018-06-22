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
function drawImageTile(ctx, img, x,y,sz, idx, tiles) {
  idx=0|idx;
  var s = img.width;
  var ts = s/tiles;
  var ix = idx%tiles;
  var iy = 0|(idx/tiles);
  ctx.drawImage(img,
    ix*ts,iy*ts,ts,ts,
    x - (ts/2)*sz, y - (ts/2)*sz,ts*sz,ts*sz);
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
    // Draw score/health
    ctx.fillStyle = "red";
    ctx.font = '48px serif';
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(us.health+'%', 10, 10);
    ctx.textAlign = "right";
    ctx.fillText("Score: "+us.score, canvas.width-10, 10);
    // Translate so we're in the middle
    var scale = 10;

    ctx.scale(scale, scale);
    ctx.translate(canvas.width/(2*scale) - us.x, canvas.height/(2*scale) - us.y);
    ctx.lineWidth = 2 / scale;

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
      var body = world.players[uuid];
      if (body.alive) {
        var s = 12;
        ctx.save();
        ctx.translate(body.x, body.y);

        if (uuid != world.uuid) {
          // health bar
          ctx.fillStyle = (body.health>60)?"#00FF00":((body.health<30)?"#FF0000":"#FFFF00");
          ctx.strokeStyle = "#00FF00";
          ctx.beginPath()
          ctx.rect(-11, 19, 22*body.health/100, 2);
          ctx.fill();
          ctx.beginPath();
          ctx.rect(-12, 18, 24, 4);
          ctx.stroke();
        }

        ctx.rotate(body.r);
        if (body.up) { // thruster
          ctx.fillStyle = "#FFFF00";
          ctx.beginPath();
          ctx.arc(0, -1.5, 0.7, 0, 2 * Math.PI, false);
          ctx.fill();
        }

        if (uuid == world.uuid) {
          ctx.fillStyle = "#FF0000";  // us
        } else {
          ctx.fillStyle = "#00FF00"; // others
        }

        ctx.beginPath();
        GEOMETRY.bodies[body.geometry].forEach(xy=>ctx.lineTo(xy.x, xy.y));
        ctx.fill();
        ctx.restore();
      } else if (p.explodeIdx !== undefined) {
        drawImageTile(ctx, IMAGES.explode, p.x, p.y, 1/scale, p.explodeIdx, 8);
      }
    };
    // Draw sprites
    world.sprites.forEach(function(sprite) {
      drawImageTile(ctx, IMAGES[sprite.type], sprite.x, sprite.y, 1/scale, sprite.frame, 8);
    });

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
      ctx.beginPath();
      ctx.arc(b.x, b.y, 0.5, 0, 2 * Math.PI, false);
      ctx.fill();
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
