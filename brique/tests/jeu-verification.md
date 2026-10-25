# Brique Offres 1.9 : jeu de vérification (25/10/2026)

Script vérifié : brique/offres.py, empreinte sha256 `15f7c496799cdfb690dca30c7f38865aa8fd9bd8ccc60de39ca88af16f82c4bc` (360 lignes).
Version précédente : brique 1.8, empreinte `10e6acea77a5a7b6c65b0397b3b89fd368cd20b90c0e6173630ee889fd7150bd` (338 lignes, 106 contrôles).
Lancement : `python3 brique/tests/test_offres.py brique/offres.py`. Résultat au 25/10/2026 : 121/121 contrôles OK.

Écarts avec la 1.8 : modèle 5 attendu et modèle 4 toléré (le modèle 3 est refusé) ; en modèle 4, expéditeurs détectés et test de source restent écrits, seul le débrief n'est pas écrit (ligne « Dernier débrief » absente) ; plus de repli Gmail sans ligne Messagerie ; nouvelle ligne DEBRIEF ; avertissement qui renvoie à la procédure « mettre à jour ». Contrôles 94 à 96 et 101 réécrits pour le modèle 4, contrôles 107 à 111 ajoutés.

Complément du 25/10 (constats du passage du 25/10) : fusion des offres de même entreprise et de même titre dans un même passage (première lue gardée, lieux regroupés « ; », compteur doublons_passage, lignes FUSION ; entreprise vide jamais fusionnée) ; offres d'une plateforme suivie en direct relayées par LinkedIn comptées en doublons entre plateformes (règle du manuel, identité vérifiée par le script). Contrôle 83 : titres rendus distincts (sinon fusionnés). Contrôles 112 à 121 ajoutés.

