var world = {
  spawnPoints : [],
  geometry : {
    static : []
  },
  players : {
  },
  bullets : [],
};

// Load level
require("../lib/svgReader.js").readSVGFile("level1.svg", function(err,svg) {
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

module.exports = world;
