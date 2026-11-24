"""Word errors per Page between two marker files (=== T01-R0042 ===).

usage: python3 score.py reference.txt candidate.txt
"""
import difflib
import re
import sys


def pages(path):
    out, cur = {}, None
    for line in open(path, encoding="utf-8"):
        m = re.match(r"=== (T\d+-R\d+) ===", line)
        if m:
            cur = m.group(1)
            out[cur] = []
        elif cur:
            out[cur] += line.split()
    return out


ref, cand = pages(sys.argv[1]), pages(sys.argv[2])
total = 0
for name in sorted(ref):
    if name not in cand:
        print(f"{name}  absente du candidat")
        continue
    a, b = ref[name], cand[name]
    ops = difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes()
    errors = sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in ops if op != "equal")
    total += errors
    print(f"{name}  {len(a):4} mots  {errors:4} erreurs")
print(f"TOTAL {total} erreurs")
