# 개발용 정적 서버: 캐시를 끄고 haru 폴더를 연다.  python tools/serve.py [port]
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
handler = functools.partial(NoCache, directory=str(ROOT))
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
