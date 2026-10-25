# Journal des versions du kit lecteur d'offres

## 5.0 (en préparation)

- Contenu commun publié sur ce dépôt GitHub, en version figée par tag ; Notion ne garde que la configuration de chaque utilisateur.
- Modèle Notion 5 : modèle 4 plus la ligne Paramètres « Dernier débrief ». Créé par l'installeur à partir de schema/configuration.json (plus de modèle à dupliquer).
- Brique Offres 1.9 : manuel et script téléchargés par le shell et contrôlés par leur empreinte ; débrief écrit dans « Dernier débrief », y compris en mode sans écriture ; modèle 4 toléré, modèle 3 refusé.
- Brique Offres 1.9, complément du 25/10 : fusion des offres de même entreprise et de même titre dans un même passage (première lue gardée, lieux regroupés, compteur doublons_passage, lignes FUSION) ; offres relayées par LinkedIn d'une plateforme suivie en direct comptées en doublons entre plateformes ; contrôles de retrait un par un, page en ligne seulement si le contenu de l'offre est affiché ; relecture de Offres après création obligatoire.
- Lecteur 19.4 : page de configuration trouvée malgré une apostrophe typographique, du gras ou des espaces dans son titre ; champ « Colle le lien de ta page de configuration », lien retenu dans le navigateur ; modèles Notion 5 et 4 acceptés ; renvois vers la page d'accueil du kit au lieu du modèle Notion à dupliquer ; sans accès à Notion, roue dentée masquée et état de la permission lu (autoriser, accès refusé avec ouverture du panneau Permissions, accès indisponible) ; réglages robustes à des paramètres incomplets. Tests jsdom dans lecteur/tests/ (126 contrôles).
