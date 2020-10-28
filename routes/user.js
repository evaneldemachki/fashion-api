const passport = require("passport");
const jwt = require("jsonwebtoken");
const passwordHash = require('password-hash');

module.exports = function(server, query) {
    server.get('/user/search', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let term = null;
        if(req.query.term) {
            term = req.query.term;
        }
        query.searchUsers(term).then(users => {
            return res.status(200).send(users);
        })
    });

    server.post('/user/login', (req, res, next) => {
        passport.authenticate('local', function(err, user, info) {
            if (err) { return next(err); }
            if (!user) { 
                return res.status(400).send(info.message);
            }

            let token = jwt.sign(
                {data: user.data, id: user._id},
                'secret', 
                {expiresIn: "24h"}
            )

            return res.status(200).send(token);         
            
        })(req, res, next);
    });

    server.post('/user/register', (req, res) => {
        query.getUserCredentials(req.body.email)
        .then(cred => {
            if (cred) {
                throw new Error("Email already exists");
            }
        })
        .then(() => {
            query.usernameExists(req.body.username)
            .then(exists => {
                if(exists) {
                    throw new Error("Username already exists");
                }
            });
            let password = passwordHash.generate(req.body["password"]);
            return query.addUserCredentials({
                email: req.body.email,
                username: req.body.username,
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                password
            });
        })
        .then(nInserted => {
            if(nInserted == 0) {
                throw new Error("An unknown error occurred");
            }
            return res.status(200).send("Successfully added new user");
        })
        .catch(err => {
            return res.status(400).send(err);
        });   
    });

    server.post('/user/follow', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let sendingID = req.user.id;
        let recievingID = req.body["id"]
        
        query.social.follow(sendingID, recievingID)
        .then(updates => {
            if (updates[0] == updates[1] == 0) {
                res.status(400).send("An unknown error occured");
            } else {
                res.status(200).send("Success");
            }
        })
        .catch(err => {
            res.status(400).send(err.message)
        });
    });

    server.post('/user/unfollow', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let sendingID = req.user.id;
        let recievingID = req.body["id"]
        
        query.social.unfollow(sendingID, recievingID)
        .then(updates => {
            if ( (updates[0] == 0) || (updates[1] == 0) ) {
                res.status(400).send("An unknown error occured");
            } else {
                res.status(200).send("Success");
            }
        })
        .catch(err => {
            res.status(400).send(err)
        })
    });

    
    server.post('/user/accept-follow', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let sendingID = req.user.id;
        let recievingID = req.body["id"]
        
        query.social.acceptFollow(sendingID, recievingID)
        .then(updates => {
            if (updates[0] == updates[1] == 0) {
                res.status(400).send("An unknown error occured");
            } else {
                res.status(200).send("Success");
            }
        })
        .catch(err => {
            res.status(400).send(err.message)
        });
    });

    server.post('/user/reject-follow', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let sendingID = req.user.id;
        let recievingID = req.body["id"]
        
        query.social.rejectFollow(sendingID, recievingID)
        .then(updates => {
            if (updates[0] == updates[1] == 0) {
                res.status(400).send("An unknown error occured");
            } else {
                res.status(200).send("Success");
            }
        })
        .catch(err => {
            res.status(400).send(err.message)
        });
    });

    server.post('/user/user-data', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let userID = req.body.id;
        // TODO: verify user is not private / user is followed
        query.getFriendData(userID).then(data => {
            if (data) {
                return res.status(200).send(data);
            } else {
                return res.status(400).send("User data not found");
            }
        }).catch(err => {
            console.log(err);
            return res.status(400).send("An unknown error occured");
        }); 
    });


    server.post('/user/data', passport.authenticate('jwt', { session: false }),
        function(req, res) {
            let userID = req.user.id;
            let dataID = req.user.data;

            query.getUserData(dataID).then(data => {
                if (data) {
                    query.getPublicUserCredentials(userID)
                    .then(cred => {
                        let response = Object.assign(data, cred);
                        return res.status(200).send(response);
                    })
                    .catch(err => {
                        res.status(400).send("User credentials not found");
                    });
                } else {
                    return res.status(400).send("User data not found");
                }
            }).catch(err => {
                return res.status(400).send("An unknown error occured");
            }); 
        }
    );

    server.post('/user/action', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let dataID = req.user.data;
        if(!Object.keys(req.body).includes("item")) {
            return res.status(400).send("Must provide key: 'item'");
        }
        if(!Object.keys(req.body).includes("action")) {
            return res.status(400).send("Must provide key: 'action'");
        }
        let valid_actions = ["like", "dislike", "reset", "save", "unsave"]
        if(!valid_actions.includes(req.body["action"])) {
            return res.status(400).send("Provided invalid action");
        }
        query.addProductAction(dataID, req.body["item"], req.body["action"])
        .then(nModified => {
            if(nModified == 0) {
                return res.status(400).send(`Item already ${ req.body["action"] }d`);
            }
            return res.status(200).send(`Successfully ${ req.body["action"] }d item: ${ req.body["item"] }`);
        }).catch(err => {
            return res.status(400).send("Item not found");
        });
    });

    server.post('/user/add-outfit', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let dataID = req.user.data;
        if(!Object.keys(req.body).includes("items")) {
            return res.status(400).send("Must provide key: 'items'");
        }
        let items = req.body.items;
        query.addOutfit(dataID, items).then(outfitID => {
            return res.status(200).send(outfitID);
        }).catch(err => {
            return res.status(400).send("An unknown error occured");
        });
    });

    server.post('/user/update-outfit', passport.authenticate('jwt', { session: false }),
    function(req, res) {
        let dataID = req.user.data;
        if(!Object.keys(req.body).includes("outfit")) {
            return res.status(400).send("Must provide key: 'outfit'");
        }
        if(!Object.keys(req.body).includes("items")) {
            return res.status(400).send("Must provide key: 'items'");
        }
        let outfitID = req.body.outfit;
        let items = req.body.items;
        query.updateOutfit(outfitID, items).then(nModified => {
            if(!nModified) {
                return res.status(400).send("User not found");
            } 
            return res.status(200).send("Successfully updated outfit");
        }).catch(err => {
            return res.status(400).send("An unknown error occured");
        });        
    });
}