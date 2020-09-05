module.exports = function(ctx) {
    const db = ctx.db.db("Apparel");
    const server = ctx.server;
    const collection = db.collection("Items");
    
    const query_param = ["category", "gender", "limit", "name", "devmode"]

    // return MongoDB query given request parameters
    const constructQuery = function(req) {
        let mongo_query = { };

        if(req.query.category) {
            mongo_query["category"] = req.query.category;
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

    const fetchData = function(req, cursor) {
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

    server.get('/api/search', (req, res) => { 
        // send 400 if any query parameters are not in query_param
        if(Object.keys(req.query).some((key) => !query_param.includes(key))) {
            res.status(400).send("ERROR: valid parameters: category, gender, limit, name");
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
        fetchData(req, cursor).then((docs) => {
            // replace all images with local whale.jpg if devmode="true"
            if(req.query.devmode == "true") {
                for(key in docs) {
                    for(img in docs[key]["img"]) {
                        docs[key]["img"][img] = "http://fashionapi.herokuapp.com/whale.jpg";
                    }
                }
            }
            res.status(200).send(docs);
          
        }).catch(err => res.status(400).send("ERROR: failed to fetch data"));
    });

    server.get('/api/categories', (req, res) => {
        let result = collection.distinct("category", {}, (function(err, result){
            if(err) {
                res.status(400).send("ERROR: failed to fetch data")
            };
            res.status(200).send(result);
        }));
    });
}