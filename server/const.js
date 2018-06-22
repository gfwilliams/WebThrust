module.exports = {
  SERVER_PORT : 8000,

  PLAYER : {
    MASS : 5,
    ANGULAR_DAMPING : 10,

    ROT_SPEED : 120,
    ACCEL : 2000,
    DEACCEL : 500,

    GUNPOS : 3.5, // distance that bullets come out from
    COLLIDE_RAD : 10, // radius for collisions
    BULLETSPEED : 100,
    RELOADTIME : 5, // frames for a reload



    HEALTH_SHOT : 10, // health hit when shot
    HEALTH_HIT : 1,  // health when hit something
  },

  BULLET : {
    MASS : 200
  }
};
