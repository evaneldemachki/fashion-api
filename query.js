const Social = require('./social');

const ObjectID = require("mongodb").ObjectID;

module.exports = class Query {
    constructor(ctx) {
        this.db = {
            "Apparel": {
                "Items": ctx.db.db("Apparel").collection("Items")
            },
            "User": {
                "Credentials": ctx.db.db("User").collection("Credentials"),
                "Data": ctx.db.db("User").collection("Data"),
                "Outfits": ctx.db.db("User").collection("Outfits")
            }
        };

        this.social = new Social(this.db, this);
    }

    fillWithPromise(obj, key, cursor) {
        return new Promise((resolve, reject) => {
            cursor.then(res => {
                obj[key] = res;
                resolve(obj);
            });
        });
    }

    fillWithPromiseAtKey(obj, key, cursor) {
        return new Promise((resolve, reject) => {
            cursor.then(res => {
                obj[key] = res[key];
                resolve(obj);
            });
        });
    }

    testPromise(cursor, i) {
        return new Promise((resolve, reject) => {
            cursor.toArray().then(res => {
                resolve(res);
            })
        })
    }

    expandOutfits(outfitIDs) {
        return new Promise((resolve, reject) => {
            let outfits = [];
            for(let i = 0; i < outfitIDs.length; i++) {
                outfits.push(ObjectID(outfitIDs[i]));
            }
            this.db.User.Outfits.find(
                { _id: { $in: outfits } }
            ).toArray()
            .then(res => {
                let item_objects = [];
                for(let i = 0; i < res.length; i++) {
                    let items = [];
                    for(let j = 0; j < res[i].items.length; j++) {
                        items.push(ObjectID(res[i].items[j]));
                    }

                    let cursor = this.db.Apparel.Items.find(
                        { _id: { $in: items } }
                    );
                    item_objects.push(this.testPromise(cursor, i));
                }

                return Promise.all(item_objects)
            })
            .then(item_objects => {
                let data = [];
                for(let i = 0; i < outfits.length; i++) {
                    data[i] = {
                        _id: outfitIDs[i], 
                        items: item_objects[i]
                    }
                }
                resolve(data);                           
            })
            .catch(err => {
                throw err;
            })
        })
    }

    fillOutfits(data) {
        return new Promise((resolve, reject) => {
            let outfits = [];
            for(let i = 0; i < data.outfits.length; i++) {
                outfits.push(ObjectID(data.outfits[i]));
            }
            this.db.User.Outfits.find(
                { _id: { $in: outfits } }
            ).toArray()
            .then(res => {
                let item_objects = [];
                for(let i = 0; i < res.length; i++) {
                    let items = [];
                    for(let j = 0; j < res[i].items.length; j++) {
                        items.push(ObjectID(res[i].items[j]));
                    }

                    let cursor = this.db.Apparel.Items.find(
                        { _id: { $in: items } }
                    );
                    item_objects.push(this.testPromise(cursor, i));
                }

                return Promise.all(item_objects).then(obj_array => {
                    for(let i = 0; i < data.outfits.length; i++) {
                        data.outfits[i] = {
                            _id: data.outfits[i],
                            timestamp: res[i].timestamp, 
                            items: obj_array[i]
                        }
                    }
                    
                    return data;
                })
            })
            .then(data => {
                resolve(data);                           
            })
            .catch(err => {
                throw err;
            })
        })
    }

    getUserCredentials(email) {
        return new Promise((resolve, reject) => {
            let cursor = this.db.User.Credentials.findOne(
                { email }, function(err, res) {
                    if (err) reject(err);
                    resolve(res);
                }
            );
        });
    }

    getUserCredentialsByID(userID) {
        return new Promise((resolve, reject) => {
            let cursor = this.db.User.Credentials.findOne(
                { _id: ObjectID(userID) }, function(err, res) {
                    if (err) reject(err);
                    resolve(res);
                }
            )
        });
    }

    listSocialPromise(userIDArray) {
        return new Promise((resolve, reject) => {
            this.db.User.Credentials.find({ _id: { $in: userIDArray }})
            .project({ email: 0, password: 0 }).toArray()
            .then(credArray => {
                for(let i=0; i < credArray.length; i++) {
                    let cursor = this.db.User.Data.findOne({ _id: credArray[i].data });
                    credArray[i] = this.fillWithPromiseAtKey(credArray[i], "img", cursor)
                }
                
                return Promise.all(credArray);
            })
            .then(credArray => {
                for(let i=0; i < credArray.length; i++) {
                    delete credArray[i].data;
                }
                resolve(credArray);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    getPublicUserCredentials(userID) {
        return new Promise((resolve, reject) => {
            this.db.User.Credentials.findOne(
                { _id: ObjectID(userID) },
                { fields: { password: 0, email: 0, data: 0 } }
            )
            .then(cred => {
                resolve(cred);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    getFriendData(userID) {
        return new Promise((resolve, reject) => {
            this.db.User.Credentials.findOne(
                { _id: ObjectID(userID) },
                { fields: { password: 0, email: 0 } }
            )
            .then(cred => {
                if (!cred) resolve();
                let dataID = cred.data;

                return this.db.User.Data.findOne(
                    { _id: ObjectID(dataID) },
                    { fields: { _id: 0, requested: 0, pending: 0, wardrobe: 0 } }
                )
                .then(data => {
                    return Object.assign(cred, data);
                })
            })
            .then(data => { // populate LIKES field
                let cursor = this.db.Apparel.Items.find(
                    { _id: { $in: data.likes } }
                ).toArray();

                return this.fillWithPromise(data, "likes", cursor);
            })
            .then(data => { // populae OUTFITS field
                if (!data) reject("An unknown error occured");
                return this.fillOutfits(data);
            })
            .then(data => { // populate FOLLOWING field
                return this.listSocialPromise(data.following).then(following => {
                    data.following = following;
                    return data;
                });
            })
            .then(data => { // populate FOLLOWERS field
                this.listSocialPromise(data.followers).then(followers => {
                    data.followers = followers;
                    delete data.data
                    resolve(data);
                });                
            })
            .catch(err => {
                reject(err);
            });       
        });
    }

    getUserData(dataID) {
        return new Promise((resolve, reject) => {
            this.db.User.Data.findOne(
                { _id: ObjectID(dataID) }
            )
            .then(data => { // populate LIKES field
                if (!data) resolve(data);

                let cursor = this.db.Apparel.Items.find(
                    { _id: { $in: data.likes } }
                ).toArray();

                return this.fillWithPromise(data, "likes", cursor);
            })
            .then(data => { // populate WARDROBE field
                let cursor = this.db.Apparel.Items.find(
                    { _id: { $in: data.wardrobe } }
                ).toArray();

                return this.fillWithPromise(data, "wardrobe", cursor);
            })
            .then(data => { // populate OUTFITS field
                return this.fillOutfits(data);
            })
            .then(data => { // populate FOLLOWING field
                let cursor = this.listSocialPromise(data.following);
                return this.fillWithPromise(data, "following", cursor);
            })
            .then(data => { // populate FOLLOWERS field
                let cursor = this.listSocialPromise(data.followers);
                return this.fillWithPromise(data, "followers", cursor);
            })
            .then(data => { // populate REQUESTED field
                let cursor = this.listSocialPromise(data.requested);
                return this.fillWithPromise(data, "requested", cursor);
            })
            .then(data => { // populate PENDING field
                let cursor = this.listSocialPromise(data.pending);
                return this.fillWithPromise(data, "pending", cursor);
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    usernameExists(username) {
        return new Promise((resolve, reject) => {
            this.db.User.Credentials.findOne({ username })
            .then(res => {
                if(res) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            })
        })
    }

    searchUsers(searchStr) {
        if(searchStr == null) {
            return new Promise((resolve, reject) => {
                this.db.User.Credentials.find(
                    {}, { fields: { email: 0, password: 0, data: 0 } }
                ).toArray().then(users => {
                    resolve(users);
                }).catch(err => {
                    reject(err);
                });
            });
        } else {
            return new Promise((resolve, reject) => {
                this.db.User.Credentials.find(
                    {
                        $text: {
                            $search: searchStr,
                            $caseSensitive: false
                        }
                    }
                )
                .project(
                    { 
                        score: { $meta: "textScore" },
                        email: 0, password: 0, data: 0
                    }
                )
                .sort({ score: { $meta: "textScore" }})
                .toArray().then(users => {
                    resolve(users);
                }).catch(err => {
                    reject(err);
                });
            })
        }
    }

    addUserCredentials(doc) {
        return new Promise((resolve, reject) => {
            let dataID = new ObjectID();
            doc["data"] = dataID;

            this.db.User.Credentials.insertOne(doc)
            .then(res => {
                let data = {
                    _id: dataID,
                    following: [],
                    followers: [],
                    requested: [],
                    pending: [],
                    likes: [],
                    dislikes: [],
                    wardrobe: [],
                    outfits: [],
                    img: "http://fashionapi.herokuapp.com/placeholder.png",
                    private: false
                };

                return this.db.User.Data.insertOne(data);
            })
            .then(res => {
                resolve(res.insertedCount);
            }).catch(err => {
                reject(err);
            });   
        })
    }

    addOutfit(dataID, itemArray) {
        return new Promise((resolve, reject) => {
            this.db.User.Data.findOne(
                { _id: ObjectID(dataID) }
            )
            .then(data => {
                if (!data) reject();
                return data;
            })
            .then(data => {
                let outfitID = new ObjectID();
                this.db.User.Data.updateOne(
                    { _id: ObjectID(dataID) },
                    { $push: { outfits: outfitID } },
                    { upsert: false } 
                ).then(data => {
                    let items = [];
                    for(let i = 0; i < itemArray.length; i++) {
                        items.push(ObjectID(itemArray[i]));
                    }
                    return this.db.User.Outfits.insertOne(
                        {
                            _id: outfitID,
                            timestamp: new Date(),
                            items
                        }
                    );
                }).then(data => {
                    let insertedCount = data.insertedCount;
                    if(insertedCount > 0) {
                        resolve(outfitID.toHexString());
                    } else { reject(); }
                }).catch(err => {
                    reject(err);
                });
            }).catch(err => {
                reject(err);
            });
        });
    }

    updateOutfit(outfitID, itemArray) {
        return new Promise((resolve, reject) => {
            let items = [];
            for(let i = 0; i < itemArray.length; i++) {
                items.push(ObjectID(itemArray[i]));
            }
            this.db.User.Outfits.updateOne(
                { _id: ObjectID(outfitID) },
                { $set: { items } },
                { upsert: false }
            )
            .then(data => {
                if(!data) {
                    resolve(data);
                } else {
                    resolve(data);
                }
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    addProductAction(dataID, itemID, action) {
        return new Promise((resolve, reject) => {
            let payload;
            if(action == "like") {
                payload = { 
                    $addToSet: { likes: ObjectID(itemID) },
                    $pull: { dislikes: ObjectID(itemID) }
                }
            } else if(action == "dislike") {
                payload = { 
                    $addToSet: { dislikes: ObjectID(itemID) },
                    $pull: { likes: ObjectID(itemID) }
                }
            } else if(action == "reset") {
                payload = { 
                    $pull: {
                        likes: ObjectID(itemID),
                        dislikes: ObjectID(itemID) 
                    }
                }                
            } else if(action == "save") {
                payload = { 
                    $addToSet: { wardrobe: ObjectID(itemID) }
                }                
            } else if(action == "unsave") {
                payload = { 
                    $pull: { wardrobe: ObjectID(itemID) }
                }                    
            } else {
                reject("invalid action");
            }
    
            let cursor = this.db.User.Data.updateOne(
                { _id: ObjectID(dataID) }, 
                payload,
                { upsert: false }             
            )
            .then(res => {
                let nModified = res.result.nModified;
                resolve(nModified);
            }).catch(err => {
                reject(err);
            })
        });

    }
}








