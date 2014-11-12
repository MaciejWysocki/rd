(function() {
    // Globals
    var punchIter = 0;

    // Main class which holds all game elements such as players, enemies and items.
    // Game class runs main game loop (tick). It defines two main steps for each game
    // loop iterations - update (react on current state and time) and render.
    var Game = function() {
        this.size = { width: 1600, height: 700 };
        this.level = new Level('tlo.png');
        this.players = [];
        this.enemies = [];
        this.items = [];

        // Bootload
        /* Players */
        this.players = this.players.concat(new Player(
            'rudydres',
            50,
            500,
            'rudydres.png',
            new Mask(100, 500, 150, 650),
            100,    /* hitPoints */
            100,    /* statStrength */
            70,     /* statRange */
            new Keys(37, 39, 38, 16, 13, 191, 222)));
        this.players = this.players.concat(new Player(
            'rudydres2',
            150,
            500,
            'rudydres2.png',
            new Mask(200, 500, 350, 650),
            100,    /* hitPoints */
            100,    /* statStrength */
            70,     /* statRange */
            new Keys(65, 68, 87, 81, 49, 50, 51)));
        /* Enemies */
        this.enemies = this.enemies.concat(new Enemy(
            'lysyblokers',
            500,
            500,
            'lysyblokers.png',
            new Mask(490, 500, 510, 650),
            20,    /* hitPoints */
            70,    /* statStrength */
            60     /* statRange */));
        this.enemies = this.enemies.concat(new Enemy(
            'nerbisDres',
            600,
            500,
            'nerbisDres.png',
            new Mask(590, 500, 610, 650),
            50,    /* hitPoints */
            110,   /* statStrength */
            50     /* statRange */));

        var gameDiv = document.getElementById('game');
        gameDiv.style.width = this.size.width;
        gameDiv.style.height = this.size.height;
        this.level.render();

        var self = this;
        var tick = function() {
            self.update();
            self.render();
            requestAnimationFrame(tick);
        };
        tick();
    };
    Game.prototype = {
        update: function() {
            for (var i = 0; i < this.players.length; i++) {
                for (var j = 0; j < this.players.length; j++) {
                    if (this.players[i] != this.players[j]) {

                        var dres1 = this.players[i].x;
                        var dres2 = this.players[j].x;

                        if (dres1 > dres2 - 50 && dres1 < dres2 + 50) {
                            if (dres1 > dres2) {
                                this.players[i].x += 3;
                            }
                            if (dres1 < dres2) {
                                this.players[i].x -= 3;
                            }
                        }
                    }
                }
                this.players[i].update(this.players.concat(this.enemies));
            }
            for (var i = 0; i < this.enemies.length; i++) {
                this.enemies[i].update(this.players);
            }
            for (var i = 0; i < this.items.length; i++) {
                this.items[i].update();
            }
            this.level.update();
        },

        render: function() {
            var gameDiv = document.getElementById('game');
            gameDiv.style.top = Math.max(0, (document.body.clientHeight - this.size.height) / 2);
            gameDiv.style.left = Math.max(0, (document.body.clientWidth - this.size.width) / 2);
            clientWidth = document.body.clientWidth;
            if (clientWidth < this.size.width) {
                window.scrollTo(Math.min(this.players[0].x + 75 - clientWidth / 2, this.size.width - clientWidth), this.size.width);
            }
            for (var i = 0; i < this.players.length; i++) {
                this.players[i].render();
            }
            for (var i = 0; i < this.enemies.length; i++) {
                this.enemies[i].render();
            }
            for (var i = 0; i < this.items.length; i++) {
                this.items[i].render();
            }
        },

        takeItem: function(name) {
            for (var i = 0; i < this.items; i++) {
                if (this.items[i].name == name) {
                    var item = this.items[i];
                    this.items.splice(i, 1);
                    return item;
                }
            }
        },

        changeLevel: function(level, newX, newY) {
            // remove all items
            for (var i = 0; i < this.items.length; i++) {
                var itemDiv = document.getElementById(this.items[i].name);
                itemDiv.parentNode.removeChild(itemDiv);
            }
            this.items = [];
            // remove all enemies
            for (var i = 0; i < this.enemies.length; i++) {
                var enemyDiv = document.getElementById(this.enemies[i].name);
                enemyDiv.parentNode.removeChild(enemyDiv);
            }
            this.enemies = [];
            // move all players
            for (var i = 0; i < this.players.length; i++) {
                var player = this.players[i];
                player.x = newX;
                player.y = newY;
            }
            // change level and let it render
            this.level = level;
        }
    };

    // Level defines background and masks (platforms, walls, etc.) which define where elements can move.
    var Level = function(background) {
        this.background = background;
        // colision rectangles for elements
        this.masks = [];
        // doors to other levels
        this.doors = [];

        // initialization
        this.masks = this.masks.concat(new Mask(0, 650, 1600, 660));
        this.masks = this.masks.concat(new Mask(-100, 0, -1, 700));
        this.masks = this.masks.concat(new Mask(1600, 0, 1700, 700));
    };
    Level.prototype = {
        update: function() {
        },
        render: function() {
            document.getElementById('game').style.backgroundImage = 'url(' + this.background + ')';
        }
    };

    // Masks are invisible collision rectangles which define when elements interact with Levels and other elements.
    var Mask = function(minX, maxX, minY, maxY) {
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    };

    // Rectangle area which defines where player can switch the level to the one mapped to one configured by this door.
    var Door = function(mask, level) {
        this.mask = mask;
        this.level = level;
    };

    // Element is a class for items, laying weapons, effects like blood or explosion. It is also base class for players and enemies.
    var Element = function(name, x, y, image, mask) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.image = image;
        this.animationFrame = 0;
        this.scaleX = 1;
        this.mask = mask;
        this.state = 'nothing';
        this.stateStart = new Date().getTime();

        // initialization
        var img = document.createElement('img');
        img.setAttribute('id', this.name + '-image');
        img.setAttribute('src', this.image);

        var div = document.createElement('div');
        div.setAttribute('id', this.name);
        div.setAttribute('class', 'element');
        div.style.left = this.x;
        div.style.top = this.y;
        div.appendChild(img);

        document.getElementById('game').appendChild(div);
    };
    Element.prototype = {
        update: function() {
        },
        render: function() {
        }
    };


    // TODO Add statHitSpeed, statWalkSpeed
    // Base class for Player and Enemy
    var Character = function(name, x, y, image, mask, hitPoints, statStrength, statRange) {
        // call super constructor
        Element.call(this, name, x, y, image, mask);

        /* Assign stats */
        this.hitPoints = hitPoints;
        this.statStrength = statStrength;   /* Defines how far the enemy is knocked back after a hit */
        this.statRange = statRange;         /* Defines range of the punches */
    };
    // TODO Caleb: not sure if this is correct way to inherit the prototype
    Character.prototype = new Element();
    Character.prototype.constructor = Character;
    // Checks if otherDres (Element) is within punching range of this Character
    Character.prototype.isInPunchRange = function(otherDres) {
        var thisDresPosition = this.x * this.scaleX;
        var otherDresPosition = otherDres.x * this.scaleX;
        return (thisDresPosition < otherDresPosition && thisDresPosition + this.statRange > otherDresPosition);
    };
    Character.prototype.punch = function (otherDres) {
        /* Knock otherDres back */
        otherDres.x += this.statStrength * this.scaleX;
        /* Turn the otherDres back after he has been hit. */
        otherDres.scaleX = this.scaleX;
        /* Take hitPoints away */
        otherDres.hitPoints -= this.statStrength / 10.0;
    }

    // NPC - simple walking motherfucker
    var Enemy = function (name, x, y, image, mask, hitPoints, statStrength, statRange) {
        // call super constructor
        Character.call(this, name, x, y, image, mask, hitPoints, statStrength, statRange);

        // initialization
        this.state = 'walk';
        document.getElementById(this.name).setAttribute('class', 'element dres');
    };
    Enemy.prototype = new Character();
    Enemy.prototype.constructor = Enemy;
    Enemy.prototype.update = function (players) {
        var hit = false;
        /* Detect if any players are in punch range */
        for (var i = 0; i < players.length; i++) {
            var otherDres = players[i];

            /* If the otherDres is within punch range, knock him back */
            if (this.isInPunchRange(otherDres)) {
                this.punch(otherDres);
                if (!hit) { // Play punchSound just once
                    var punchSound = document.getElementById("punchSoundEnemyHit");
                    punchSound.load();
                    punchSound.play();
                }

                hit = true;
            }
        }

        /* If no players were hit, just keep on walking */
        if (!hit) {
            /* Move 3px in direction indicated by scaleX */
            this.x += 3 * this.scaleX;
            this.animationFrame++;
            /* When character is reaching the end of the game screen, change its move direction */
            // TODO change to colision with Level masks
            if ((this.x < 200 && this.scaleX < 0) || (this.x > 1250 && this.scaleX > 0))
                this.scaleX *= -1;
        }
    };
    Enemy.prototype.render = function() {
        var enemy = document.getElementById(this.name);
        var enemyimage = document.getElementById(this.name + '-image');
        enemy.style.left = this.x + 'px';
        enemy.style.top = this.y + 'px';

        enemy.style.transform = 'scaleX(' + this.scaleX + ')';
        enemyimage.style.marginLeft = -((Math.floor(this.animationFrame / 5) % 8) * 150) + 'px';
    };

    // Player is strearable element with health and items.
    var Player = function (name, x, y, image, mask, hitPoints, statStrength, statRange, keys) {
        Character.call(this, name, x, y, image, mask, hitPoints, statStrength, statRange);
        this.keys = keys;
        this.jump = 0;
        this.jumpStart = 0;

        // initialization
        this.state = 'walk';
        document.getElementById(this.name).setAttribute('class', 'element dres');
    };
    Player.prototype = new Character();
    Player.prototype.constructor = Player;
    Player.prototype.update = function (bodies) {
        var punchSound;
        if (this.keys.isKeyDown(this.keys.punch)) {
            if (this.state != "punch") {
                this.animationFrame = 0;
                this.state = "punch";
                /* This is actually a whoosh sound and will always be played, despite if punch hits or misses. 
                     * TODO: change name from punchSoundMiss to punchSoundWhoosh or something. */
                punchSound = document.getElementById("punchSoundMiss" + (punchIter++ % 2));

            } else if (this.animationFrame < 15) {
                this.animationFrame += 5;
                /* Punch other character if it's within the punch range. We only punch when the arm is stretched
                     * (this.anim === 10 ?) */
                var hit = false;
                if (this.animationFrame === 10)
                /* Check if any other character is within punch range */
                    for (var i = 0; i < bodies.length; i++) {
                        var otherDres = bodies[i];
                        if (this === otherDres)
                            continue;

                        /* If the otherDres is within punch range, knock him 100 pixels back */
                        if (this.isInPunchRange(otherDres)) {
                            this.punch(otherDres);
                            hit = true;
                        }
                    }
                if (hit === true)
                    punchSound = document.getElementById("punchSoundHit");
            }
            if (punchSound) {
                punchSound.load();
                punchSound.play();
            }
        } else if (this.keys.isKeyDown(this.keys.left) && this.x > 0) {
            // TODO change those x limits to colision model based on Level masks.
            this.state = "walk";
            this.x -= 3;
            this.animationFrame++;
            this.scaleX = -1;
        } else if (this.keys.isKeyDown(this.keys.right) && this.x < 1450) {
            this.state = "walk";
            this.x += 3;
            this.animationFrame++;
            this.scaleX = 1;
        } else {
            this.state = "walk";
            this.animationFrame = 0;
        }

        if (this.keys.isKeyDown(this.keys.jump) && this.jump === 0) {
            this.jump = 1;
            this.jumpStart = new Date().getTime();
            sound = document.getElementById(this.name + "JumpSound");
            if (sound) {
                sound.load();
                sound.play();
            }
        }
        if (this.jump < 0) {
            this.jump = 0;
        } else if (this.jump > 0) {
            var x = new Date().getTime() - this.jumpStart;
            if (x > 0) {
                this.jump = x * x / -625 + 4 * x / 5;
            }
        }
    };
    Player.prototype.render = function() {
        var rudydres = document.getElementById(this.name);
        var rudydresimage = document.getElementById(this.name + '-image');
        rudydres.style.left = this.x + 'px';
        rudydres.style.top = this.y - this.jump + 'px';

        rudydres.style.transform = 'scaleX(' + this.scaleX + ')';
        rudydresimage.style.marginLeft = -((Math.floor(this.animationFrame / 5) % 8) * 150) + 'px';
        if (this.state === "walk") {
            rudydresimage.style.marginTop = null;
        } else if (this.state === "punch") {
            rudydresimage.style.marginTop = '-150px';
        }
    };

    // Keys class maps keys ascii codes into action names like left, right, punch, etc.
    var Keys = function(left, right, jump, punch, kick, head, itemSwitch) {
        this.left = left;
        this.right = right;
        this.jump = jump;
        this.punch = punch;
        this.kick = kick;
        this.head = head;
        this.itemSwitch = itemSwitch;

        // initialization
        var keyState = {};
        window.addEventListener('keydown', function(e) { keyState[e.keyCode] = true; });
        window.addEventListener('keyup', function(e) { keyState[e.keyCode] = false; });
        this.isKeyDown = function(key) {
            return keyState[key] === true;
        };
    };

    // run game when ready
    window.addEventListener('load', function() { new Game(); });
})();