function transformPt(transforms,pt) {
  transforms.split(";").forEach(t=>{
    t=t.trim();
    if (!t.length) return;
    var m = t.match(/^(.*)\((.*)\)/);
    var cmd = m[1];
    var args = m[2];
    args = args!==undefined?args.split(","):[];
    if (cmd=="translate") {
      pt.x += parseFloat(args[0]);
      pt.y += parseFloat(args[1]);
    } else
      console.log("Unknown transform",JSON.stringify(t));
  });
  return pt;
}

// transform a scalar
function transformV(transforms,v) {
  var a = transformPt(transforms,{x:0,y:0});
  var b = transformPt(transforms,{x:v,y:v});
  var dx = a.x-b.x;
  var dy = a.y-b.y;
  return Math.sqrt(dx*dx + dy*dy) / Math.sqrt(2);
}

function parseStyle(s) {
  var o = {};
  s.split(";").forEach(x=>{var n=x.split(":");o[n[0]]=n[1];});
  return o;
}

function recurse(svg, transforms, elements) {
  //console.log(svg);
  if (svg.$ && svg.$.transform)
    transforms += ";"+svg.$.transform;
  if (svg.g) svg.g.forEach(s=>recurse(s, transforms, elements));
  if (svg.circle) svg.circle.forEach(s=>{
    var p = transformPt(transforms, {x:parseFloat(s.$.cx), y:parseFloat(s.$.cy)});
    elements.push({
      type:"ellipse",
      id:s.$.id,
      rx: transformV(transforms, parseFloat(s.$.r)),
      ry: transformV(transforms, parseFloat(s.$.r)),
      x: p.x,
      y: p.y,
      style: parseStyle(s.$.style)
    });
  });
  if (svg.ellipse) svg.ellipse.forEach(s=>{
    var p = transformPt(transforms, {x:parseFloat(s.$.cx), y:parseFloat(s.$.cy)});
    elements.push({
      type:"ellipse",
      id:s.$.id,
      rx: transformV(transforms, parseFloat(s.$.rx)),
      ry: transformV(transforms, parseFloat(s.$.ry)),
      x: p.x,
      y: p.y,
      style: parseStyle(s.$.style)
    });
  });
  if (svg.path) svg.path.forEach(s=>{
    var p = transformPt(transforms, {x:parseFloat(s.$.cx), y:parseFloat(s.$.cy)});
    var pts = [];
    var path = [];
    var lastPt = {x:0,y:0};
    var d = s.$.d||"";
    var lastAbsolute = true;
    while (d.length) {
      var m = d.match(/([lLmM])? *(-?[0-9\.]+)[, ](-?[0-9\.]+) */);
      //console.log(m);
      if (m) {
        d = d.substr(m[0].length);
        var pt = {x:parseFloat(m[2]), y:parseFloat(m[3])};
        var c = m[1];
        //console.log(m[0], m[2],m[3]);
        if (c===undefined) c= lastAbsolute ? "L" : "l";
        if (c=="m" || c=="l") {
          pt.x += lastPt.x;
          pt.y += lastPt.y;
          lastAbsolute = false;
        } else {
          lastAbsolute = true;
        }
        if (c=="M" || c=="m") {
          if (path.length) pts.push(path);
          path = [transformPt(transforms, pt)];
        } else if (c=="L" || c=="l") {
          path.push(transformPt(transforms, pt));
        } else throw "assert!"+JSON.stringify(c);
        lastPt = pt;
      } else {
        console.log("unknown path in SVG: "+JSON.stringify(d),"Beziers?");
        process.exit(1);
        break;
      }
    }
    console.log(path);
    if (path.length) pts.push(path);
    elements.push({
      type:"path",
      id:s.$.id,
      paths:pts,
      style: parseStyle(s.$.style)
    });
  });
  //for (var svgEl in svg) console.log(svgEl);
}

exports.readSVGFile = function(filename, callback) {
  return exports.readSVGString(require("fs").readFileSync(filename).toString(), callback);
};

exports.readSVGString = function(svgString, callback) {
  require('xml2js').parseString(svgString, {trim: true}, function(err, svg) {
    if (err) return callback(err);
    var elements = [];
    recurse(svg.svg, "", elements);
    callback(null, elements);
  });
};

exports.pathGetAverage = function(path) {
  var x=0,y=0;
  path.forEach(function(p) {
    x+=p.x;
    y+=p.y;
  });
  var l = path.length;
  return {
    x : x/l,
    y : y/l
  }
};

// subtract 'p' from every point
exports.pathSubtract = function(path, v) {
  path.forEach(function(p) {
    p.x-=v.x;
    p.y-=v.y;
  });
  return path;
};

//exports.readSVGFile("level1.svg", (x,y)=>console.log(JSON.stringify(y,null,2)));
