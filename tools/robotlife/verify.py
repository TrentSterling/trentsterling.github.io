"""Verify the published Robot Life bytes and exercise real GPU menu input.
Run from the repository root after installing Playwright and Chromium:
  python tools/robotlife/verify.py
  python tools/robotlife/verify.py --live
No source files, user saves, or credentials are published by this test.
"""
import argparse
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import threading
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--live', action='store_true')
args = parser.parse_args()
meta = json.loads((ROOT / 'robotlife/build.json').read_text())
expected = meta['sha256']
assert hashlib.sha256((ROOT / 'robotlife/index.html').read_bytes()).hexdigest() == expected
mode = 'live' if args.live else 'local'
out = ROOT / '.robotlife-evidence' / mode
out.mkdir(parents=True, exist_ok=True)
report = {'mode': mode, 'expectedSha256': expected, 'errors': [], 'warnings': [], 'checks': []}
server = None

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

try:
    if args.live:
        base = 'https://tront.xyz/robotlife'
        # Pages deployment is separate from verification. Wait only for this
        # exact published runtime, never accept a 200 response for an old build.
        deadline = time.monotonic() + 240
        while True:
            try:
                request = urllib.request.Request(base + '/?verify=' + str(time.time_ns()), headers={'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=20) as response:
                    data = response.read()
                    assert response.status == 200
                if hashlib.sha256(data).hexdigest() == expected:
                    break
            except Exception:
                pass
            if time.monotonic() > deadline:
                raise RuntimeError('The expected Robot Life runtime is not live yet')
            time.sleep(8)
    else:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}/robotlife'

    with sync_playwright() as p:
        env = dict(os.environ)
        env.pop('DISPLAY', None)
        with p.chromium.launch(headless=True, env=env, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader']) as browser:
            page = browser.new_page(viewport={'width': 1280, 'height': 800})
            # Exposes observational hooks in this browser only; shipped HTML
            # remains byte-identical and contains no enabled QA session.
            page.add_init_script('window.__ROBOTLIFE_QA__ = true;')
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.on('console', lambda m: report['warnings'].append(m.text) if m.type in ['warning', 'error'] else None)
            response = page.goto(base, wait_until='load', timeout=60000)
            assert response.status == 200
            assert page.url.split('?')[0].endswith('/robotlife/')
            assert hashlib.sha256(response.body()).hexdigest() == expected
            report['url'] = page.url
            report['checks'].append('Bare /robotlife resolves to the exact approved runtime with HTTP 200')
            page.wait_for_function('window.__ROBOTLIFE_READY__ && window.__robotLife', timeout=60000)
            assert page.locator('button,input,textarea,select').count() == 0
            report['checks'].append('WebGL game initializes without HTML controls')
            info = page.evaluate("""() => {
                __robotLife.render();
                const u = __robotLife.ui;
                return {scale:u.scale, button:u.snapshot().buttons.find(b=>b.action.kind==='do' && b.action.value==='diner')};
            }""")
            button = info['button']
            assert button and button['enabled']
            page.mouse.click((button['x']+button['w']/2)*info['scale'], (button['y']+button['h']/2)*info['scale'])
            page.wait_for_function('!__robotLife.ui.menu', timeout=15000)
            report['checks'].append('Actual GPU Visit the diner button enters gameplay')
            before = page.evaluate('__robotLife.player.position.toArray()')
            page.keyboard.down('KeyA')
            page.wait_for_timeout(750)
            page.keyboard.up('KeyA')
            after = page.evaluate('__robotLife.player.position.toArray()')
            assert sum((a-b)**2 for a,b in zip(after,before)) > .0001
            report['checks'].append('Keyboard movement works on the hosted page')
            assert page.evaluate('__robotLife.validate().nonFinite.length === 0')
            report['checks'].append('Physics remains finite')
            page.screenshot(path=str(out / 'diner.png'))
            page.keyboard.press('Escape')
            page.wait_for_function('!!__robotLife.ui.menu', timeout=15000)
            report['checks'].append('Escape opens the GPU pause menu')
            page.screenshot(path=str(out / 'pause.png'))
            assert not report['errors'], report['errors']
            report['checks'].append('No JavaScript page errors')
            report['passed'] = True
except Exception as error:
    report['passed'] = False
    report['failure'] = str(error)
    raise
finally:
    if server:
        server.shutdown()
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