Non couvert : téléchargement du script et écriture du débrief (comportement de l'agent), à vérifier au premier passage réel.

1. Poste recherché, freelance, dans la zone : OK
2. Poste proche gardé en Métier proche : OK
3. Poste hors liste écarté : OK
4. Titre LinkedIn illisible gardé, Poste à vérifier : OK
5. CDI seul écarté si seuls Freelance et Portage acceptés : OK
6. Freelance + CDI gardé (un type accepté suffit) : OK
7. Portage seul gardé : OK
8. Stage toujours écarté, même si tout est accepté : OK
9. CDD gardé si accepté : OK
10. Contrat non indiqué : gardé, Contrat à vérifier : OK
11. Salaire annuel sans type, CDI/CDD non acceptés : écarté : OK
12. Salaire annuel sans type, CDI accepté : Contrat à vérifier : OK
13. Temps partiel écarté si plein seulement : OK
14. Temps non indiqué, plein seulement : à vérifier : OK
15. Temps non indiqué, plein ou partiel : rien à vérifier : OK
16. Présentiel hors zone écarté : OK
17. Mode inconnu hors zone : gardé, Lieu à vérifier : OK
18. Lieu non indiqué : Lieu à vérifier : OK
19. Présentiel refusé par les réglages : écarté : OK
20. Hybride 1 j, minimum 2 j : écarté : OK
21. Hybride sans nombre de jours, minimum 2 j : Télétravail à vérifier : OK
22. Télétravail total hors zone jamais écarté pour la zone : OK
23. TJM sous le plancher écarté : OK
24. TJM plancher vide : jamais écarté : OK
25. Ordre des critères : poste avant contrat : OK
26. Cumul d'étiquettes : OK
27. Version du modèle 2 : arrêt (code 2) : OK
28. Aucun poste recherché : erreur : OK
29. Valeur de contrat hors liste : erreur : OK
30. Offre déjà en base : erreur : OK
31. Compteurs incohérents : erreur : OK
32. Propriétés écrites (Métier proche, TJM moyen, Contrat en liste, lien LinkedIn reconstruit) : OK
33. Offre retirée : écriture de « Retirée le » : OK
34. Retrait hors candidats : erreur : OK
35. Retirée non contrôlée : erreur : OK
36. Sans contrôle de retrait : rien à écrire : OK
37. Collective : plateforme et lien lus dans Sources : OK
38. Collective : lien incohérent, erreur : OK
39. Free-Work : entreprise facultative, domaine saisi avec https://www. : OK
40. Lien hors du domaine des offres : erreur : OK
41. Domaine usurpé (free-work.com.evil.io) : erreur : OK
42. Gabarit générique : plateforme Malt écrite : OK
43. Plateforme absente des valeurs de Offres, lue sans erreur : erreur : OK
44. Plateforme absente signalée : source non lue, reste du passage OK : OK
45. Offre d'une source non lisible : erreur : OK
46. plateformes_offres absent : erreur : OK
47. Identifiant sans le préfixe de sa source : erreur : OK
48. Identifiant en majuscules : erreur : OK
49. Poste « inconnu » hors LinkedIn : erreur : OK
50. Source inconnue : erreur : OK
51. Préfixe vide hors LinkedIn : erreur de configuration : OK
52. Même préfixe pour deux plateformes : erreur : OK
53. Deux sources pour une même plateforme : accepté : OK
54. Colonne Plateforme vide : erreur : OK
55. Gabarit inconnu lu sans erreur : erreur : OK
56. Gabarit inconnu signalé : Dernière erreur écrite, reste du passage OK : OK
57. Lien de désactivation Free-Work (api.free-work.com/availability/disable-one) : écarté : OK
58. Sous-domaine d'aide (help.malt.fr) : écarté : OK
59. Paramètre token : écarté : OK
60. Paramètre signature : écarté : OK
61. Segment intermédiaire « search » : écarté : OK
62. Dernier segment « alerts » : écarté : OK
63. Désabonnement (desabonnement) : écarté : OK
64. Compte (account/settings) : écarté : OK
65. Slug « product-owner-research » : gardé : OK
66. Slug « chef-de-projet-helpdesk » : gardé : OK
67. Slug « charge-de-recherche » : gardé : OK
68. Lien Free-Work d'offre : gardé : OK
69. generique_suivi : identifiant d'empreinte, lien de suivi gardé tel quel (règle 1 non appliquée) : OK
70. generique_suivi : identifiant différent de l'empreinte, erreur : OK
71. generique_suivi : lien hors https, erreur : OK
72. --empreintes : identifiant calculé et écrit dans offres.json : OK
73. --empreintes : offre déjà en base signalée deja_vue : OK
74. Domaine vide refusé pour generique, accepté pour generique_suivi : OK
75. TEST SOURCE : plateforme absente des valeurs de Offres acceptée, résultat concluant avec attention : OK
76. TEST SOURCE : notion.json sans écriture d'offre, de source ni de retrait : OK
77. TEST SOURCE : offre gardée et lien écarté listés : OK
78. TEST SOURCE : offre écartée listée avec son motif : OK
79. TEST SOURCE : aucune offre et liens de suivi, suggestion generique_suivi : OK
80. TEST SOURCE : préfixe invalide, code 3 et résultat « erreur » écrit : OK
81. TEST SOURCE : gabarit inconnu, code 3 : OK
82. TEST SOURCE : expéditeur sans @, code 3 : OK
83. TEST SOURCE : résultat tronqué sous 1900 caractères : OK
84. Expéditeur détecté ajouté (adresse en minuscules, « ; » de l'objet remplacé) : OK
85. Fusion avec la liste existante : compteur cumulé, date et objet mis à jour : OK
86. Expéditeur ignoré par domaine : retiré : OK
87. Adresse d'une source active : retirée : OK
88. Adresse d'une source inactive (adresses_sources) : retirée : OK
89. Expéditeur sans mail depuis plus de 30 jours : retiré : OK
90. Au plus 20 expéditeurs, les plus récents gardés : OK
91. Étape 6 ter non faite : rien à écrire : OK
92. Expéditeur détecté mal formé : erreur : OK
93. TEST SOURCE : expéditeurs détectés ignorés : OK
94. Modèle 4 : passage OK, offre créée, expéditeurs détectés écrits, avertissement, débrief non écrit : OK
95. Modèle 4 : TEST SOURCE, résultat écrit : OK
96. Modèle 4 : TEST SOURCE mal réglé, code 3 et résultat « erreur » écrit : OK
97. Messagerie vide en modèle 5 : erreur : OK
98. Messagerie inconnue : erreur : OK
99. Messagerie Outlook (casse libre) : acceptée : OK
100. Messagerie Fastmail : acceptée : OK
101. Modèle 4 sans ligne Messagerie : erreur (plus de repli Gmail) : OK
102. TEST SOURCE : expéditeur fourni, ligne « expéditeur ; <adresse> ; fourni » : OK
103. TEST SOURCE : expéditeur retrouvé, ligne « retrouvé » et autres expéditeurs vus sans doublon : OK
104. TEST SOURCE : expéditeur introuvable, aucun mail : code 3, cause écrite : OK
105. TEST SOURCE : expéditeur introuvable, mails sans offres : code 3, adresses vues listées : OK
106. TEST SOURCE : expéditeur vide sans recherche : code 3, expéditeur invalide : OK
107. 1.9 : modèle 3 refusé (code 2) : OK
108. 1.9 : modèle 5, débrief à écrire, aucun avertissement de modèle : OK
109. 1.9 : avertissement du modèle 4 renvoie à la procédure « mettre à jour » : OK
110. 1.9 : TEST SOURCE sans ligne DEBRIEF : OK
111. 1.9 : gabarit inconnu cité avec la brique 1.9 : OK
112. Fusion : 4 offres Atos du même passage donnent une offre, premier identifiant gardé : OK
113. Fusion : lieux distincts regroupés « Paris ; Les Clayes-sous-Bois » : OK
114. Fusion : compteur doublons_passage=3 et retenues=1 : OK
115. Fusion : ligne FUSION avec les quatre identifiants : OK
116. Fusion : casse, accents et espaces ignorés : OK
117. Fusion : même titre, entreprises différentes : deux offres : OK
118. Fusion : entreprise vide (Free-Work) jamais fusionnée : OK
119. Fusion : lieu répété ou vide non ajouté : OK
120. Fusion : faits de la première lue gardés (groupe écarté une seule fois) : OK
121. Offres Free-Work relayées par LinkedIn comptées en doublons entre plateformes : identité respectée : OK
