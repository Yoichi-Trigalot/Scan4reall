# Scan4reall

Numérisation fidèle de livres papier sans équivalent numérique, pour lecture sur liseuse.

## Corpus

**Série**:
Ensemble de Tomes publiés sous un même titre. Plusieurs Séries sont traitées, l'une après l'autre.
_Avoid_: Collection, saga

**Tome**:
Un livre physique d'une Série.
_Avoid_: Livre, volume

## Numérisation

**Session**:
Le passage de scan d'un Tome, interruptible et reprenable. Un Tome a une seule Session.
_Avoid_: Scan, job

**Capture**:
Photo d'une double page telle que prise par la caméra, conservée intacte.
_Avoid_: Image, photo, scan

**Page**:
Une page du Tome, obtenue par découpe d'une Capture.
_Avoid_: Image, côté

**Rang**:
Position d'une Page dans l'ordre du scan, attribuée à la découpe.
_Avoid_: Numéro de page, index

**Folio**:
Numéro imprimé sur la Page, connu seulement après OCR. Absent sur certaines Pages.
_Avoid_: Numéro de page

**Page ignorée**:
Page marquée à la main comme exclue du texte (couverture, page blanche, carte, illustration).
_Avoid_: Page supprimée

## OCR

**Marqueur**:
Ligne `=== T01-R0042 ===` qui précède le texte de chaque Page dans le fichier renvoyé par l'OCR, et qui le rattache à sa Page par le Rang.
_Avoid_: Séparateur, en-tête

**Texte brut**:
Texte d'une Page tel que l'OCR le renvoie, avant tout nettoyage.
_Avoid_: Texte OCR, texte importé

**Transparence**:
Texte du verso visible à travers une page fine, que l'OCR peut lire comme du charabia.
_Avoid_: Bavure, fantôme

## Fidélité

**Mot suspect**:
Mot absent du dictionnaire, signalé à la vérification mais jamais modifié automatiquement.
_Avoid_: Erreur, faute, coquille

**Correction**:
Remplacement d'un mot par un autre, décidé à la main, sur tout un Tome ou sur une seule Page.
_Avoid_: Règle, substitution, fix

**Page à revoir**:
Page signalée à la vérification : OCR vide, probablement illisible, anormalement courte, ou contenant encore des Mots suspects. Les autres Pages sont tenues pour bonnes.
_Avoid_: Page en erreur, page à relire

**Lexique**:
Liste des mots validés à la main pour une Série (noms propres, termes japonais), qui ne sont plus jamais signalés comme Mots suspects.
_Avoid_: Dictionnaire perso, whitelist
