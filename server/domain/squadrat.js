const TILE_ZOOM = 17;
const MAX_LATITUDE = 85.05112878;

class Squadrat {
    constructor({ index_ne, index_we, min_lon, max_lon, min_lat, max_lat }) {
        this.index_ne = index_ne;
        this.index_we = index_we;
        this.min_lon = min_lon;
        this.max_lon = max_lon;
        this.min_lat = min_lat;
        this.max_lat = max_lat;
    }

    static fromTile(index_ne, index_we, zoom = TILE_ZOOM) {
        return new Squadrat({
            index_ne,
            index_we,
            min_lon: tileXToLon(index_we, zoom),
            max_lon: tileXToLon(index_we + 1, zoom),
            min_lat: tileYToLat(index_ne + 1, zoom),
            max_lat: tileYToLat(index_ne, zoom)
        });
    }

    static collectForLineString(coordinates, zoom = TILE_ZOOM) {
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            return [];
        }

        const tileKeys = new Set();

        for (let i = 0; i < coordinates.length; i += 1) {
            const current = lonLatToTileFraction(coordinates[i].lon, coordinates[i].lat, zoom);
            addTileKey(tileKeys, Math.floor(current.x), Math.floor(current.y));

            if (i === 0) continue;

            const previous = lonLatToTileFraction(coordinates[i - 1].lon, coordinates[i - 1].lat, zoom);
            supercoverTiles(previous.x, previous.y, current.x, current.y).forEach(({ x, y }) => {
                addTileKey(tileKeys, x, y);
            });
        }

        return Array.from(tileKeys)
            .map(key => key.split(':').map(Number))
            .sort(([aY, aX], [bY, bX]) => aY - bY || aX - bX)
            .map(([index_ne, index_we]) => Squadrat.fromTile(index_ne, index_we, zoom));
    }
}

function addTileKey(tileKeys, x, y) {
    tileKeys.add(`${y}:${x}`);
}

function lonLatToTileFraction(lon, lat, zoom) {
    const scale = 2 ** zoom;
    const safeLat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
    const latRad = safeLat * Math.PI / 180;
    const x = ((lon + 180) / 360) * scale;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

    return {
        x: clampTileCoordinate(x, scale),
        y: clampTileCoordinate(y, scale)
    };
}

function clampTileCoordinate(value, scale) {
    if (value < 0) return 0;
    if (value >= scale) return scale - Number.EPSILON;
    return value;
}

function tileXToLon(x, zoom) {
    return (x / (2 ** zoom)) * 360 - 180;
}

function tileYToLat(y, zoom) {
    const n = Math.PI - (2 * Math.PI * y) / (2 ** zoom);
    return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function supercoverTiles(x0, y0, x1, y1) {
    const tiles = [];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    if (steps === 0) {
        return [{ x: Math.floor(x0), y: Math.floor(y0) }];
    }

    for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        tiles.push({
            x: Math.floor(x0 + dx * t),
            y: Math.floor(y0 + dy * t)
        });
    }

    return dedupeTiles(tiles);
}

function dedupeTiles(tiles) {
    const seen = new Set();
    return tiles.filter(tile => {
        const key = `${tile.y}:${tile.x}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

module.exports = {
    Squadrat,
    TILE_ZOOM
};
