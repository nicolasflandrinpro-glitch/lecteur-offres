# Journal des versions du kit lecteur d'offres

## 5.0 (en préparation)

- Contenu commun publié sur ce dépôt GitHub, en version figée par tag ; Notion ne garde que la configuration de chaque utilisateur.
- Modèle Notion 5 : modèle 4 plus les lignes Paramètres « Dernier débrief » et « Version du kit ». Créé par l'installeur à partir de schema/configuration.json (plus de modèle à dupliquer).
- Brique Offres 1.9 : manuel téléchargé par le shell et contrôlé par son empreinte ; script écrit dans le prompt des tâches (le mode d'approbation automatique refuse d'exécuter un script téléchargé) ; débrief écrit dans « Dernier débrief », y compris en mode sans écriture ; modèle 4 toléré, modèle 3 refusé.
- Brique Offres 1.9, complément du 25/10 : fusion des offres de même entreprise et de même titre dans un même passage (première lue gardée, lieux regroupés, compteur doublons_passage, lignes FUSION) ; offres relayées par LinkedIn d'une plateforme suivie en direct comptées en doublons entre plateformes ; contrôles de retrait un par un, page en ligne seulement si le contenu de l'offre est affiché ; relecture de Offres après création obligatoire.
- Lecteur 19.4 : page de configuration trouvée malgré une apostrophe typographique, du gras ou des espaces dans son titre ; champ « Colle le lien de ta page de configuration », lien retenu dans le navigateur ; modèles Notion 5 et 4 acceptés ; renvois vers la page d'accueil du kit au lieu du modèle Notion à dupliquer ; sans accès à Notion, roue dentée masquée et état de la permission lu (autoriser, accès refusé avec ouverture du panneau Permissions, accès indisponible) ; réglages robustes à des paramètres incomplets. Tests jsdom dans lecteur/tests/ (126 contrôles).
- Procédures (procedures/) : installer, mettre à jour, ajouter une plateforme, régler mes critères, lire un débrief. Questions posées par cartes à choix ; fichiers du dépôt téléchargés au tag et contrôlés par leur empreinte.
- Skills (skills/) : cinq skills qui téléchargent leur procédure à la version du kit installée (ligne Paramètres « Version du kit ») et l'appliquent ; proposées par l'installeur.
- Extension Chrome 0.6 (extension/) : code inchangé, archive identique à celle du kit 4.
- Page d'accueil (docs/index.html, publiée par GitHub Pages) : ce que fait le kit, prérequis, prompt d'installation à coller dans Cowork, questions fréquentes.
- Correctifs de l'essai réel (27/10/2026) :
  - Modèle Notion 6 : ligne Paramètres « Prochain passage ». Avant de lancer un passage sans écriture ou un test de source, le lecteur et Claude y écrivent la demande ; la tâche la lit puis l'efface (valable 30 minutes). Le mode ne dépend plus du texte ajouté au lancement, qui n'arrivait pas toujours.
  - Brique Offres 1.10 : mode `--consigne` du script ; une écriture refusée par Notion ne se contourne plus (passage en échec partiel, date du dernier passage inchangée) ; lignes du script recopiées telles quelles dans le débrief ; « opportunité » ajouté à la recherche des expéditeurs non suivis ; modèles 5 et 4 tolérés.
  - Colonne Offres « Métier » : une option par poste recherché, créée à l'installation et ajoutée par « régler mes critères » (sans elle, Notion refusait les offres).
  - Procédures et skills : bases Notion lues seulement par leur vue, en mode vue (le mode SQL épuise un quota de l'espace Notion) ; « ajouter une plateforme » propose de relire les alertes des 7 derniers jours ; le bilan de la mise à jour résume les nouveautés ; l'installeur ne contrôle plus le texte des formules, que le connecteur Notion ne rend pas.
  - Lecteur 19.5 : écrit la demande de test dans « Prochain passage » avant le lancement ; modèles 6, 5 et 4 acceptés.
