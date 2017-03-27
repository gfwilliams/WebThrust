var canvas, ctx, connection;
var player = {
};


window.addEventListener("load", function(event) {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  ctx.fillStyle = "green";
  ctx.fillRect(10, 10, 100, 100);

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

          canvas.width = world.width;
          canvas.height = world.height;
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 1000, 1000);

          // draw players
          ctx.fillStyle = "green";
          for (var uuid in world.players) {
            var p = world.players[uuid];
            ctx.beginPath();
            ctx.moveTo(Math.cos(p.rot)*12+p.x, Math.sin(p.rot)*12+p.y);
            ctx.lineTo(Math.cos(p.rot+2.5)*12+p.x, Math.sin(p.rot+2.5)*12+p.y);
            ctx.lineTo(Math.cos(p.rot+Math.PI)*8+p.x, Math.sin(p.rot+Math.PI)*8+p.y);
            ctx.lineTo(Math.cos(p.rot-2.5)*12+p.x, Math.sin(p.rot-2.5)*12+p.y);
            ctx.fill();
          };
          // bullets 
          ctx.fillStyle = "black";
          world.asteroids.forEach(function(p) {
            drawAsteroid(p, 0, 0);
            drawAsteroid(p, -world.width, -world.height);
            drawAsteroid(p, world.width, -world.height);
            drawAsteroid(p, -world.width, world.height);
            drawAsteroid(p, world.width, world.height);
          });
          // bullets 
          ctx.fillStyle = "red";
          world.bullets.forEach(function(b) {
            ctx.fillRect(b.x-1, b.y-1, 3,3);
          });

      } catch (e) {
          console.log('This doesn\'t look like a valid JSON: ', message.data);
          return;
      }
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
