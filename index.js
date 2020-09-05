const config  = require('./config')
const express = require("express")
const router = express.Router()
const mongodb = require('mongodb').MongoClient

const server = express()

server.use(express.static("public"))

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

        require('./routes/search')({ db, server })
    })

})