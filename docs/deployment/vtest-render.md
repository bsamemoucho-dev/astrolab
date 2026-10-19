# Déployer Vtest sur Render (service isolé)

Ce document décrit le déploiement d'une **préversion** de Lastro sur un service
Render **distinct** de la production. Il ne modifie ni `lastro.fr`, ni son
service Render, ni son disque, ni ses variables.

- Service : `lastro-vtest`
- Branche : `vtest` (jamais `main`)
- Blueprint : [`render.yaml`](../../render.yaml)
- URL de travail : `https://lastro-vtest.onrender.com`, puis `https://vtest.lastro.fr`

Ce que la configuration isole :

| Élément | Production | Vtest |
|---|---|---|
| Conteneur | service `main` | service `vtest` distinct |
| Données | disque de production | disque `/var/data` du service de test |
| Stripe | clés live | **aucune clé** → paiement impossible |
| E-mail | Brevo live | **aucune clé** → file interne, aucun envoi |
| Indexation | autorisée | `ASTROLAB_NOINDEX=1` (en-tête + robots.txt) |
| Accès | public | mot de passe (`ASTROLAB_PREVIEW_AUTH`) |
| Dépense LLM | non plafonnée | `ASTROLAB_LLM_BUDGET_USD` |

---

## 1. GitHub — publier la branche de test

La branche `vtest` existe en local, avec le travail éditorial et l'accueil. Elle
doit être poussée **sur son propre nom** (aucun push sur `main`) :

```bash
cd /Volumes/SSDA/HarnessDeepSeek/AstroLab
git log --oneline -3
git push -u origin vtest
```

Si `git push` refuse pour authentification :

```bash
gh auth login          # connexion par navigateur, aucun secret à me transmettre
# ou : ouvre GitHub → Settings → Developer settings → Personal access tokens
#      puis utilise ce jeton comme mot de passe du push (scope « repo »)
```

Rien à faire sur `main` : elle n'est pas utilisée par ce service.

## 2. Render — créer le service

### Voie A (recommandée) : Blueprint

