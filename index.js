const config  = require('./config');
const express = require("express");
const router = express.Router();
const mongodb = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const passport = require('passport');

let Query = require('./query')

const server = express();

// object id class for mongoDB find by ID
const ObjectID = require("mongodb").ObjectID;

server.use(express.static("public"));
server.use(bodyParser.json());
server.use(passport.initialize());
server.use(passport.session());

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
            db,
            server,
            passport
        }

        query = new Query(imports)

        require('./strategy')(passport, query);
        require('./routes/search')(imports, query)
        require('./routes/user')(server, query)
    })

})