import { normalizeMethodModule } from "../core/validation.mjs";

export async function listMethodRegistry(store) {
  const state = await store.load();
  return state.methods.map((method) => normalizeMethodModule(method));
}

