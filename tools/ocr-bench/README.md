# OCR bench

Runs Apple's OCR (Vision, the engine behind the Shortcuts action) on the Mac, to measure an
image or cleaning change against a reference without going through the iPhone.

```bash
swiftc -O ocr.swift -o ocr                       # once
./ocr pages/T01-R*.jpg > candidate.txt           # images named like exported Pages
python3 score.py reference.txt candidate.txt     # word errors per Page
```

Keep page images and OCR outputs out of git: they are copyrighted book content (`samples/`).
