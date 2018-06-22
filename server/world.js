var world = {
  spawnPoints : [],
  geometry : {
    static : [],
    bodies : []
  },
  // Shared via websockets
  players : {
  },
  bullets : [],
  bodies : [],
  sprites : [],
  // box2d
  box2dworld : undefined, // simulated world
  box2dobjects : [], // list of objects in sim
  box2dremoval : [] // list of objects to remove
};

var C = require("./const.js");

var GEOM = {
  PLAYER : 0
};

world.load = function() {
  var svgReader = require("../lib/svgReader.js");
  // Add Player geometry
  world.geometry.bodies.push([
    {x:0,y:12},
    {x:-8,y:-7},
    {x:0,y:-5},
    {x:8,y:-7}
  ]);
  // Load level
  svgReader.readSVGFile("level1.svg", function(err,svg) {
    if (err) throw new Error(err);
    svg.forEach(function(el) {
      var handled = false;
      if (el.type=="path") {
        switch (el.style.stroke) {
          case "#000000" : // black lines -> static geometry
              handled = true;
              world.geometry.static =
                world.geometry.static.concat(el.paths);
              break;
          case "#ff0000" : // red lines -> movable geometry
              handled = true;
              if (el.paths.length!=1) console.log("Hmm. only expecting one path");
              var path = el.paths[0];
              var p = svgReader.pathGetAverage(path);
              var gidx = world.geometry.bodies.push(svgReader.pathSubtract(path, p))-1;
              world.bodies.push({
                geometry : gidx,
                x : p.x,
                y : p.y,
                r : 0
              });
              break;
        }
      }
      if (el.type=="ellipse") {
        var pos = {x:el.x, y:el.y};
        switch (el.style.fill) {
          case "#ff0000": // red circle -> spawn point
              handled = true;
              world.spawnPoints.push(pos);
              break;
          case "#0000ff": // blue circle -> fuel
              handled = true;
              break;
          case "#00ff00": // green circle -> thingy
              handled = true;
              break;
        }
      }

      if (!handled) console.log("Unknown ",el);
    });
  });
}

var Box2DObj = require("../lib/Box2D_v2.3.1_min.js").Box2D;
// https://google.github.io/liquidfun/API-Ref/html/classb2_polygon_shape.html
var Box2D;

world.initialize = function() {
  world.box2dobjects = [];
  // Set up Box2D
  Box2DObj().then(function(_Box2D) {
    Box2D = _Box2D;

    // random buffer for pushing data into via createPolygonShape
    var vertexBuf = Box2D._malloc(8*100);
    Box2D.createPolygonShape = function(vertices) {
        var shape = new Box2D.b2PolygonShape();
        var a = vertexBuf>>2;
        for (var i=0;i<vertices.length;i++) {
            Box2D.HEAPF32[a++] = vertices[i].x;
            Box2D.HEAPF32[a++] = vertices[i].y;
        }
        var ptr_wrapped = Box2D.wrapPointer(vertexBuf, Box2D.b2Vec2);
        shape.Set(ptr_wrapped, vertices.length);
        return shape;
    }

    world.box2dworld = new Box2D.b2World(new Box2D.b2Vec2(0.0, 10.0));
    world.box2dworld.SetAllowSleeping(false);
    // Listen for body contact
    var listener = new Box2D.JSContactListener();
    listener.BeginContact = function (contactPtr) {
        var contact = Box2D.wrapPointer( contactPtr, Box2D.b2Contact );
        var a = contact.GetFixtureA().GetBody();
        var b = contact.GetFixtureB().GetBody();
        world.handleContact(a,b);
    }
    listener.EndContact = function() {};
    listener.PreSolve = function() {};
    listener.PostSolve = function() {};
    world.box2dworld.SetContactListener( listener );
    // static geometry
    world.geometry.static.forEach(function(poly) {
      var bd = new Box2D.b2BodyDef();
      var body = world.box2dworld.CreateBody(bd);
      for (var i=0;i<poly.length-1;i++) {
        var shape = new Box2D.b2EdgeShape();
        shape.Set(new Box2D.b2Vec2(poly[i].x, poly[i].y), new Box2D.b2Vec2(poly[i+1].x, poly[i+1].y));
        body.CreateFixture(shape, 0.0);
      }

      console.log("Properties on Body");
      console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(body)));
    });
    // movable bodies
    world.bodies.forEach(function(b) {
      //console.log(world.geometry.bodies[b.geometry]);
      var bd = new Box2D.b2BodyDef();
      bd.set_type(Box2D.b2_dynamicBody);
      bd.set_position(new Box2D.b2Vec2(b.x, b.y));
      var body = world.box2dworld.CreateBody(bd);
      var shape = Box2D.createPolygonShape(world.geometry.bodies[b.geometry]);
      body.CreateFixture(shape, 10.0);
      world.box2dobjects.push(body);
      body.link = b;
    });
  });
};

