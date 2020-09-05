module.exports = {
    name: 'fashion-api',
    version: '0.0.1',
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    db: {
        uri: process.env.MONGODB_URI
    }
}