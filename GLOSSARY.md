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

## Fidélité

**Mot suspect**:
Mot absent du dictionnaire, signalé à la vérification mais jamais modifié automatiquement.
_Avoid_: Erreur, faute, coquille

**Lexique**:
Liste des mots validés à la main pour une Série (noms propres, termes japonais), qui ne sont plus jamais signalés comme Mots suspects.
_Avoid_: Dictionnaire perso, whitelist
