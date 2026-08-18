class Tile17 {
    constructor(longitude, latitude) {
        this.longitude = Number(longitude);
        this.latitude = Number(latitude);

        this.l1 = this.longitude;
        this.l2 = this.latitude;
    }

    IsSame(otherValue) {
        const latDiffMeters = Math.abs(otherValue.l2 - this.l2) * 111320;
        const avgLat = (this.l2 + otherValue.l2) / 2;
        const lonDiffMeters = Math.abs(otherValue.l1 - this.l1) * 111320 * Math.cos(avgLat * Math.PI / 180);

        return lonDiffMeters < 2 && latDiffMeters < 2;
    }
}