1. Render → **New +** → **Blueprint**.
2. Choisir le dépôt `bsamemoucho-dev/astrolab` (autoriser l'accès GitHub si demandé).
3. Render lit `render.yaml` : service `lastro-vtest`, branche `vtest`, disque
   `/var/data`, sondage `/healthz`, variables non secrètes déjà remplies.
4. Il demande les variables `sync: false` (voir §3), puis crée le service.

### Voie B : service manuel

1. **New +** → **Web Service** → même dépôt.
2. Name `lastro-vtest`, Branch `vtest`, Runtime **Docker**, Dockerfile
   `./Dockerfile`, Region `oregon`, Plan `Starter`.
3. **Advanced** → Health Check Path `/healthz`.
4. **Disks** → Add Disk : Name `lastro-vtest-data`, Mount Path `/var/data`, 1 GB.
5. **Environment** → recopier les variables du §3.

> Le plan gratuit de Render n'accepte pas de disque persistant : sans disque, les
> comptes et dossiers de test disparaissent à chaque redéploiement. C'est
> utilisable pour une démonstration, pas pour des essais suivis.

## 3. Variables d'environnement

Non secrètes (déjà dans `render.yaml`) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `ASTROLAB_DB_PATH` | `/var/data/astrolab.json` |
| `ASTROLAB_ENABLE_COMMERCE` | `0` |
| `ASTROLAB_ALLOW_FREE_READINGS` | `1` |
| `ASTROLAB_ALLOW_REGISTRATION` | `1` |
| `ASTROLAB_EMAIL_MODE` | `dev_code` |
| `ASTROLAB_NOINDEX` | `1` |
| `ASTROLAB_LLM_BUDGET_USD` | `0.50` |
| `ASTROLAB_LLM_BUDGET_PATH` | `/var/data/llm-budget.json` |
| `ASTROLAB_LLM_BASE_URL` | `https://api.openai.com/v1` |
| `ASTROLAB_LLM_MODEL` | `gpt-4o-mini` |

À saisir dans Render (Dashboard → service → **Environment**) — ce sont les seules
valeurs sensibles, elles ne figurent ni dans le dépôt ni dans ce document :

| Variable | Valeur | Rôle |
|---|---|---|
| `ASTROLAB_PREVIEW_AUTH` | `utilisateur:motdepasse` | **obligatoire** : sans elle, la préversion est ouverte et génère des lectures gratuites |
| `PUBLIC_BASE_URL` | `https://lastro-vtest.onrender.com` (puis `https://vtest.lastro.fr`) | base des liens de récupération ; **absente, la génération répond 503** |
| `ASTROLAB_LLM_API_KEY` | la clé du rédacteur, ou rien | sans clé : dossiers en brouillon technique complet, coût nul |
| `STRIPE_*`, `BREVO_*` | **ne pas les mettre** | leur présence réactiverait le paiement / l'envoi réel |

Un mot de passe long (20 caractères ou plus) est préférable : l'authentification
est en Basic, protégée par HTTPS mais sans second facteur.

## 4. Premier déploiement et vérification

1. Render → service → **Manual Deploy** → *Deploy latest commit*.
2. Logs : `Lastro running`, `stockage : /var/data/astrolab.json`, `paiement non configuré`.
3. Vérifications :

```bash
BASE=https://lastro-vtest.onrender.com

curl -s $BASE/healthz                      # {"ok":true,...}
curl -sI $BASE/ | head -5                  # 401 sans identifiants
curl -s -u "user:motdepasse" $BASE/api/config | head -c 400
curl -s -u "user:motdepasse" $BASE/ | grep -o "Votre signe n’est que" | head -1
```

4. Parcours complet, avec les données de test intégrées :

```bash
ASTROLAB_PREVIEW_AUTH="user:motdepasse" \
  node tools/vtest-smoke.mjs --base $BASE --require-llm
```

Ce script vérifie : santé, accueil (nouveau texte), `noindex`, `robots.txt`
fermé, absence de Stripe/Brevo, plafond LLM, génération d'un dossier fictif,
annexe des aspects et marge d'incertitude, lien de récupération. Sans
`--require-llm`, un dossier en brouillon technique est considéré comme normal.

## 5. Cloudflare — connecter `vtest.lastro.fr`

1. Cloudflare → zone `lastro.fr` → **DNS** → *Add record* :
   - Type **CNAME**, Name `vtest`, Target `lastro-vtest.onrender.com`
   - Proxy status **DNS only** (nuage gris) : Render doit voir la requête pour
     délivrer son certificat.
2. Render → service → **Settings** → **Custom Domains** → *Add* →
   `vtest.lastro.fr`. Render affiche l'enregistrement attendu (identique à
   l'étape 1) puis émet le certificat.
3. Quand le domaine répond, mettre à jour `PUBLIC_BASE_URL` =
   `https://vtest.lastro.fr`, puis redéployer (les liens déjà envoyés restent
   valables).
4. Vérifier : `curl -sI https://vtest.lastro.fr/healthz`.

Aucun enregistrement existant n'est modifié : `lastro.fr` et `www` restent
inchangés.

## 6. Ce que Vtest exécute réellement

| Partie | Moteur |
|---|---|
| Calcul astronomique, socle factuel, annexe des aspects | déterministe, identique à la production |
| Plan éditorial (figures, licences de croisement, idées uniques) | **nouveau** (`buildFullDossierPlan`, `aspectChapterMode: "reference"`) |
| Hypothèses de lecture multiples | **nouveau**, seulement quand la dissymétrie le justifie |
| Rédaction des sections | **nouveau** écrivain structuré + validateurs factuels, avec repli brouillon si aucune clé |
| Plafond de dépense | **nouveau** (`ASTROLAB_LLM_BUDGET_USD`, registre `/var/data/llm-budget.json`) |
| Paiement | désactivé |
| E-mail | désactivé (file interne) |
| Migration sémantique des règles | **partielle** : 5 règles sur 372 ; les autres passent par le mécanisme historique |

## 7. Retour arrière

Vtest est supprimable sans toucher à la production :

1. Cloudflare → supprimer l'enregistrement `CNAME vtest`.
2. Render → service `lastro-vtest` → **Settings** → *Suspend* (ou *Delete*).
3. Supprimer le disque `lastro-vtest-data` si le service est supprimé.

Le service de production, son disque et ses variables ne sont jamais référencés
par ce déploiement : la suppression de Vtest laisse `lastro.fr` strictement
identique.

## 8. Points de vigilance

- **Sans `ASTROLAB_PREVIEW_AUTH`**, l'URL Render est publique : lectures gratuites
  et comptes ouverts à qui la trouve. Les tests le vérifient côté code, pas côté
  hébergeur.
- **Sans `PUBLIC_BASE_URL`**, la génération répond 503 (les liens de livraison ne
  peuvent pas être construits).
- **Une clé LLM sur Vtest dépense réellement** : le plafond coupe l'appel
  *suivant* quand le montant serait dépassé, il ne rembourse pas l'appel en cours.
- `autoDeploy: false` : un push sur `vtest` ne redéploie pas automatiquement.
  C'est voulu, pour que la préversion ne change pas sous vos pieds.
