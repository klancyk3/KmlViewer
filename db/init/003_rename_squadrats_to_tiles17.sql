ALTER TABLE IF EXISTS squadrats RENAME TO "Tiles17";
ALTER TABLE IF EXISTS gpx_trail_squadrats RENAME TO "gpx_trail_Tiles17";

ALTER TABLE IF EXISTS "gpx_trail_Tiles17"
    RENAME COLUMN squadrat_id TO tile17_id;

ALTER INDEX IF EXISTS uq_squadrats_indexes
    RENAME TO uq_tiles17_indexes;

ALTER INDEX IF EXISTS idx_gpx_trail_squadrats_squadrat_id
    RENAME TO idx_gpx_trail_tiles17_tile17_id;
