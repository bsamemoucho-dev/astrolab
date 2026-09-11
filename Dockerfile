# --- build & runtime ---
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080
ENV ASTROLAB_DB_PATH=/data/astrolab.json

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Rendu PDF automatique : facultatif, désactivé par défaut.
#
# Pourquoi un drapeau de construction : Chromium pèse plusieurs centaines de Mo
# dans l'image et quelques centaines de Mo de mémoire pour chaque conversion. Le
# tunnel payant ne doit pas dépendre d'un navigateur. Sans ce drapeau, l'image
# reste légère, le module de rendu ne charge rien, et le bouton PDF du site garde
# la fenêtre d'impression du navigateur.
#
# Pour l'activer :
#   docker build --build-arg WITH_PDF_RENDERER=true .
#   puis, sur le service : ASTROLAB_PDF_RENDERER=chromium
#
# `puppeteer-core` n'est pas déclaré dans package.json : il est installé ici, à
# version figée, pour ne pas ajouter de dépendance d'exécution au dépôt ni
# alourdir l'installation par défaut. Le verrou n'est pas modifié (`--no-save`).
#
# Les polices : le rendu a lieu sous Linux, où Georgia (Mac/Windows) n'existe pas.
# DejaVu fournit les glyphes astrologiques de la roue (♈…♓, ☉ ☽ ☿ ♀ ♂ ♃ ♄) et
# Liberation donne un serif proche de Times. Sans elles, Chromium dessinerait des
# carrés vides à la place des symboles.
ARG WITH_PDF_RENDERER=false
RUN if [ "$WITH_PDF_RENDERER" = "true" ]; then \
      apk add --no-cache chromium font-dejavu font-liberation && \
      npm install --no-save --no-package-lock puppeteer-core@25.10.0; \
    fi

COPY . .

EXPOSE 8080
VOLUME ["/data"]

CMD ["node", "src/server.mjs"]
