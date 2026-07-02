// A small synthetic sales dataset for the demo. Each row is a plain object; the
// numeric fields (`units`, `revenue`) are the measures/values, the rest are
// dimensions you can drag around.

const regions = ['North', 'South', 'East', 'West'];
const products = ['Widget', 'Gadget', 'Gizmo'];
const channels = ['Online', 'Retail'];
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

export const sampleData = [];

let seed = 42;
function rand() {
  // deterministic pseudo-random so the demo looks the same every load
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

for (const region of regions) {
  for (const product of products) {
    for (const channel of channels) {
      for (const quarter of quarters) {
        const units = Math.floor(rand() * 100) + 1;
        sampleData.push({
          region,
          product,
          channel,
          quarter,
          units,
          revenue: units * (Math.floor(rand() * 40) + 10),
        });
      }
    }
  }
}

export const dimensions = ['region', 'product', 'channel', 'quarter'];
export const values = ['units', 'revenue'];
