const { Tile17 } = require('../domain/tile17');

class Tile17BackfillService {
    constructor(tile17Repository, onProgress = null) {
        this.tile17Repository = tile17Repository;
        this.onProgress = onProgress;
    }

    async backfill() {
        const trails = await this.tile17Repository.getTrailGeometries();
        let processedTrails = 0;
        let linkedTiles17 = 0;

        this.reportProgress(0, trails.length, 'Preparing trails');

        for (const trail of trails) {
            const tiles17 = this.collectTiles17ForGeometry(trail.geometry, trail.trail_type === 'user');
            await this.tile17Repository.saveTrailTiles17(trail.id, tiles17);
            processedTrails += 1;
            linkedTiles17 += tiles17.length;
            this.reportProgress(processedTrails, trails.length, `Trail ${trail.id}`);
        }

        return {
            processedTrails,
            linkedTiles17
        };
    }

    reportProgress(current, total, detail) {
        if (typeof this.onProgress === 'function') {
            this.onProgress({ current, total, detail });
        }
    }

    collectTiles17ForGeometry(geometry, withBreaks) {
        if (!geometry) return [];
        if (geometry.type === 'LineString') {
            return Tile17.collectForLineString(
                geometry.coordinates.map(([lon, lat]) => ({ lon, lat })), withBreaks
            );
        }

        if (geometry.type === 'MultiLineString') {
            const unique = new Map();

            geometry.coordinates.forEach(line => {
                Tile17.collectForLineString(line.map(([lon, lat]) => ({ lon, lat })), withBreaks).forEach(tile17 => {
                    unique.set(`${tile17.index_ne}:${tile17.index_we}`, tile17);
                });
            });

            return Array.from(unique.values()).sort(
                (a, b) => a.index_ne - b.index_ne || a.index_we - b.index_we
            );
        }

        return [];
    }
}

module.exports = { Tile17BackfillService };
