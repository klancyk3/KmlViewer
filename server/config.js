const path = require('path');

function createConfig(env = process.env) {
    return {
        port: env.PORT || 5174,
        externalGpxDir: env.EXTERNAL_GPX_DIR || 'D:\\Maps\\Gpx',
        userGpxDir: env.USER_GPX_DIR || 'D:\\Maps\\UserGpx',
        localGpxDir: path.join(__dirname, '..', 'gpxes'),
        databaseUrl: env.DATABASE_URL || null
    };
}

module.exports = { createConfig };
