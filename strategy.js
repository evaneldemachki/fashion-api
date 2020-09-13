const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const passwordHash = require('password-hash');


module.exports = function(passport, query) {
    passport.use(new LocalStrategy(
        function(username, password, done) {
            query.getUserCredentials(username).then(cred => {
                if(!cred) {
                    return done(null, false, { message: "User does not exist"});
                }
                if(passwordHash.verify(password, cred.password)) {
                    return done(null, cred);
                } else {
                    return done(null, false, { message: "Incorrect password" });
                }
            })
        }
    ));

    let opts = {}
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    opts.secretOrKey = 'secret';
    //opts.issuer = 'accounts.examplesoft.com';
    //opts.audience = 'yoursite.net';
    passport.use(new JwtStrategy(opts, function(jwt_payload, done) {
        return done(null, jwt_payload.data);
    }));
}