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
    var sx = canvas.width / world.width;
    var sy = canvas.height / world.height;
    var scale = Math.min(sx,sy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale, scale);
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.strokeStyle = "white";

    // draw players
    for (var uuid in world.players) {
      if (uuid == world.uuid) 
        ctx.fillStyle = "#FF0000";  // us
      else
        ctx.fillStyle = "#00FF00"; // others
      var p = world.players[uuid];
      if (p.alive) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(p.rot)*12+p.x, Math.sin(p.rot)*12+p.y);
        ctx.lineTo(Math.cos(p.rot+2.5)*12+p.x, Math.sin(p.rot+2.5)*12+p.y);
        ctx.lineTo(Math.cos(p.rot+Math.PI)*8+p.x, Math.sin(p.rot+Math.PI)*8+p.y);
        ctx.lineTo(Math.cos(p.rot-2.5)*12+p.x, Math.sin(p.rot-2.5)*12+p.y);
        ctx.fill();
      } else if (p.explodeIdx !== undefined) {
        drawImageTile(ctx, IMAGES.explode, p.x, p.y, p.explodeIdx, 8);
      }
    };
    // bullets 
    ctx.fillStyle = "black";
    world.asteroids.forEach(function(p) {
      drawAsteroid(p, 0, 0);
      if (p.x > world.width-p.rad) drawAsteroid(p, -world.width, 0);
      if (p.x < p.rad) drawAsteroid(p, world.width, 0);
      if (p.y > world.height-p.rad) drawAsteroid(p, 0,-world.height);
      if (p.y < p.rad) drawAsteroid(p, 0,world.height);
    });
    // bullets 
    ctx.fillStyle = "red";
    world.bullets.forEach(function(b) {
      ctx.fillRect(b.x-1, b.y-1, 3,3);
    });

    
    // handle incoming message
  };
  
  window.addEventListener("keydown", keyListener);
  window.addEventListener("keyup", keyListener);
});

function drawAsteroid(p,dx,dy) {
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.rot)*p.rads[0]+p.x+dx, Math.sin(p.rot)*p.rads[0]+p.y+dy);
  for (var i=1;i<=p.rads.length;i++) {
    var a = p.rot + i*Math.PI*2/p.rads.length;
    ctx.lineTo(Math.cos(a)*p.rads[i%p.rads.length]+p.x+dx, Math.sin(a)*p.rads[i%p.rads.length]+p.y+dy);
  }
  ctx.stroke();
}

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
