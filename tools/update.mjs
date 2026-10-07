// On-demand refresh: pull changed regions (read-only), rebuild the map data, publish the site.
// `--no-publish` stops after the rebuild so the result can be checked locally first.
import { syncRegions } from './sync-regions.mjs';
import { syncWishes } from './sync-wishes.mjs';
import { buildMap } from './build-map.mjs';
import { publish } from './publish.mjs';

const noPublish = process.argv.includes('--no-publish');

try {
  await syncRegions();
  await syncWishes();
  const meta = await buildMap();
  if (noPublish) {
    console.log('skipped publishing (--no-publish)');
  } else {
    publish({ message: `Map update ${meta.generatedAt}` });
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
