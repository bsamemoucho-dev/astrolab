import { loadDotEnv } from "./env.mjs";

loadDotEnv(); // charge .env (racine du projet) avant toute lecture de process.env

import { createApp } from "./http/app.mjs";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST; // absent → écoute IPv6+IPv4 (localhost et 127.0.0.1)
const { server } = createApp();

if (host) {
  server.listen(port, host, onListen);
} else {
  server.listen(port, onListen);
}

function onListen() {
  console.log(`Lastro running at http://localhost:${port}`);
}
