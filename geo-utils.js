const GeoUtils = {
    calculateLineDistanceKm(coordinates) {
        let total = 0;

        for (let i = 1; i < coordinates.length; i++) {
            total += this.distanceBetweenKm(coordinates[i - 1], coordinates[i]);
        }

        return total;
    },

    distanceBetweenKm(p1, p2) {
        const earthRadiusKm = 6371.0088;
        const toRad = degrees => degrees * Math.PI / 180;
        const dLat = toRad(p2.lat - p1.lat);
        const dLon = toRad(p2.lon - p1.lon);
        const lat1 = toRad(p1.lat);
        const lat2 = toRad(p2.lat);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};
