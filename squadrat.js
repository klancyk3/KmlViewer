class Squadrat {
    constructor(longitude, latitude) {
        this.longitude = Number(longitude);
        this.latitude = Number(latitude);
        
        // Aliases for l1 (longitude) and l2 (latitude)
        this.l1 = this.longitude;
        this.l2 = this.latitude;
    }

    IsSame(otherValue) {
        // Convert the difference in degrees to meters.
        // 1 degree of latitude is approximately 111,320 meters.
        const latDiffMeters = Math.abs(otherValue.l2 - this.l2) * 111320;
        
        // 1 degree of longitude is approximately 111,320 * cos(latitude) meters.
        const avgLat = (this.l2 + otherValue.l2) / 2;
        const lonDiffMeters = Math.abs(otherValue.l1 - this.l1) * 111320 * Math.cos(avgLat * Math.PI / 180);

        return lonDiffMeters < 2 && latDiffMeters < 2;
    }
}
