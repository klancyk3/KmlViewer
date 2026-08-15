const path = require('path');

function createConfig(env = process.env) {
    return {
        port: env.PORT || 5174,
        externalGpxDir: env.EXTERNAL_GPX_DIR || 'D:\\Maps\\Gpx',
        localGpxDir: path.join(__dirname, '..', 'gpxes')
    };
}

module.exports = { createConfig };
