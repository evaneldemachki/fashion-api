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

    // checks if objectID is in array of objectIDs
    const hasReference = function(id_array, item_id) {
        return id_array.some(function (obj_id) {
            return obj_id.equals(item_id.toHexString());
        });
    }

    // register proudct like / dislike / reset
    const registerProductAction = function(res, data_id, item_id, action) {
        // check User.Data for existing like/dislike
        let data_collection = db.collection("Data");
        cursor = data_collection.find({_id: ObjectID(data_id)});
        fetchData(cursor).then(docs => {
            let user_data = docs[0];

            let pkey, skey;
            if(action == "like") {
                pkey = "likes";
                skey = "dislikes";
            } else if(action == "dislike") {
                pkey = "dislikes";
                skey = "likes";
            } else if(action == "reset") {
                let pulls = {}
                if(hasReference(user_data["likes"], item_id)) {
                    pulls["likes"] = item_id;
                } else if(hasReference(user_data["dislikes"], item_id)) {
                    pulls["dislikes"] = item_id;
                } else {
                    res.status(400).send("ERROR: nothing to reset");
                    return;
                }
                cursor = data_collection.update(
                    {_id: ObjectID(data_id)}, 
                    {$pull: pulls}, 
                    {upsert: false}
                );
                fetchStatus(cursor).then(status => {
                    if(status["result"]["nModified"] != 1) {
                        throw new Error();
                    }
                    res.status(200).send("Successfully reset product action history");
                    return;                  
                }).catch(err => {
                    res.status(400).send("ERROR: an unknown error occured");
                    return;
                })
            }

            if(hasReference(user_data[pkey], item_id)) {
                res.status(400).send("ERROR: item already liked");
                return;
            } else if(hasReference(user_data[skey], item_id)) {
                let pull_obj = {};
                let push_obj = {};
                pull_obj[skey] = item_id;
                push_obj[pkey] = item_id;
                cursor = data_collection.update({_id: ObjectID(data_id)}, 
                    {
                        $pull: pull_obj,
                        $push: push_obj
                    }, { upsert: false }
                );  
                fetchStatus(cursor).then(status => {
                    if(status["result"]["nModified"] != 1) {
                        throw new Error();
                    }
                    res.status(200).send("success");                                 
                }).catch(err => {
                    res.status(400).send("ERROR: an unknown error occurred");
                });
            } else {
                let push_obj = {};
                push_obj[pkey] = item_id;
                cursor = data_collection.update({_id: ObjectID(data_id)}, 
                    { $push: push_obj },
                    { upsert: false } 
                );  
                fetchStatus(cursor).then(status => {
                    if(status["result"]["nModified"] != 1) {
                        throw new Error();
                    }
                    res.status(200).send("success");                                 
                }).catch(err => {
                    res.status(400).send("ERROR: an unknown error occurred");                                 
                });                                   
            }
        });
    }

    server.post('/api/user/product_action', (req, res) => {
        let required = ["token", "item_id", "action"];
        if(missingKeys(req.body, required)) {
            res.status(400).send("ERROR: must include key(s) (token, item_id, action)");
            return;
        }

        let token = req.body["token"];
        let item_id = ObjectID(req.body["item_id"]);
        let action = req.body["action"];
        if(action != "like" && action != "dislike" && action != "reset") {
            res.status(400).send("ERROR: allowed actions are (like, dislike, reset)");
            return;
        }

        jwt.verify(token, jwt_config["secret"], function(err, decoded) {
            if(!err) { // if token verification succeeds:
                // verify user existence
                let data_id = decoded["data_id"];
                let data_collection = db.collection("Data");
                let cursor = data_collection.find({_id: ObjectID(data_id)});
                fetchData(cursor).then(docs => {
                    if(docs.length == 0) {
                        res.status(400).send("ERROR: user data does not exist");
                        return false;
                    } else {
                        return true;
                    }
                }).then(obj => {
                    if(!obj) {
                        return;
                    } // verify item existence by product_id
                    let apparel = ctx.db.db("Apparel");
                    let item_collection = apparel.collection("Items");
                    cursor = item_collection.find({_id: item_id});
                    fetchData(cursor).then(docs => {
                        if(docs.length == 0) {
                            res.status(400).send("ERROR: item does not exist");
                            return false;
                        } else {
                            return true;
                        }                    
                    }).then(status => {
                        if(!status) {
                            return;
                        }
                        registerProductAction(res, data_id, item_id, action);
                    });
                });
            } else {
                res.status(400).send("ERROR: authentication failure")
            };      
        });
    });

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
                    {data_id: doc[0]["data"]}, 
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
            let data_id = new ObjectID();
            cursor = collection.insert(
                {
                    username, 
                    password,
                    data: data_id
                }
            );
            fetchStatus(cursor).then((doc) => {
                // throw error if credentials record insertion failed
                if(doc["insertedCount"] != 1) {
                    throw new Error();
                }
            }).then(() => {
                cursor = db.collection("Data").insert(
                    {
                        _id: data_id,
                        img: "http://fashionapi.herokuapp.com/placeholder.png",
                        likes: [],
                        dislikes: []
                    }
                );
                fetchStatus(cursor).then(doc => {
                    if(doc["insertedCount"] != 1) {
                        throw new Error();
                    }
                    res.status(200).send("Successfully created account for user: '" + username + "'");
                    return;
                })
            })
        }).catch((err) => { // catch record insertion failure
            res.status(400).send("ERROR: an unknown error occured");
            return;
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
                let data_id = ObjectID(decoded["data_id"]);
                let data_collection = db.collection("Data");
                let cursor = data_collection.find({_id: data_id});
                // ADD USER-EXISTS VERIFICATION HERE
                fetchData(cursor).then(docs => {
                    let img = docs[0]["img"];
                    res.status(200).send(img);
                    return
                }).catch((err) => {
                    res.status(400).send("ERROR: an unknown error occured");
                    return;
                });
            } else { // if token verification fails, send 400
                res.status(400).send("ERROR: invalid authentication token")
            }
        });
    })

    server.post('/api/user/set_profile_picture', (req, res) => {
        let required = ["token", "url"];
        if(missingKeys(req.body, required)) {
            res.status(400).send("ERROR: must include key(s) (token, url)");
            return;
        }

        let token = req.body["token"];
        let url = req.body["url"];

        jwt.verify(token, jwt_config["secret"], function(err, decoded) {
            if(!err) { // if token verification succeeds, update profile_picture
                let data_collection = db.collection("Data");
                let cursor = data_collection.update(
                    {_id: ObjectID(decoded["data_id"])}, 
                    {$set: {img: url}},
                    { upsert: false });
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