# OCR via l'app Raccourcis iOS, hors de la PWA

Une PWA n'a pas accès à l'OCR natif de l'iPhone. L'OCR est donc délégué à un raccourci iOS (action « Extraire le texte de l'image ») : la PWA lui envoie les Pages nommées par Rang, et il renvoie un unique `.txt` où chaque Page est précédée de son marqueur (`=== T01-R0042 ===`). La PWA rattache le texte aux Pages par ce marqueur, jamais par l'ordre d'arrivée.

## Considered Options

- **Tesseract.js dans la PWA** : rejeté. Moins fiable sur les accents, l'italique et les zones courbées près de la reliure. Exigence n°1 : fidélité au texte.
- **API OCR payantes** : rejetées. Coût récurrent sur une trentaine de Tomes, et envoi des pages à un tiers.
- **App native avec Vision** : rejetée. Exige un compte développeur Apple.

## Consequences

- Le parcours a une étape manuelle hors PWA (un tap sur le raccourci, puis l'import du `.txt`).
- Le format du marqueur de Page est un contrat entre la PWA et le raccourci : le changer impose de mettre à jour les deux.
