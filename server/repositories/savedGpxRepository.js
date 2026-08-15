const fs = require('fs');
const path = require('path');

class SavedGpxRepository {
    constructor(gpxDir) {
        this.gpxDir = gpxDir;
    }

    ensureDirectory() {
        if (!fs.existsSync(this.gpxDir)) {
            fs.mkdirSync(this.gpxDir);
        }
    }

    save(filename, content, callback) {
        this.ensureDirectory();
        fs.writeFile(path.join(this.gpxDir, filename), content, callback);
    }

    list() {
        if (!fs.existsSync(this.gpxDir)) return [];

        return fs.readdirSync(this.gpxDir)
            .filter(file => file.toLowerCase().endsWith('.gpx'))
            .map(file => ({
                filename: file,
                content: fs.readFileSync(path.join(this.gpxDir, file), 'utf8')
            }));
    }
}

module.exports = { SavedGpxRepository };
