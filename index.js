const config  = require('./config')
const express = require("express")
const router = express.Router()
const mongodb = require('mongodb').MongoClient
const bodyParser = require('body-parser');
const passwordHash = require("password-hash")
const jwt = require("jsonwebtoken")

const server = express();
// java web token configuration
const jwt_config = {
    "secret": "test-secret",
    "expire": "24h"
}
// object id class for mongoDB find by ID
const ObjectID = require("mongodb").ObjectID;

const fetchData = function(cursor) {
    let response = new Promise(function(resolve, reject) {
        cursor.toArray(function(err, res) {
            if (err) {
                reject(err); 
            } else{
                resolve(res);
            } 
        });
    });

    return response;
}

server.use(express.static("public"));
server.use(bodyParser.json());

server.listen(config.port, () => {
    mongodb.connect(config.db.uri, (err, db) => {
        if (err) {
            console.log('An error occurred while attempting to connect to MongoDB', err)
            process.exit(1)
        }

        console.log(
            '%s v%s ready to accept connections on port %s in %s environment.',
            config.name,
            config.version,
            config.port,
            config.env
        )
        let imports = { 
            db, ObjectID,
            server, 
            fetchData,
            passwordHash,
            jwt, jwt_config
        }
        require('./routes/search')(imports)
        require('./routes/user')(imports)
    })

})