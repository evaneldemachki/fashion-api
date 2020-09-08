const e = require("express");

module.exports = function(ctx) {
    const db = ctx.db.db("User");
    const server = ctx.server;
    const fetchData = ctx.fetchData;
    const passwordHash = ctx.passwordHash;
    const jwt = ctx.jwt;
    const jwt_config = ctx.jwt_config;
    const ObjectID = ctx.ObjectID;
    const collection = db.collection("Credentials");

    const fetchStatus = function(cursor) {
        let response = new Promise(function(resolve, reject) {
            cursor.then((doc) => {
                resolve(doc);
            });
        });
    
        return response;
    }

    // checks request body against required keys
    const missingKeys = function(body, required) {
        if(Object.keys(body).some((key) => !required.includes(key))) {
            return true;
        } else {
            return false;
        }
    }

    server.post('/api/user/verify', (req, res) => {
        let required = ["username", "password"];
        if(missingKeys(req.body, required)) {
            res.status(400).send("ERROR: must include key(s) (username, password)");
            return;
        }

        let username = req.body["username"];
        let password = req.body["password"];

        let cursor = collection.find({ username });
        fetchData(cursor).then((doc) => {
            if(doc.length == 0) {
                res.status(400).send("ERROR: user does not exist");
                return;
            }
            // check if password matches stored hash
            if(passwordHash.verify(password, doc[0]["password"])) {
                // generate JsonWebToken
                let token = jwt.sign(
                    {user_id: doc[0]["_id"]}, 
                    jwt_config["secret"], 
                    {expiresIn: jwt_config["expire"]})
                // return JsonWebToken (OK)
                res.status(200).send(token);
                return;
            } else { // password did not match stored hash:
                res.status(400).send("ERROR: incorrect username/password combination");
                return;
            }
        }, (err) => {
            res.status(400).send("ERROR: an unknown error occured");
            return;
        });
        
    });

    server.post('/api/user/create', (req, res) => {
        let required = ["username", "password"];
        if(missingKeys(req.body, required)) {
            res.status(400).send("ERROR: must include key(s) (username, password)");
            return;
        }

        let username = req.body["username"];
        let password = passwordHash.generate(req.body["password"]);

        let cursor = collection.find({ username });
        fetchData(cursor).then((doc) => {
            if(doc.length != 0) { // requested username entry already exists:
                res.status(400).send("ERROR: user already exists");
                return;
            }  
        }).then(() => { 
            cursor = collection.insert({ username, password });
            fetchStatus(cursor).then((doc) => {
                // throw error if user record was not added to collection
                if(doc["insertedCount"] != 1) {
                    throw new Error();
                } else {
                    res.status(200).send("Successfully created new user '" + username + "'");
                    return;
                }
            }).catch((err) => { 
                res.status(400).send("ERROR: an unknown error occured");
                return;
            })
        }); 
    });

    server.post('/api/user/get_profile_picture', (req, res) => {
        let required = ["token"];
        if(missingKeys(req.body, required)) {
            res.status(400).send("ERROR: must include key(s) (token,)");
            return;
        }

        let token = req.body["token"];

        jwt.verify(token, jwt_config["secret"], function(err, decoded) {
            if(!err) { // if token verification succeeds, return profile_picture
                let cursor = collection.find({_id: ObjectID(decoded["user_id"])});
                fetchData(cursor).then((doc) => {
                    return doc[0]["picture"];
                }).then((img_url) => { // return profile picture URL
                    res.status(200).send(img_url);
                    return;
                }).catch((err) => {
                    res.status(400).send("ERROR: an unknown error occured");
                    return;
                });
            } else { // if token verification fails, send 400
                res.status(400).send("ERROR: invalid authentication token")
            }
        });
    })

    server.post('/api/user/update_profile_picture', (req, res) => {
        let required = ["token", "url"];
        if(missingKeys(req.body, required)) {
            res.status(400).send("ERROR: must include key(s) (token, url)");
            return;
        }

        let token = req.body["token"];
        let url = req.body["url"];

        jwt.verify(token, jwt_config["secret"], function(err, decoded) {
            if(!err) { // if token verification succeeds, update profile_picture
                let cursor = collection.update(
                    {_id: ObjectID(decoded["user_id"])}, 
                    {$set: {picture: url}});
                fetchStatus(cursor).then((status) => {
                    if(status["result"]["nModified"] != 1) {
                        throw new Error();
                    }
                    res.status(200).send("Successfully updated profile picture");
                    return;
                }).catch(() => {
                    res.status(400).send("ERROR: an unknown error occured");
                    return;
                })
            } else { // if token verification fails, send 400
                res.status(400).send("ERROR: invalid token");
                return;
            }
        });
    });


}