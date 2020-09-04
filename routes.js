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
            mongo_query["$text"] = { "$search" : req.query.name };
        }
        
        return mongo_query;
      };

    server.get('/api/search', (req, res, next) => { 
        // send 400 if any query parameters are not in query_param
        if(Object.keys(req.query).some((key) => !query_param.includes(key))) {
            res.status(400).send("valid parameters: category, gender, limit, name");
            next();
        }
        // get request object from query constructor
        let mongo_query = constructQuery(req);
        let limit;

        // use default limit if not included in request
        if(req.query.limit) {
            limit = parseInt(req.query.limit);
        } else {
            limit = 20;
        }
        // fetch response
        collection.find(mongo_query).limit(limit).toArray(function(err, result) {
            if (err) throw err;
            // replace all images with local whale.jpg if devmode="true"
            if(req.query.devmode == "true") {
                for(key in result) {
                    for(img in result[key]["img"]) {
                        result[key]["img"][img] = "http://fashionapi.herokuapp.com/whale.jpg"
                    }
                }
            }

            res.status(200).send(result);
            next();
        });
    });
}