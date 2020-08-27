module.exports = function(ctx) {
    const db = ctx.db.db("Apparel");
    const server = ctx.server;
    const collection = db.collection("Items");

    server.get('/category/:category_id', (req, res, next) => {
        collection.find({"category": req.params.category_id}).toArray(function(err, result) {
            if (err) throw err;
            res.send(200, result)
            next()
        })

    })
    
    server.get('/all', (req, res, next) => {
        collection.find({}).toArray(function(err, result) {
            if (err) throw err;
            res.send(200, result)
            next()
        })

    })
}