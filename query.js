const e = require("express");

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
        }
    }

    fillWithPromise(obj, key, cursor) {
        return new Promise((resolve, reject) => {
            cursor.toArray().then(res => {
                obj[key] = res;
                resolve(obj);
            });
        });
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
                for(let i = 0; i < res.length; i++) {
                    let cursor = this.db.User.Outfits.find(
                        { _id: { $in: res[i].items } }
                    );
                    data.outfits[i] = this.fillWithPromise(res[i], "items", cursor);
                }
                Promise.all(res).then(res => {
                    data.outfits = res;
                    resolve(data);
                })
            })
            .catch(err => {
                throw err;
            })
        })
    }

    getUserCredentials(username) {
        let promise = new Promise((resolve, reject) => {
            let cursor = this.db.User.Credentials.findOne(
                { username }, function(err, res) {
                    if (err) reject(err);
                    resolve(res);
                }
            );
        });

        return promise;
    }

    getUserData(dataID) {
        let promise = new Promise((resolve, reject) => {
            this.db.User.Data.findOne(
                { _id: ObjectID(dataID) }
            )
            .then(data => {
                if (!data) resolve(data);

                let cursor = this.db.Apparel.Items.find(
                    { _id: {$in: data.likes} }
                );

                return this.fillWithPromise(data, "likes", cursor);
            })
            .then(data => {
                let cursor = this.db.Apparel.Items.find(
                    { _id: {$in: data.dislikes} }
                );

                return this.fillWithPromise(data, "dislikes", cursor);
            })
            .then(data => {
                let cursor = this.db.Apparel.Items.find(
                    { _id: { $in: data.wardrobe } }
                );

                return this.fillWithPromise(data, "wardrobe", cursor);
            })
            .then(data => {
                return this.fillOutfits(data);
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                reject(err);
            });
        });

        return promise;
    }

    addUserCredentials(username, password) {
        return new Promise((resolve, reject) => {
            let dataID = new ObjectID();
            let doc = {
                username, password,
                data: dataID
            };

            this.db.User.Credentials.insertOne(doc)
            .then(res => {
                let data = {
                    _id: dataID,
                    likes: [],
                    dislikes: [],
                    wardrobe: [],
                    outfits: [],
                    img: "http://fashionapi.herokuapp.com/placeholder.png"
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
                    return this.db.User.Outfits.insertOne({ _id: outfitID, items });
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








