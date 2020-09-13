const passport = require("passport");
const jwt = require("jsonwebtoken");
const passwordHash = require('password-hash');

module.exports = function(server, query) {
    server.post('/user/login', (req, res, next) => {
        passport.authenticate('local', function(err, user, info) {
            if (err) { return next(err); }
            if (!user) { 
                return res.status(400).send(info.message);
            }

            let token = jwt.sign(
                {data: user.data}, 
                'secret', 
                {expiresIn: "24h"})

            return res.status(200).send(token);         
            
        })(req, res, next);
    });

    server.post('/user/register', (req, res) => {
        query.getUserCredentials(req.body["username"])
        .then(cred => {
            if (cred) {
                res.status(400).send("User already exists");
                return true;
            }
            return false;
        })
        .then(exists => {
            if(exists) {
                return;
            }
            let password = passwordHash.generate(req.body["password"]);
            return query.addUserCredentials(req.body["username"], password);
        }).then(nInserted => {
            if(nInserted == 0) {
                return res.status(400).send("An unknown error occurred");
            }
            return res.status(200).send("Successfully added new user");
        })
        .catch(err => {
            return res.status(400).send("An unknown error occurred");
        });   
    });


    server.post('/user/data', passport.authenticate('jwt', { session: false }),
        function(req, res) {
            let dataID = req.user; // not sure why it always resolves to .user
 
            query.getUserData(dataID).then(data => {
                if (data) {
                    return res.status(200).send(data);
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
        let dataID = req.user;
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
}