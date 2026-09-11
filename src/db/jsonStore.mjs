import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

// Le fichier d'état contient des hachés de mots de passe, des jetons de session
// et des données de naissance : il n'a aucune raison d'être lisible par un autre
// utilisateur de la machine. Ces modes sont soumis à l'umask, qui ne peut que
// restreindre davantage.
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

export function createEmptyState() {
  return {
    users: [],
    sessions: [],
    persons: [],
    birthData: [],
    dataPoints: [],
    dataSources: [],
    relationships: [],
    analyses: [],
    analysisVersions: [],
    methodResults: [],
    transversalFindings: [],
    calculationRuns: [],
    calculationArtifacts: [],
    reports: [],
    deliverables: [],
    deliverableVersions: [],
    orders: [],
    publicReadings: [],
    accessCodes: [],
    creditLedger: [],
    auditLogs: [],
    methods: [
      {
        id: "western-natal",
        tradition: "western_astrology",
        school: "hellenistic",
        name: "Western Natal V1 development calculator",
        status: "laboratory",
        productionEligible: false,
        documentationStatus: "partial_documentation_no_rule_version",
        version: "0.1.0-draft",
        sources: [
          "docs/methods/western-natal.md",
          "docs/corpora/hellenistic/claims/valens.md",
          "docs/corpora/hellenistic/claims/dorotheus.md",
          "docs/corpora/hellenistic/claims/ptolemy.md"
        ],
        notes: "Deterministic development calculation for tropical zodiac and Whole Sign houses. No interpretive RuleVersion is active."
      },
      {
        id: "western.placeholder",
        tradition: "western_astrology",
        school: null,
        name: "Western astrology module placeholder",
        status: "not_implemented",
        productionEligible: false,
        documentationStatus: "documentation_insufficient",
        version: "0.0.0",
        sources: [],
        notes: "Interface placeholder only. No methodological rule is implemented."
      },
      {
        id: "jyotisha.placeholder",
        tradition: "jyotisha",
        school: null,
        name: "Jyotisha module placeholder",
        status: "not_implemented",
        productionEligible: false,
        documentationStatus: "documentation_insufficient",
        version: "0.0.0",
        sources: [],
        notes: "Interface placeholder only. No methodological rule is implemented."
      }
    ],
    outbox: []
  };
}

export class JsonStore {
  constructor(filePath, initialState = createEmptyState()) {
    this.filePath = filePath;
    this.initialState = initialState;
    this.state = structuredClone(initialState);
    this.loaded = false;
    // File d'attente des transactions : voir `transact`.
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.loaded) {
      return this.state;
    }

    if (!this.filePath) {
      this.loaded = true;
      return this.state;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = {
        ...createEmptyState(),
        ...JSON.parse(raw)
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await this.save();
    }

    this.loaded = true;
    return this.state;
  }

  async save() {
    if (!this.filePath) {
      return;
    }

    const contenu = `${JSON.stringify(this.state, null, 2)}\n`;
    await mkdir(dirname(this.filePath), { recursive: true, mode: DIR_MODE });

    // Écriture atomique : on écrit à côté, puis on renomme. `rename` sur le même
    // système de fichiers est atomique — un lecteur voit soit l'ancien fichier
    // entier, soit le nouveau, jamais un JSON tronqué. L'écriture directe
    // précédente ouvrait en mode « w », donc tronquait d'abord : une coupure
    // (SIGKILL, OOM, redéploiement) pendant l'écriture laissait un fichier
    // invalide, et comme `load()` ne rattrape que l'absence de fichier, toutes
    // les requêtes échouaient ensuite, définitivement.
    const temporaire = `${this.filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    try {
      await writeFile(temporaire, contenu, { encoding: "utf8", mode: FILE_MODE });
      await rename(temporaire, this.filePath);
    } catch (error) {
      // Ne pas laisser de fichier temporaire derrière soi : ils s'accumuleraient
      // à chaque échec d'écriture.
      await unlink(temporaire).catch(() => {});
      throw error;
    }
  }

  async transact(mutator) {
    await this.load();
    // Les transactions sont sérialisées. Sans cela, deux requêtes simultanées
    // partageaient le même objet `state` et pouvaient écrire le fichier en même
    // temps ; pire, l'annulation sur erreur (`this.state = before`) pouvait
    // rétablir un instantané antérieur et effacer une transaction concurrente
    // déjà enregistrée. Le mutateur est synchrone dans tout le dépôt, donc
    // attendre la transaction précédente suffit à garantir que chacune voit
    // l'état laissé par la précédente.
    const execution = this.queue.then(async () => {
      const before = structuredClone(this.state);
      try {
        const result = await mutator(this.state);
        await this.save();
        return result;
      } catch (error) {
        this.state = before;
        throw error;
      }
    });
    // La file ne doit jamais rester rejetée : une transaction en échec ne bloque
    // pas les suivantes, et l'appelant reçoit quand même l'erreur (`execution`).
    this.queue = execution.then(
      () => undefined,
      () => undefined
    );
    return execution;
  }

  id(prefix) {
    return `${prefix}_${randomUUID()}`;
  }
}
