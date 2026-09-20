"""Stamp the homepage ProfilePage schema with a valid ISO 8601 dateModified.

Google's Profile page structured data wants a full datetime with a timezone
offset. A date-only value ("2026-09-04") triggers "Invalid datetime value for
'dateModified'" in Search Console (first hit 2026-09-19). Run this after any
material change to index.html, then commit:

    python tools/stamp.py
"""
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'
html = INDEX.read_text(encoding='utf-8')

# Prefer the last commit time for index.html; fall back to now.
try:
    stamp = subprocess.run(['git', 'log', '-1', '--format=%ad', '--date=iso-strict', '--', 'index.html'],
                           cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
except Exception:
    stamp = ''
if not re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$', stamp):
    stamp = datetime.now(timezone.utc).astimezone().replace(microsecond=0).isoformat()

new, n = re.subn(r'"dateModified":\s*"[^"]*"', f'"dateModified": "{stamp}"', html)
if n != 1:
    raise SystemExit(f'ABORT: expected exactly one dateModified, found {n}')
INDEX.write_text(new, encoding='utf-8', newline='\n')
print(f'dateModified -> {stamp}')
