const fs = require('fs');
const path = require('path');

const SUPPORTED_TRAIL_TYPES = ['foot', 'hiking'];

class TrailRepository {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }

    getRegions() {
        if (!fs.existsSync(this.rootDir)) return [];

        return fs.readdirSync(this.rootDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => this.toRegion(entry.name))
            .filter(region => region.types.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    }

    getFiles(regionKeys, trailTypes) {
        const regionMap = new Map(this.getRegions().map(region => [region.key, region]));
        const files = [];

        regionKeys.forEach(regionKey => {
            const region = regionMap.get(regionKey);
            if (!region) return;

            trailTypes.forEach(type => {
                if (!region.types.includes(type)) return;

                const typeDir = path.join(this.rootDir, region.key, type);
                fs.readdirSync(typeDir)
                    .filter(file => file.toLowerCase().endsWith('.gpx'))
                    .forEach(file => {
                        files.push({
                            filename: file,
                            region: region.key,
                            regionName: region.name,
                            trailType: type,
                            content: fs.readFileSync(path.join(typeDir, file), 'utf8')
                        });
                    });
            });
        });

        return files;
    }

    toRegion(directoryName) {
        const match = directoryName.match(/^(.+)-\d+$/);
        const regionDir = path.join(this.rootDir, directoryName);

        return {
            key: directoryName,
            name: match ? match[1] : directoryName,
            types: SUPPORTED_TRAIL_TYPES.filter(type => fs.existsSync(path.join(regionDir, type)))
        };
    }
}

module.exports = { SUPPORTED_TRAIL_TYPES, TrailRepository };
