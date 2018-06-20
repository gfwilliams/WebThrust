exports = {};

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
  console.log(v,a,b);
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
      type:"circle",
      id:s.$.id,
      r: transformV(transforms, parseFloat(s.$.r)),
      x: p.x,
      y: p.y,
      style: parseStyle(s.$.style)
    });
  });
  if (svg.path) svg.path.forEach(s=>{
    var p = transformPt(transforms, {x:parseFloat(s.$.cx), y:parseFloat(s.$.cy)});
    var pts = [];
    var path = [];
    var d = s.$.d||"";
    while (d.length) {
      var m = d.match(/([LM]) *(-?[0-9\.]+) +(-?[0-9\.]+) */);
      if (m) {
        d = d.substr(m[0].length);
        //console.log(m[0], m[2],m[3]);
        if (m[1]=="M") {
          if (path.length) pts.push(path);
          path = [transformPt(transforms, {x:parseFloat(m[2]), y:parseFloat(m[3])})];
        } else if (m[1]=="L") {
          path.push(transformPt(transforms, {x:parseFloat(m[2]), y:parseFloat(m[3])}));
        } else throw "assert!";
      } else {
        console.log("unknown path "+JSON.stringify(d));
        break;
      }
    }
    if (path.length) pts.push(path);
    elements.push({
      type:"path",
      id:s.$.id,
      pts:pts,
      style: parseStyle(s.$.style)
    });
  });
  for (var svgEl in svg) {
    console.log(svgEl);
  }
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

//exports.readSVGFile("level1.svg", (x,y)=>console.log(JSON.stringify(y,null,2)));