world.addBullet = function(pos, vel, owneruuid) {
  var shape = new Box2D.b2PolygonShape();
  shape.SetAsBox(2, 2);
  var bd = new Box2D.b2BodyDef();
  bd.set_type(Box2D.b2_dynamicBody);
  bd.set_position(new Box2D.b2Vec2(pos.x, pos.y));
  bd.set_linearVelocity(new Box2D.b2Vec2(vel.x, vel.y));
  var body = world.box2dworld.CreateBody(bd);
  body.CreateFixture(shape, 200.0);
  world.box2dobjects.push(body);

  var bullet = {
    type : "bullet",
    x : pos.x,
    y : pos.y,
    r : 0,
    player : owneruuid
  };
  body.link = bullet;
  world.bullets.push(bullet);
};

world.addPlayer = function(uuid) {
  var n = Math.randomInt(world.spawnPoints.length);
  var spawnPt = world.spawnPoints[n]
  var player = {
    type : "player",
    geometry : GEOM.PLAYER,
    uuid : uuid,
    x : spawnPt.x,
    y : spawnPt.y,
    r : Math.PI,
    health : 100,
    score : 0,
    reloadtime : 0,
    alive : true
  };
  // telefrag?
  world.players[uuid] = player;

  var bd = new Box2D.b2BodyDef();
  bd.set_type(Box2D.b2_dynamicBody);
  bd.set_position(new Box2D.b2Vec2(player.x, player.y));
  bd.set_angle(player.r);
  var body = world.box2dworld.CreateBody(bd);
  var shape = Box2D.createPolygonShape(world.geometry.bodies[player.geometry]);
  body.CreateFixture(shape, 2.0);
  body.SetAngularDamping(5);
  world.box2dobjects.push(body);
  body.link = player;
};

world.step = function(seconds) {
  // Players
  for (var uuid in world.players) {
    var p = world.players[uuid];
    var body = world.box2dobjects.find(x=>x.link&&x.link==p); // nasty!
    if (p.explodeIdx!==undefined) p.explodeIdx++;
    if (p.explodeIdx>63) p.explodeIdx=undefined;
    var acc = 0, rot = 0;
    if (p.alive) {
      if (p.up) acc += C.PLAYER.ACCEL;
      if (p.down) acc -= C.PLAYER.DEACCEL;
      if (p.left) rot = -C.PLAYER.ROT_SPEED;
      if (p.right) rot = C.PLAYER.ROT_SPEED;
    }
    if (acc) body.ApplyForceToCenter(new Box2D.b2Vec2( -acc*Math.sin(p.r), acc*Math.cos(p.r)));
    if (rot) body.ApplyAngularImpulse(rot);
    if (p.alive) {
      if (p.reloadtime>0) p.reloadtime--;
      if (p.reloadtime==0 && p.shoot) {
        p.reloadtime = C.PLAYER.RELOADTIME;
        var v = body.GetLinearVelocity();
        world.addBullet({
          x : p.x - Math.sin(p.r)*C.PLAYER.GUNPOS,
          y : p.y + Math.cos(p.r)*C.PLAYER.GUNPOS},{
          x : v.get_x() - Math.sin(p.r)*C.PLAYER.BULLETSPEED,
          y : v.get_y() + Math.cos(p.r)*C.PLAYER.BULLETSPEED,
        }, uuid);
      }
    }
  }
  // Sprites
  for (var i=0;i<world.sprites.length;i++) {
    var sprite = world.sprites[i];
    var max = 63;
    sprite.frame++;
    // remove old sprites
    if (sprite.frame>max) {
      world.sprites.splice(i,1);
      i--;
    }
  }
  // Box2D - step
  world.box2dworld.Step(seconds, 3, 3);
  // Box2D - remove dead objects
  world.box2dremoval.forEach(function(body) {
    world.box2dworld.DestroyBody(body);
  });
  world.box2dremoval = [];
  // update object state
  world.box2dobjects.forEach(function(obj, idx) {
    var p = {x:obj.GetPosition().get_x(), y:obj.GetPosition().get_y()};
    var r = obj.GetAngle();
    var link = obj.link;
    if (link) {
      link.x = p.x;
      link.y = p.y;
      link.r = r;
    }
  });
};

// A Bullet hit something
world.handleBulletContact = function(bullet, obj) {
  if (obj.link && obj.link.type=="player") {
    world.players[bullet.link.player].score++;
    obj.link.health -= C.PLAYER.HEALTH_SHOT;
  }

  if (world.box2dremoval.indexOf(bullet)==-1) {
    world.box2dremoval.push(bullet);
    world.bullets.splice(world.bullets.indexOf(bullet.link), 1);
    world.sprites.push({
      x:bullet.GetPosition().get_x(),
      y:bullet.GetPosition().get_y(),
      type:"explode",
      frame:0
    });
  }
};

// A Player hit something
world.handlePlayerContact = function(player, obj) {
  player.link.health -= C.PLAYER.HEALTH_HIT;
};


world.handleContact = function(a,b) {
  if (a.link && a.link.type=="bullet") world.handleBulletContact(a, b);
  if (b.link && b.link.type=="bullet") world.handleBulletContact(b, a);
  if (a.link && a.link.type=="player") world.handlePlayerContact(a, b);
  if (b.link && b.link.type=="player") world.handlePlayerContact(b, a);  
};

module.exports = world;
