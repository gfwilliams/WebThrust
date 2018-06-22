var world = {
  spawnPoints : [],
  geometry : {
    static : [],
    bodies : []
  },
  players : {
  },
  bullets : [],
  bodies : [],
  box2d : undefined,
  box2dobjects : []
};

world.load = function() {
  var svgReader = require("../lib/svgReader.js");
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
      if (el.type=="circle") {
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

world.initialize = function() {
  world.box2dobjects = [];
  // Set up Box2D
  Box2DObj().then(function(Box2D) {

    // random buffer for pushing data into
    var vertexBuf = Box2D._malloc(8*100);

    function createPolygonShape(vertices) {
        var shape = new Box2D.b2PolygonShape();
        console.log(vertexBuf);
        var a = vertexBuf>>2;
        for (var i=0;i<vertices.length;i++) {
            Box2D.HEAPF32[a++] = vertices[i].get_x(); // x
            Box2D.HEAPF32[a++] = vertices[i].get_y(); // y
        }
        var ptr_wrapped = Box2D.wrapPointer(vertexBuf, Box2D.b2Vec2);
        shape.Set(ptr_wrapped, vertices.length);
        return shape;
    }

    world.box2d = new Box2D.b2World(new Box2D.b2Vec2(0.0, 10.0));
    world.box2d.SetAllowSleeping(false);
    // Listen for body contact
    var listener = new Box2D.JSContactListener();
    listener.BeginContact = function (contactPtr) {
        var contact = Box2D.wrapPointer( contactPtr, Box2D.b2Contact );
        var a = contact.GetFixtureA().GetBody();
        var b = contact.GetFixtureB().GetBody();        //console.log("Touch ", a, b);
    }
    listener.EndContact = function() {};
    listener.PreSolve = function() {};
    listener.PostSolve = function() {};
    world.box2d.SetContactListener( listener );
    // static geometry
    world.geometry.static.forEach(function(poly) {
      var bd = new Box2D.b2BodyDef();
      var body = world.box2d.CreateBody(bd);
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
      var poly = world.geometry.bodies[b.geometry];
      var bd = new Box2D.b2BodyDef();
      bd.set_type(Box2D.b2_dynamicBody);
      bd.set_position(new Box2D.b2Vec2(b.x, b.y));
      var body = world.box2d.CreateBody(bd);
      var shape = createPolygonShape(poly.map(p => new Box2D.b2Vec2(p.x, p.y)));
      //var shape = new Box2D.b2PolygonShape();
      //shape.Set(poly.slice(0,-1).map(p => new Box2D.b2Vec2(p.x, p.y)), poly.length-1);
      body.CreateFixture(shape, 15.0);
      /*for (var i=0;i<poly.length-1;i++) {
        var shape = new Box2D.b2EdgeShape();
        shape.Set(new Box2D.b2Vec2(poly[i].x, poly[i].y), new Box2D.b2Vec2(poly[i+1].x, poly[i+1].y));
        body.CreateFixture(shape, 0.0);
      }*/
      world.box2dobjects.push(body);
      body.link = b;
    });
/*
    var shape = new Box2D.b2PolygonShape();
    shape.SetAsBox(10, 10);

    var x = new Box2D.b2Vec2(-7.0, 0.75);
    var y = new Box2D.b2Vec2();
    var deltaX = new Box2D.b2Vec2(20, 0);
    var deltaY = new Box2D.b2Vec2(0, 20);
    var e_count = 5;
    for (var i = 0; i < e_count; ++i) {
      y.set_x(x.get_x());
      y.set_y(x.get_y());

      for (var j = i; j < e_count; ++j) {
        var bd = new Box2D.b2BodyDef();
        bd.set_type(Box2D.b2_dynamicBody);
        bd.set_position(y);
        var body = world.box2d.CreateBody(bd);
        body.CreateFixture(shape, 15.0);
        world.box2dobjects.push(body);

        y.op_add(deltaY);
      }

      x.op_add(deltaX);
    }*/
  });
};

world.step = function(seconds) {
  world.box2d.Step(seconds, 3, 3);
  world.box2dobjects.forEach(function(obj, idx) {
    var p = {x:obj.GetPosition().get_x(), y:obj.GetPosition().get_y()};
    var r = obj.GetAngle();
    var link = obj.link;
    if (link) {
      link.x = p.x;
      link.y = p.y;
      link.r = r;
    } /*else {
      world.bullets[idx] = {
        x:p.x,y:p.y,
        velx:0,vely:0
      };
    }*/
  });
};

module.exports = world;
