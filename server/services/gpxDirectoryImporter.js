const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

class GpxDirectoryImporter {
    constructor({ sourceDir, importRepository }) {
        this.sourceDir = sourceDir;
        this.importRepository = importRepository;
        this.parser = new DOMParser();
    }

    async import() {
        const summary = {
            filesSeen: 0,
            filesImported: 0,
            segmentsImported: 0,
            error: null
        };
        const runId = await this.importRepository.createRun(this.sourceDir);

        try {
            const files = this.findGpxFiles(this.sourceDir);
            summary.filesSeen = files.length;

            for (const filePath of files) {
                const segments = this.parseFile(filePath);

                for (const segment of segments) {
                    await this.importRepository.upsertTrailSegment(segment);
                    summary.segmentsImported += 1;
                }

                if (segments.length > 0) {
                    summary.filesImported += 1;
                }
            }
        } catch (err) {
            summary.error = err.message;
            throw err;
        } finally {
            await this.importRepository.finishRun(runId, summary);
        }

        return summary;
    }

    findGpxFiles(directory) {
        if (!fs.existsSync(directory)) return [];

        return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return this.findGpxFiles(entryPath);
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.gpx')) return [entryPath];
            return [];
        });
    }

    parseFile(filePath) {
        const xmlDoc = this.parser.parseFromString(fs.readFileSync(filePath, 'utf8'), 'text/xml');
        const tracks = this.getElements(xmlDoc, 'trk');
        const context = this.getFileContext(filePath);
        const defaultMetadata = this.getMetadata(xmlDoc);
        const segments = [];
        let segmentIndex = 0;

        tracks.forEach(track => {
            const trackName = this.getNodeValue(track, 'name') || path.basename(filePath, '.gpx');
            const metadata = { ...defaultMetadata, ...this.getMetadata(track) };
            const colour = metadata.colour || metadata.color || null;

            this.getElements(track, 'trkseg').forEach(trackSegment => {
                const coordinates = this.getElements(trackSegment, 'trkpt')
                    .map(point => this.parsePoint(point))
                    .filter(Boolean);

                if (coordinates.length < 2) return;

                segments.push({
                    ...context,
                    sourceFile: path.relative(this.sourceDir, filePath).replace(/\\/g, '/'),
                    sourceFileName: path.basename(filePath),
                    trackName,
                    segmentIndex,
                    pointCount: coordinates.length,
                    colour,
                    metadata,
                    wkt: this.toLineStringWkt(coordinates)
                });
                segmentIndex += 1;
            });
        });

        return segments;
    }

    getFileContext(filePath) {
        const relativeParts = path.relative(this.sourceDir, filePath).split(path.sep);
        const regionKey = relativeParts[0] || null;
        const trailType = relativeParts[1] || null;
        const regionMatch = regionKey ? regionKey.match(/^(.+)-\d+$/) : null;

        return {
            regionKey,
            regionName: regionMatch ? regionMatch[1] : regionKey,
            trailType
        };
    }

    parsePoint(pointNode) {
        const lat = parseFloat(pointNode.getAttribute('lat'));
        const lon = parseFloat(pointNode.getAttribute('lon'));

        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

        return { lat, lon };
    }

    toLineStringWkt(coordinates) {
        return `LINESTRING(${coordinates.map(point => `${point.lon} ${point.lat}`).join(',')})`;
    }

    getMetadata(node) {
        const metadata = {};
        ['relation_id', 'route', 'name', 'network', 'operator', 'colour', 'color'].forEach(key => {
            const value = this.getNodeValue(node, key);
            if (value) metadata[key] = value;
        });
        return metadata;
    }

    getNodeValue(parent, tagName) {
        const node = this.getElements(parent, tagName)[0];
        return node ? node.textContent.trim() : null;
    }

    getElements(parent, tagName) {
        return Array.from(parent.getElementsByTagName('*'))
            .filter(node => node.localName === tagName || node.tagName === tagName);
    }
}

module.exports = { GpxDirectoryImporter };
