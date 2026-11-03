import json
import re
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def valid_date_modified(value):
    if not isinstance(value, str) or not re.fullmatch(
        r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})', value
    ):
        return False
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).utcoffset() is not None
    except ValueError:
        return False

class ProfileDateTests(unittest.TestCase):
    def test_profile_page_date_if_present(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        scripts = re.findall(r'<script\s+type="application/ld\+json"\s*>(.*?)</script>', html, re.S)
        graphs = [node for script in scripts for node in json.loads(script).get('@graph', [])]
        profiles = [node for node in graphs if node.get('@type') == 'ProfilePage']
        self.assertEqual(len(profiles), 1)
        if 'dateModified' in profiles[0]:
            self.assertTrue(valid_date_modified(profiles[0]['dateModified']))

    def test_examples_and_invalid_values(self):
        for value in ('2026-11-03T07:19:41Z', '2026-09-26T22:06:46-05:00'):
            self.assertTrue(valid_date_modified(value), value)
        for value in ('2026-10-28', '', None, '2026-02-30T00:00:00Z',
                      '2026-11-03T07:19:41', '2026-11-03T07:19:41+25:00'):
            self.assertFalse(valid_date_modified(value), repr(value))

if __name__ == '__main__':
    unittest.main()
