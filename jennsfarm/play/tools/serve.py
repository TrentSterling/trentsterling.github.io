#!/usr/bin/env python
# No-cache static server for Jenn's Farm dev. The default http.server lets
# Firefox cache ES modules, so editing one file + refreshing can load a stale
# mix (e.g. new sprinklers.js importing an old farm.js) -> phantom errors.
# This sends Cache-Control: no-store so every refresh fetches fresh modules.
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8150
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else '.'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    httpd.serve_forever()
