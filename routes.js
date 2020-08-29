module.exports = function(ctx) {
    const db = ctx.db.db("Apparel");
    const server = ctx.server;
    const collection = db.collection("Items");

    server.get('/api/search', (req, res, next) => {
        let mongo_query = {};
        let limit;
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
        })
    })
}