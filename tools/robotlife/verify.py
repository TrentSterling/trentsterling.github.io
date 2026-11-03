"""Verify the public Robot Life runtime and real GPU menu/keyboard events.
Install Playwright and Chromium, then run from the repository root:
  python tools/robotlife/verify.py
  python tools/robotlife/verify.py --live
Physics uses explicit fixed steps, as in the source game's regression suite.
This verifies hosted bytes and input, not hardware frame pacing/performance.
"""
import argparse
import base64
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
report = {'mode': mode, 'expectedSha256': expected, 'errors': [], 'warnings': [], 'checks': [], 'scope': 'Real HTTP navigation, GPU pointer controls and keyboard events; explicit fixed-delta physics steps avoid software-compositor RAF throttling. No game bytes modified. Not a hardware frame-rate test.'}
server = None

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def capture(page, name):
    # Capture the actual rendered WebGL drawing buffer in the same JS task.
    # No Canvas2D or substitute image rendering is used.
    image = page.evaluate("()=>{__robotLife.render();return document.querySelector('canvas').toDataURL('image/png');}")
    assert image.startswith('data:image/png;base64,')
    (out / name).write_bytes(base64.b64decode(image.split(',', 1)[1]))

try:
    if args.live:
        base = 'https://tront.xyz/robotlife'
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
        env.pop('WAYLAND_DISPLAY', None)
        with p.chromium.launch(headless=True, env=env, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']) as browser:
            page = browser.new_page(viewport={'width': 1280, 'height': 800})
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
            page.evaluate('__robotLife.freeze()')
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
            assert page.evaluate('!__robotLife.ui.menu && __robotLife.input.active')
            report['checks'].append('Actual GPU Visit the diner button enters gameplay')
            before = page.evaluate('__robotLife.player.position.toArray()')
            page.keyboard.down('s')
            assert page.evaluate('__robotLife.input.keys.has("KeyS")')
            page.evaluate('for(let i=0;i<20;i++)__robotLife.step(.05)')
            page.keyboard.up('s')
            after = page.evaluate('__robotLife.player.position.toArray()')
            assert sum((a-b)**2 for a,b in zip(after,before)) > .0001, {'before':before,'after':after}
            report['movement'] = {'before':before, 'after':after, 'simulationSeconds':1}
            report['checks'].append('Real keyboard events drive movement through fixed-delta physics')
            assert page.evaluate('__robotLife.validate().nonFinite.length === 0')
            report['checks'].append('Physics remains finite')
            capture(page, 'diner.png')
            page.keyboard.press('Escape')
            assert page.evaluate('!!__robotLife.ui.menu')
            report['checks'].append('Escape opens the GPU pause menu')
            capture(page, 'pause.png')
            assert not report['errors'], report['errors']
            report['checks'].append('No JavaScript page errors')
            report['passed'] = True
except Exception as error:
    report['passed'] = False
    report['failure'] = repr(error)
    raise
finally:
    if server:
        server.shutdown()
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
