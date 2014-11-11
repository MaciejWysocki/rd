(function() {
    var Game = function() {
        this.size = { x: 1600, y: 700 };
        this.bodies = [];
        this.bodies = this.bodies.concat(new Player(this, 37, 39, 38, 16, 'rudydres'));
        this.bodies = this.bodies.concat(new Enemy(this, 'lysyblokers'));
        this.bodies = this.bodies.concat(new Player(this, 74, 76, 73, 89, 'nerbisDres'));
	    this.punchIter = 0;
        var self = this;
        var tick = function() {
            self.update();
            self.draw();
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

        draw: function() {
            document.getElementById('game').style.top = Math.max(0, (document.body.clientHeight - this.size.y) / 2);
            document.getElementById('game').style.left = Math.max(0, (document.body.clientWidth - this.size.x) / 2);
            clientWidth = document.body.clientWidth;
            if(clientWidth < this.size.x) {
                window.scrollTo(Math.min(this.bodies[0].center.x + 75 - clientWidth / 2, this.size.x - clientWidth), this.size.x);
            }
            for (var i = 0; i < this.bodies.length; i++) {
                this.bodies[i].draw();
            }
        }
    };
    
    var Player = function(game, leftKey, rightKey, upKey, punchKey, id) {
        this.id = id;
        this.anim = 0;
        this.animType = "walk";
        this.game = game;
        this.scaleX = 1;
        this.jump = 0;
        this.jumpstart = 0;
        this.center = { x: Math.floor((Math.random() * (1400)) + 100) };
        this.keys = { left: leftKey, right: rightKey, up: upKey, punch: punchKey };
        this.keyboarder = new Keyboarder();
    };
    Player.prototype = {
		update : function() {
			if (this.keyboarder.isKeyDown(this.keys.punch)) {
				if (this.animType != "punch") {
					this.anim = 0;
					this.animType = "punch";
					punchSoundMiss = document.getElementById("punchSoundMiss" + (this.game.punchIter++ % 2));
                    if (punchSoundMiss) {
                        punchSoundMiss.load();
                        punchSoundMiss.play();
                    }
				} else if (this.anim < 15) {
					this.anim+=5;
				}
    		} else if (this.keyboarder.isKeyDown(this.keys.left) && this.center.x > 0) {
    			this.animType = "walk";
                this.center.x -= 3;
                this.anim++;
                this.scaleX = -1;
            } else if (this.keyboarder.isKeyDown(this.keys.right) && this.center.x < (this.game.size.x - 150)) {
    			this.animType = "walk";
                this.center.x += 3;
                this.anim++;
                this.scaleX = 1;
            } else {
            	this.animType = "walk";
            	this.anim = 0;
            }
            
            if (this.keyboarder.isKeyDown(this.keys.up)) {
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
        },
        draw: function() {
            var rudydres = document.getElementById(this.id);
            var rudydresimage = document.getElementById(this.id + 'image');
            rudydres.style.left = this.center.x + 'px';
            rudydres.style.top = 500 - this.jump + 'px';
    
            rudydres.style.transform = 'scaleX(' + this.scaleX + ')';
            rudydresimage.style.marginLeft = -((Math.floor(this.anim / 5) % 8) * 150) + 'px';
            if(this.animType === "walk") { rudydresimage.style.marginTop = null; }
            else if (this.animType === "punch") { rudydresimage.style.marginTop = '-150px'; }
        }
    };

    var Enemy = function(game, id) {
        this.id = id;
        this.anim = 0;
        this.game = game;
        this.scaleX = 1;
        this.center = { x: Math.floor((Math.random() * (this.game.size.x)) + 20) };
    };
    Enemy.prototype = {
        update: function () {
            /* Move 3px in direction indicated by scaleX */
            this.center.x += 3 * this.scaleX;
            this.anim++;
            /* When character is reaching the end of the game screen, change its move direction */
            if ((this.center.x < 200 && this.scaleX < 0) || (this.center.x > (this.game.size.x - 200) && this.scaleX > 0))
                this.scaleX *= -1;
        },
        draw: function () {
            var enemy = document.getElementById(this.id);
            var enemyimage = document.getElementById(this.id + 'image');
            enemy.style.left = this.center.x + 'px';
            enemy.style.top = '500px';
    
            enemy.style.transform = 'scaleX(' + this.scaleX + ')';
            enemyimage.style.marginLeft = -((Math.floor(this.anim / 5) % 8) * 150) + 'px';
        }
    };

    var Keyboarder = function() {
        var keyState = {};
        window.addEventListener('keydown', function(e) { keyState[e.keyCode] = true; });
        window.addEventListener('keyup', function(e) { keyState[e.keyCode] = false; });
        this.isKeyDown = function(key) {
        	return keyState[key] === true;
        };
    };

    window.addEventListener('load', function() { new Game(); });
    sound = document.getElementById("ambient");
    sound.load();
    sound.play();
})();
