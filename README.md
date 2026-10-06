# Map history

One commit per map refresh, for a timelapse. Never force-pushed.

- `snapshot.json`: `takenAt` (when the map was built), `spawn`, `regions` ([rx, rz] pairs).
- `regions/r.X.Z.terrain.gz`: gzip of u32 LE header length, JSON `{ palette }` (block ids),
  then 512x512 bytes of block (0 = no data, else palette index + 1) and 512x512 bytes of shade
  (0 dark, 1 flat, 2 light), rows north to south. Written by `tools/build-map.mjs` on `main`.
