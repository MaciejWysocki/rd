;
(function() {
    var Game = function() {
        this.gameSize = { x: document.body.offsetWidth - 150 }; // Doesn't work when resizing window. Should be static?
        this.bodies = [];
        this.bodies = this.bodies.concat(new Player(this, 37, 39, 38, 'rudydres'));
        this.bodies = this.bodies.concat(new Player(this, 65, 68, 87, 'lysyblokers'));
        this.bodies = this.bodies.concat(new Player(this, 74, 76, 73, 'nerbisDres'));
        console.log("this.bodies: " + this.bodies);
        var self = this;
        var tick = function() {
            self.update();
            self.draw(screen, self.gameSize);
            requestAnimationFrame(tick);
        };
        tick();
    };

    Game.prototype = {
        update: function() {
            var self = this;
            for (var i = 0; i < this.bodies.length; i++) {
                for (var j = 0; j < this.bodies.length; j++) {
                    if (this.bodies[i] != this.bodies[j]) {

                        var dres1 = this.bodies[i].center.x;
                        var dres2 = this.bodies[j].center.x;

                        if (dres1 > dres2 - 50 && dres1 < dres2 + 50) {
                            if (dres1 > dres2) {
                                this.bodies[i].center.x += 3;
                            }
                            if (dres1 < dres2) {
                                this.bodies[i].center.x -= 3;
                            }
                        }
                    }
                }
                this.bodies[i].update();
            }
        },

        draw: function(screen, gameSize) {
            for (var i = 0; i < this.bodies.length; i++) {
                var rudydres = document.getElementById(this.bodies[i].id);
                var rudydresimage = document.getElementById(this.bodies[i].id + 'image');
                rudydres.style.left = this.bodies[i].center.x + 'px';
                rudydres.style.top = 570 - this.bodies[i].jump + 'px';

                rudydres.style.transform = 'scaleX(' + this.bodies[i].scaleX + ')';
                rudydresimage.style.marginLeft = -((Math.floor(this.bodies[i].anim / 5) % 8) * 150) + 'px';
            }
        }
    };

    var Player = function(game, leftKey, rightKey, upKey, id) {
        this.id = id;
        this.anim = 0;
        this.game = game;
        this.scaleX = 1;
        this.jump = 0;
        this.jumpstart = 0;
        this.center = { x: Math.floor((Math.random() * (this.game.gameSize.x)) + 20) };
        this.keyboarder = new Keyboarder(leftKey, rightKey, upKey);
    };
    Player.prototype = {
        update: function() {
            // If left cursor key is down...
            if (this.keyboarder.isLeftKeyDown() && this.center.x > 0) {
                this.center.x -= 3;
                this.anim++;
                this.scaleX = -1;
            } else if (this.keyboarder.isRightKeyDown() && this.center.x < this.game.gameSize.x) {
                this.center.x += 3;
                this.anim++;
                this.scaleX = 1;
            }
            if (this.keyboarder.isUpKeyDown()) {
                if (this.jump == 0) {
                    this.jump = 1;
                    this.jumpstart = new Date().getTime();
                    sound = document.getElementById(this.id + "sound");
                    if (sound) {
                        sound.load();
                        sound.play();
                    }
                }
            }
            if (this.jump < 0) {
                this.jump = 0;
            } else if (this.jump > 0) {
                var x = new Date().getTime() - this.jumpstart;
                if (x > 0) {
                    this.jump = x * x / -625 + 4 * x / 5;
                }
            }
        }
    };

    var Keyboarder = function(leftKey, rightKey, upKey) {
        this.leftKey = leftKey;
        this.rightKey = rightKey;
        this.upKey = upKey;
        var keyState = {};
        window.addEventListener('keydown', function(e) { keyState[e.keyCode] = true; });
        window.addEventListener('keyup', function(e) { keyState[e.keyCode] = false; });
        this.isLeftKeyDown = function() {
            return keyState[this.leftKey] === true;
        };
        this.isRightKeyDown = function() {
            return keyState[this.rightKey] === true;
        };
        this.isUpKeyDown = function() {
            return keyState[this.upKey] === true;
        };
    };

    window.addEventListener('load', function() { new Game(); });
})();