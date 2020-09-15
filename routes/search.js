const ObjectID = require("mongodb").ObjectID;

module.exports = function(ctx, query) {
    const db = ctx.db.db("Apparel");
    const server = ctx.server;
    const collection = db.collection("Items");
    
    const query_param = ["category", "gender", "limit", "name", "devmode"];

    // return MongoDB query given request parameters
    const constructQuery = function(req) {
        let mongo_query = { };

        if(req.query.category) {
            let categories = req.query.category.split(",");
            mongo_query["category"] = { $in: categories };
        }
        if(req.query.gender) {
            mongo_query["gender"] = req.query.gender;
        }
        if(req.query.name) {
            mongo_query["$text"] = { 
                "$search" : req.query.name,
            };
        }
        
        return mongo_query;
    };

    server.get('/api/grab', (req, res) => {
        if(!Object.keys(req.query).includes("item")) {
            return res.status(400).send("ERROR: item ID not provided");
        }
        let cursor = collection.findOne({ _id: ObjectID(req.query.item) });
        cursor.then(docs => {
            if(!docs) {
                return res.status(400).send("ERROR: item not found")
            }
            return res.status(200).send(docs);
        }).catch(err => {
            return res.status(400).send("ERROR: an unknown error occurred");
        });
    });

    server.get('/api/search', (req, res) => { 
        // send 400 if any query parameters are not in query_param
        if(Object.keys(req.query).some((key) => !query_param.includes(key))) {
            res.status(400).send("ERROR: valid parameters: category, gender, limit, name");
            return;
        }

        // get request object from query constructor
        let mongo_query = constructQuery(req);
        let limit;

        // use default limit if not included in request
        if(req.query.limit) {
            limit = parseInt(req.query.limit);
            // send 400 non-integer limit parameter
            if(Number.isNaN(limit)) {
                res.status(400).send("ERROR: non-integer limit parameter");
                return;
            }
        } else {
            limit = 20;
        }

        // obtain MongoDB cursor
        let cursor = collection.find(mongo_query).limit(limit);
        // project relevance score into results if using text search
        if(req.query.name) {
            cursor = cursor.project({score: {"$meta": "textScore"}})
        }

        // fetch response promise
        cursor.toArray().then(docs => {
            // replace all images with local whale.jpg if devmode="true"
            if(req.query.devmode == "true") {
                for(key in docs) {
                    for(img in docs[key]["img"]) {
                        docs[key]["img"][img] = "http://fashionapi.herokuapp.com/whale.jpg";
                    }
                }
            }
            res.status(200).send(docs);
            return;
          
        }).catch(err => {
            res.status(400).send("ERROR: failed to fetch data");
            return;
        });
    });

    server.get('/api/categories', (req, res) => {
        let result = collection.distinct("category", {}, (function(err, result) {
            if(err) {
                res.status(400).send("ERROR: failed to fetch data");
                return;
            };
            res.status(200).send(result);
            return;
        }));
    });
}