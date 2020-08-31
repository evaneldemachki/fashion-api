module.exports = function(ctx) {
    const db = ctx.db.db("Apparel");
    const server = ctx.server;
    const collection = db.collection("Items");
    
    const query_param = ["category", "gender", "limit"]

    server.get('/api/search', (req, res, next) => {
        let mongo_query = {};
        let limit;
        
        // send 400 if any query parameters are not in query_param
        if(Object.keys(req.query).some((key) => !(key in query_param))) {
            res.status(400).send('valid parameters: ["category", "gender", "limit"]');
            next();
        }
        if(req.query.category) {
            mongo_query["category"] = req.query.category;
        }
        if(req.query.gender) {
            mongo_query["gender"] = req.query.gender;
        }
        if(req.query.limit) {
            limit = parseInt(req.query.limit)
        } else {
            limit = 20
        }

        collection.find(mongo_query).limit(limit).toArray(function(err, result) {
            if (err) throw err;
            res.status(200).send(result);
            next();
        });
    });
    
    // developer route: returns placeholder images for testing purposes
    server.get('/api/search-dev', (req, res, next) => {
        let mongo_query = {};
        let limit;
        
        // send 400 if any query parameters are not in query_param
        if(Object.keys(req.query).some((key) => !(key in query_param))) {
            res.status(400).send('valid parameters: ["category", "gender", "limit"]');
            next();
        }
        if(req.query.category) {
            mongo_query["category"] = req.query.category;
        }
        if(req.query.gender) {
            mongo_query["gender"] = req.query.gender;
        }
        if(req.query.limit) {
            limit = parseInt(req.query.limit)
        } else {
            limit = 20
        }

        collection.find(mongo_query).limit(limit).toArray(function(err, result) {
            if (err) throw err;
            for(key in result) {
                for(img in result[key]["img"]) {
                    result[key]["img"][img] = "http://fashionapi.herokuapp.com/whale.jpg"
                }
            }
            
            res.status(200).send(result);
            next();
        });
    });

}