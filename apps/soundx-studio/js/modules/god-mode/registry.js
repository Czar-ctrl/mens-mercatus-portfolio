/**
 * God Mode feature registry — id → feature def.
 * Features register via side-effect imports; hub renders listFeatures().
 */
const features = new Map();

export function registerFeature(def) {
  if (!def?.id || !def?.title) throw new Error('feature needs id+title');
  features.set(def.id, def);
}

export function listFeatures() {
  return [...features.values()];
}

export function getFeature(id) {
  return features.get(id) || null;
}
