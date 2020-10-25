const ObjectID = require("mongodb").ObjectID;

module.exports = class Social {
    constructor(db, query) {
        this.db = db;
        this.query = query;
    }

    // get user data for two user IDs
    getUserDataPair(sendingID, recievingID) {
        return new Promise((resolve, reject) => {
            Promise.all([
                this.query.getUserCredentialsByID(sendingID),
                this.query.getUserCredentialsByID(recievingID)
            ])
            .then(cred => {
                return Promise.all([
                    this.query.getUserData(cred[0].data),
                    this.query.getUserData(cred[1].data)
                ]);
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    //submit database updates for for two user IDs
    submitUpdatePair(data, sendingUpdate, recievingUpdate) {
        return new Promise((resolve, reject) => {
            Promise.all([
                this.db.User.Data.updateOne(
                    { _id: ObjectID(data[0]._id) },
                    sendingUpdate,
                    { upsert: false }
                ).then(update => { return update; }),
                this.db.User.Data.updateOne(
                    { _id: ObjectID(data[1]._id) },
                    recievingUpdate,
                    { upsert: false }
                ).then(update => { return update; })
            ])
            .then(data => { 
                console.log(data);
                resolve(data); })
            .catch(err => { 
                console.log(err);
                reject(err); });
        });
    }

    follow(sendingID, recievingID) {
        return new Promise((resolve, reject) => {
            this.getUserDataPair(sendingID, recievingID)
            .then(data => {
                let following = [];
                for(let i = 0; i < data[0].following.length; i += 1) {
                    following.push(data[0].following[i].toHexString());
                } // check if already following user
                if(following.includes(recievingID)) {
                    throw new Error("already following");
                }
                let sendingPayload;
                let recievingPayload;
                // check if recieving user has private account
                if(data[1].private == true) { // perform checks / send request
                    // check if sending user already requested to follow recieving user
                    console.log(data)
                    let requested = [];
                    for(let i = 0; i < data[0].requested.length; i += 1) {
                        requested.push(data[0].requested[i]._id.toHexString());
                    }
                    if(requested.includes(recievingID)) {
                        throw new Error("already requested");
                    } else { // send follow request
                        sendingPayload = { 
                            $addToSet: { requested: ObjectID(recievingID) }
                        };
                        recievingPayload = {
                            $addToSet: { pending: ObjectID(sendingID) }
                        }; 
                    }
                } else { // follow user
                    sendingPayload = { 
                        $addToSet: { following: ObjectID(recievingID) }
                    };
                    recievingPayload = {
                        $addToSet: { followers: ObjectID(sendingID) }
                    };                                      
                }

                return this.submitUpdatePair(data, sendingPayload, recievingPayload);
            })  
            .then(updates => {
                let nModified = [updates[0].result.nModified, updates[1].result.nModified];
                resolve(nModified);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    unfollow(sendingID, recievingID) {
        return new Promise((resolve, reject) => {
            this.getUserDataPair(sendingID, recievingID)
            .then(data => {
                let following = [];
                for(let i = 0; i < data[0].following.length; i += 1) {
                    following.push(data[0].following[i]._id.toHexString());
                }
                let requested = [];
                for(let i = 0; i < data[0].requested.length; i += 1) {
                    requested.push(data[0].requested[i]._id.toHexString());
                }                
                // assert sending user is either following or has requested recieving user
                if( (!following.includes(recievingID)) && (!requested.includes(recievingID)) ) {
                    throw new Error("not following or requesting");
                    return;
                }

                let sendingPayload = { 
                    $pull: {
                        following: ObjectID(recievingID),
                        requested: ObjectID(recievingID)
                    }
                };
                let recievingPayload = {
                    $pull: {
                        followers: ObjectID(sendingID),
                        pending: ObjectID(sendingID)
                    }
                };
                
                return this.submitUpdatePair(data, sendingPayload, recievingPayload);
            })  
            .then(updates => {
                let nModified = [updates[0].result.nModified, updates[1].result.nModified];
                resolve(nModified);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    acceptFollow(sendingID, recievingID) {
        return new Promise((resolve, reject) => {
            this.getUserDataPair(sendingID, recievingID)
            .then(data => {
                let pending = [];
                for(let i = 0; i < data[0].pending.length; i += 1) {
                    pending.push(data[0].pending[i]._id.toHexString());
                } // assert recievingID has requested sendingID
                if(!pending.includes(recievingID)) {
                    throw new Error("request does not exist");
                }

                let sendingPayload = { 
                    $pull: { pending: ObjectID(recievingID) },
                    $addToSet: { followers: ObjectID(recievingID) }
                };
                let recievingPayload = {
                    $pull: { requested: ObjectID(sendingID) },
                    $addToSet: { following: ObjectID(sendingID) }
                };

                return this.submitUpdatePair(data, sendingPayload, recievingPayload);
            })
            .then(updates => {
                let nModified = [updates[0].result.nModified, updates[1].result.nModified];
                resolve(nModified);
            })
            .catch(err => {
                reject(err);
            });
        });
    }

    
    rejectFollow(sendingID, recievingID) {
        return new Promise((resolve, reject) => {
            this.getUserDataPair(sendingID, recievingID)
            .then(data => {
                let pending = [];
                for(let i = 0; i < data[0].pending.length; i += 1) {
                    pending.push(data[0].pending[i]._id.toHexString());
                } // assert recievingID has requested sendingID
                if(!pending.includes(recievingID)) {
                    throw new Error("request does not exist");
                }

                let sendingPayload = { 
                    $pull: { pending: ObjectID(recievingID) }
                };
                let recievingPayload = {
                    $pull: { requested: ObjectID(sendingID) }
                };

                return this.submitUpdatePair(data, sendingPayload, recievingPayload);
            })
            .then(updates => {
                let nModified = [updates[0].result.nModified, updates[1].result.nModified];
                resolve(nModified);
            })
            .catch(err => {
                reject(err);
            });
        });
    }
}