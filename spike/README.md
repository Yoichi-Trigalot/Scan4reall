# Spike : résolution caméra + OCR Raccourcis

Code jetable. But : décider si la capture vidéo en double page suffit pour l'OCR, et si la feuille de partage tient un Tome entier.

## Lancer sur l'iPhone

`getUserMedia` exige HTTPS : la page doit être servie en HTTPS (déploiement Vercel du dossier `spike/`, ou tunnel HTTPS vers un serveur local).

## Raccourci « Scan4reall OCR »

Libellés iOS en français, à ajuster si l'intitulé exact diffère sur ta version.

1. Réglages du raccourci : activer **Afficher dans la feuille de partage**, types acceptés : **Images** et **Fichiers**.
2. **Filtrer les fichiers** : entrée du raccourci, trier par **Nom**, ordre **A à Z**.
3. **Répéter avec chaque élément** dans les fichiers filtrés :
   1. **Obtenir le nom** de l'élément de répétition.
   2. **Extraire le texte de** l'élément de répétition.
   3. **Texte** :
      ```text
      === [Nom] ===
      [Texte extrait]
      ```
4. Fin de la répétition, puis **Combiner le texte** (résultats de la répétition, séparateur **Nouvelle ligne**).
5. **Enregistrer le fichier** dans Fichiers, sous le nom `T00-ocr.txt`.

Vérifier que les noms reçus sont bien `T00-R0001`… : la feuille de partage pourrait les renommer, et ce serait bloquant pour le contrat du marqueur (ADR 0001).

## Protocole

5 doubles pages d'un Tome de la première Série, téléphone fixé au-dessus du livre.

| Mesure | Comment | Résultat |
|---|---|---|
| Résolution flux vidéo | `videoWidth x videoHeight` affiché | |
| Résolution photo native | champ « Photo native » | |
| Qualité OCR vidéo | 2 Pages vidéo partagées au raccourci, comparées au livre mot à mot | |
| Qualité OCR photo | même chose avec 2 Pages photo | |
| Pertes près de la reliure | mots ratés en bord de pli (décide le dewarping) | |
| Noms conservés au partage | marqueurs du `.txt` | |
| Partage d'un Tome | « Partager N fichiers » avec N = 300 | |
| Seuils de mouvement | valeurs `diff` en tournant une page, puis à l'arrêt | |
