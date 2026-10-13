#!/usr/bin/env python3
"""Read-only bounded public-site route/link audit. Python standard library only.

No JavaScript, archived code, forms, writes, login, third-party requests, or browser
execution. Live requests are HTTPS GETs to the exact allowlisted public hosts.
"""
import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

HOSTS = frozenset(("tront.xyz", "monke.tront.xyz", "punk.tront.xyz"))
ASSET_EXTS = frozenset(".css .js .mjs .json .xml .txt .webmanifest .svg .png .jpg .jpeg .gif .webp .avif .ico .woff .woff2 .ttf .eot .mp4 .webm .ogg .mp3 .wav .swf .zip .pdf .unityweb .data .wasm .br .gz".split())
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)|@import\s+(['\"])(.*?)\3", re.I)


def now():
    return datetime.now(timezone.utc).isoformat()


def clean_url(value, base):
    """Preserve case/trailing slashes, drop fragment and query for bounded identity."""
    value = value.strip()
    if not value or value.startswith(("data:", "javascript:", "mailto:", "tel:", "blob:")):
        return None
    try:
        p = urllib.parse.urlsplit(urllib.parse.urljoin(base, value))
        if p.scheme not in ("https", "http") or p.username or p.password:
            return None
        p.port  # Reject malformed ports before classifying.
        return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path or "/", "", ""))
    except ValueError:
        return None


def allowed(url):
    try:
        p = urllib.parse.urlsplit(url)
        return p.scheme == "https" and p.hostname in HOSTS and p.port in (None, 443) and not p.username and not p.password
    except ValueError:
        return False


def is_html_url(url):
    ext = Path(urllib.parse.urlsplit(url).path).suffix.lower()
    return not ext or ext in (".html", ".htm")


def css_refs(css):
    return [(m.group(2) or m.group(4) or "").strip() for m in CSS_URL.finditer(css)]


class Page(HTMLParser):
    def __init__(self, text, url):
        super().__init__(convert_charrefs=True)
        self.url = url
        self.base = url
        self.titles = []
        self._title = False
        self.canonicals = []
        self.descriptions = []
        self.robots = []
        self.refresh = []
        self.ids = set()
        self.refs = []
        self._style = False
        self._script = False
        self.canvas_count = 0
        self.script_count = 0
        self.inline_script_count = 0
        self.forms = []
        self.feed(text)
        self.close()

    def ref(self, value, kind, tag, attr):
        if not value:
            return
        absolute = urllib.parse.urljoin(self.base, value)
        normalized = clean_url(value, self.base)
        if normalized:
            p = urllib.parse.urlsplit(absolute)
            self.refs.append({"url": normalized, "kind": kind, "tag": tag, "attribute": attr,
                              "raw": value[:1000], "fragment": urllib.parse.unquote(p.fragment),
                              "queryIgnored": bool(p.query), "allowedHost": allowed(normalized)})

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "a" and a.get("name"):
            self.ids.add(a["name"])
        if tag == "base" and a.get("href"):
            self.base = urllib.parse.urljoin(self.url, a["href"])
        if tag == "title":
            self._title = True
            self.titles.append("")
        if tag == "style":
            self._style = True
        if tag == "script":
            self._script = True
            self.script_count += 1
            self.inline_script_count += not bool(a.get("src"))
        if tag == "canvas":
            self.canvas_count += 1
        if tag == "meta":
            key = (a.get("name") or "").lower()
            if key == "description":
                self.descriptions.append(a.get("content", ""))
            if key == "robots":
                self.robots.append(a.get("content", ""))
            if (a.get("http-equiv") or "").lower() == "refresh":
                self.refresh.append(a.get("content", ""))
        if tag == "link":
            rel = (a.get("rel") or "").lower().split()
            if "canonical" in rel:
                self.canonicals.append(urllib.parse.urljoin(self.base, a.get("href", "")))
            elif any(x in rel for x in ("stylesheet", "icon", "apple-touch-icon", "manifest", "preload", "modulepreload")):
                self.ref(a.get("href"), "asset", tag, "href")
            elif "alternate" in rel and a.get("type") in ("application/rss+xml", "application/atom+xml"):
                self.ref(a.get("href"), "asset", tag, "href")
        if tag in ("a", "area"):
            self.ref(a.get("href"), "asset" if a.get("download") is not None else "navigation", tag, "href")
        if tag in ("script", "img", "source", "video", "audio", "track", "input", "embed", "iframe"):
            self.ref(a.get("src"), "embed" if tag == "iframe" else "asset", tag, "src")
        if tag == "object":
            self.ref(a.get("data"), "asset", tag, "data")
        if tag == "video":
            self.ref(a.get("poster"), "asset", tag, "poster")
        # Native and common lazy-load image attributes. Data URLs are excluded.
        if tag in ("img", "source", "video"):
            for attr in ("data-src", "data-lazy-src", "data-poster"):
                self.ref(a.get(attr), "asset", tag, attr)
            for attr in ("srcset", "data-srcset"):
                value = a.get(attr) or ""
                if value and not value.lstrip().startswith("data:"):
                    for item in value.split(","):
                        self.ref(item.strip().split()[0] if item.strip() else None, "asset", tag, attr)
        for ref in css_refs(a.get("style") or ""):
            self.ref(ref, "asset", tag, "style")
        if tag == "form":
            # Record but never request a form action, even if method defaults to GET.
            self.forms.append({"action": a.get("action", ""), "method": a.get("method", "get")})

    def handle_endtag(self, tag):
        if tag == "title":
            self._title = False
        if tag == "style":
            self._style = False
        if tag == "script":
            self._script = False

    def handle_data(self, data):
        if self._title:
            self.titles[-1] += data
        if self._style:
            for ref in css_refs(data):
                self.ref(ref, "asset", "style", "text")

    def metadata(self):
        refs = {json.dumps(r, sort_keys=True): r for r in self.refs}
        return {"title": " ".join(" ".join(self.titles).split()), "titleCount": len(self.titles),
                "canonicals": self.canonicals, "descriptions": self.descriptions, "robots": self.robots,
                "metaRefresh": self.refresh, "ids": sorted(self.ids), "references": list(refs.values()),
                "canvasCount": self.canvas_count, "scriptCount": self.script_count,
                "inlineScriptCount": self.inline_script_count, "formsNotSubmitted": self.forms}


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def inventory(args):
    old = json.loads(Path(args.source_inventory).read_text())
    blog = json.loads(Path(args.blog_inventory).read_text())
    main = Path(args.main_source)
    previous = {}
    if args.previous_http:
        previous = {x["url"]: x for x in json.loads(Path(args.previous_http).read_text())["requests"]}
    routes = {}

    def add(url, category, source):
        url = clean_url(url, "https://tront.xyz/")
        item = routes.setdefault(url, {"url": url, "categories": [], "provenance": [], "liveStatus": "not-tested-by-this-audit"})
        if category not in item["categories"]:
            item["categories"].append(category)
        item["provenance"].append(source)
        if url in previous:
            item["previousLiveEvidence"] = previous[url]
        return item

    main_paths = set()
    for record in old["mainPages"]:
        path = record["file"]
        main_paths.add(path)
        file = main / path
        data = file.read_bytes()
        item = add(record["url"], record["class"], {"type": "main-source-html", "repository": "TrentSterling/trentsterling.github.io", "commit": args.main_commit, "path": path, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
        item["static"] = Page(data.decode("utf-8", "replace"), item["url"]).metadata()
    found_paths = {str(p.relative_to(main)) for p in main.rglob("*.html")}
    if main_paths != found_paths:
        raise SystemExit("Main source inventory mismatch: " + str(main_paths ^ found_paths))
    for record in old["sitemapOnly"]:
        add(record["url"], "sitemap-only-external-repository-or-owner-unresolved", {"type": "main-sitemap", "repository": "TrentSterling/trentsterling.github.io", "commit": args.main_commit, "path": "sitemap.xml", "sourceOwnerVerified": False})
    for record in blog["routes"]:
        path = record["route"]
        if "/posts/" in path:
            category = "blog-post"
        elif "/tags/" in path and path != "/blog/tags/":
            category = "blog-generated-tag"
        elif "/categories/" in path:
            category = "blog-generated-category"
        elif re.fullmatch(r"/blog/page\d+/", path):
            category = "blog-generated-pagination"
        else:
            category = "blog-core-layout"
        item = add("https://tront.xyz" + path, category, {"type": "production-build-route-inventory", "repository": "TrentSterling/blog", "commit": args.blog_commit, "path": record["file"], "inventoryFile": "inputs/blog-built-routes.json", "bytesInPriorBuild": record["bytes"], "buildCommitProvenance": args.blog_provenance})
        item["buildTitle"] = record["title"]
    add("https://monke.tront.xyz/", "separate-project-native-default", {"type": "published-project-exception", "repository": "TrentSterling/monke", "commit": "f1d810c384c4a4a83f416bcbdd197ef920378fff", "path": "index.htm"})
    add("https://punk.tront.xyz/", "separate-project-unreleased-colormagic-draft", {"type": "known-public-host", "note": "Only published HTML is tested. The unreleased ColorMagic draft must not be treated as published or changed."})
    result = {"schemaVersion": 1, "generatedAt": now(), "scope": "Known public HTML routes, deduplicated by exact URL (case/trailing slash preserved). Static and prior live evidence do not mean a new live check passed.",
              "allowedHosts": sorted(HOSTS), "count": len(routes), "categoryCounts": dict(Counter(c for r in routes.values() for c in r["categories"])), "routes": sorted(routes.values(), key=lambda r:r["url"]),
              "limits": ["Sitemap-only routes do not establish the owning repository or current deployment.", "Generated blog route inventory does not cover every runtime-created URL.", "No archived code or game is executed by this tool.", "Static metadata is parsed as HTML; dynamic links, CSS/JS-generated URLs and JavaScript redirects are not evaluated."]}
    write_json(args.output, result)
    print(json.dumps({k:v for k,v in result.items() if k not in ("routes",)}, indent=2))


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    max_repeats = 2
    max_redirections = 3

    def __init__(self, budget):
        self.budget = budget
        self.history = []
        super().__init__()

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.history.append({"from": req.full_url, "status": code, "to": newurl})
        if not allowed(newurl):
            raise urllib.error.HTTPError(req.full_url, code, "Redirect outside allowlist", headers, fp)
        skip = self.budget.reserve()
        if skip:
            raise urllib.error.HTTPError(req.full_url, code, "Redirect budget reached: " + skip, headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Budget:
    def __init__(self, args):
        self.lock = threading.Lock()
        self.start = time.monotonic()
        self.deadline = self.start + args.seconds
        self.next_start = self.start
        self.interval = 1.0 / args.rate
        self.bytes = 0
        self.requests = 0
        self.max_bytes = args.max_total_bytes
        self.max_requests = args.max_requests

    def reserve(self):
        with self.lock:
            if time.monotonic() >= self.deadline:
                return "wall-time-budget"
            if self.bytes >= self.max_bytes:
                return "total-byte-budget"
            if self.requests >= self.max_requests:
                return "request-budget"
            start = max(self.next_start, time.monotonic())
            self.next_start = start + self.interval
            self.requests += 1
        time.sleep(max(0, start-time.monotonic()))
        if time.monotonic() >= self.deadline:
            return "wall-time-budget"
        return None

    def add_bytes(self, amount):
        with self.lock:
            self.bytes += amount
            return self.bytes <= self.max_bytes


def fetch(url, kind, args, budget):
    result = {"url": url, "kind": kind, "checkedAt": now()}
    if not allowed(url):
        return {**result, "skipped": "outside-exact-https-host-allowlist"}
    skip = budget.reserve()
    if skip:
        return {**result, "skipped": skip}
    is_css = kind == "asset" and urllib.parse.urlsplit(url).path.lower().endswith(".css")
    max_bytes = args.max_html_bytes if kind == "html" else args.max_css_bytes if kind == "sitemap" or is_css else args.asset_probe_bytes
    headers = {"User-Agent": "Tront-public-route-audit/1.0 (read-only bounded owner QA)", "Accept-Encoding": "identity"}
    if kind == "asset" and not is_css:
        headers["Range"] = "bytes=0-" + str(max_bytes-1)
    start = time.monotonic()
    try:
        redirects = SafeRedirect(budget)
        opener = urllib.request.build_opener(redirects)
        try:
            response = opener.open(urllib.request.Request(url, headers=headers, method="GET"), timeout=args.timeout)
        except urllib.error.HTTPError as exc:
            response = exc
        result["redirectChain"] = redirects.history
        with response:
            result.update({"status": response.status, "finalUrl": response.geturl(), "contentType": response.headers.get("Content-Type", ""), "contentLength": response.headers.get("Content-Length"), "etag": response.headers.get("ETag"), "lastModified": response.headers.get("Last-Modified"), "redirectLocation": response.headers.get("Location")})
            chunks, total = [], 0
            while total <= max_bytes:
                if time.monotonic() > budget.deadline or time.monotonic() - start > args.timeout:
                    result["bodyIncomplete"] = "deadline"
                    break
                chunk = response.read(min(65536, max_bytes + 1 - total))
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
                if not budget.add_bytes(len(chunk)):
                    result["bodyIncomplete"] = "total-byte-budget"
                    break
            body = b"".join(chunks)
            result["bytesRead"] = len(body)
            result["bodyTruncated"] = len(body) > max_bytes
            result["probeOnly"] = kind == "asset" and not is_css
            if "text/css" in result["contentType"].lower():
                result["probeOnly"] = False
            if not result["probeOnly"] and response.status == 206:
                result["bodyIncomplete"] = "unexpected-partial-response"
            declared = result.get("contentLength")
            if declared and declared.isdigit() and len(body) < int(declared) and not result["probeOnly"]:
                result.setdefault("bodyIncomplete", "fewer-bytes-than-content-length")
            result["coverageIncomplete"] = bool((result.get("bodyIncomplete") or result["bodyTruncated"]) and not result["probeOnly"])
            result["sha256OfReadBytes"] = hashlib.sha256(body).hexdigest()
            text = body.decode("utf-8", "replace")
            result["intermediaryError"] = bool(re.search(r"site\s*unavailable|this\s+site\s+is\s+currently\s+unavailable", text[:2000], re.I))
            result["ok"] = 200 <= response.status < 300 and not result["intermediaryError"]
            if kind == "sitemap":
                result["sitemapEntries"] = []
                try:
                    if re.search(r"<!DOCTYPE|<!ENTITY", text, re.I):
                        raise ValueError("Sitemap with DTD/entity declarations is not parsed")
                    tree = ET.fromstring(text)
                    root_type = tree.tag.rsplit("}", 1)[-1]
                    if root_type not in ("sitemapindex", "urlset"):
                        raise ValueError("Unexpected sitemap root: " + root_type)
                    result["sitemapType"] = root_type
                    for entry in tree:
                        expected = "sitemap" if root_type == "sitemapindex" else "url"
                        if entry.tag.rsplit("}", 1)[-1] != expected:
                            continue
                        loc = next((n.text.strip() for n in entry if n.tag.rsplit("}", 1)[-1] == "loc" and n.text), None)
                        if loc:
                            result["sitemapEntries"].append({"raw": loc, "url": clean_url(loc, result["finalUrl"]), "kind": expected})
                except (ET.ParseError, ValueError) as exc:
                    result["sitemapError"] = str(exc)
            elif kind == "html":
                result["htmlLike"] = "html" in result["contentType"].lower() or bool(re.search(r"<!doctype\s+html|<html\b", text[:3000], re.I))
                if result["htmlLike"]:
                    result["html"] = Page(text, result["finalUrl"]).metadata()
                    title = result["html"]["title"].lower()
                    result["possibleSoft404"] = result["ok"] and "404" not in urllib.parse.urlsplit(url).path and (title.startswith("404") or "page not found" in title or title == "site not found · github pages")
            elif "text/css" in result["contentType"].lower() or urllib.parse.urlsplit(url).path.lower().endswith(".css"):
                result["cssReferences"] = [u for x in css_refs(text) if (u := clean_url(x, result["finalUrl"]))]
            elif "html" in result["contentType"].lower():
                result["unexpectedHtmlAsset"] = True
    except Exception as exc:
        result["error"] = type(exc).__name__ + ": " + str(exc)
        result["ok"] = False
    result["elapsedSeconds"] = round(time.monotonic()-start, 3)
    return result


def run_live(args):
    manifest = json.loads(Path(args.inventory).read_text())
    if args.workers < 1 or args.workers > 4 or args.rate <= 0 or args.rate > 4:
        raise SystemExit("Safety bounds: 1-4 workers, >0-4 total GET starts/second.")
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    budget = Budget(args)
    seeds = {r["url"]: r for r in manifest["routes"]}
    static_seed_count = len(seeds)
    html_results, asset_results, sitemap_results, external, deferred, references = {}, {}, {}, {}, {}, []
    sitemap_gaps = []
    jsonl = out / "requests.jsonl"
    jsonl.write_text("")

    def batch(urls, kind, target):
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for result in pool.map(lambda u:fetch(u, kind, args, budget), sorted(urls)):
                target[result["url"]] = result
                with jsonl.open("a") as fh:
                    fh.write(json.dumps(result, ensure_ascii=False) + "\n")
        print(f"Checked {len(target)} {kind} targets, {budget.bytes} bytes", flush=True)

    sitemap_pending = list(dict.fromkeys(getattr(args, "sitemap_roots", None) or manifest.get("sitemapRoots", [])))
    sitemap_entry_count = 0
    while sitemap_pending:
        url = sitemap_pending.pop(0)
        if url in sitemap_results:
            continue
        if not allowed(url):
            sitemap_gaps.append({"url": url, "reason": "coverage-gap:external-sitemap-not-fetched"})
            continue
        if len(sitemap_results) >= args.max_sitemaps:
            sitemap_gaps.extend({"url": u, "reason": "coverage-gap:sitemap-file-cap"} for u in [url] + sitemap_pending if u not in sitemap_results)
            break
        batch([url], "sitemap", sitemap_results)
        result = sitemap_results[url]
        if not result.get("ok") or result.get("sitemapError") or result.get("coverageIncomplete"):
            if result.get("sitemapError"):
                sitemap_gaps.append({"url": url, "reason": "coverage-gap:sitemap-parse-error", "error": result["sitemapError"]})
            continue
        for entry in result.get("sitemapEntries", []):
            sitemap_entry_count += 1
            if sitemap_entry_count > args.max_sitemap_entries:
                sitemap_gaps.append({"url": url, "reason": "coverage-gap:sitemap-entry-cap"})
                break
            target = entry["url"]
            if not target or not allowed(target):
                sitemap_gaps.append({"url": target or entry["raw"], "sourceSitemap": url, "reason": "coverage-gap:external-or-invalid-sitemap-entry-not-fetched"})
            elif entry["kind"] == "sitemap":
                if target not in sitemap_pending and target not in sitemap_results:
                    sitemap_pending.append(target)
            else:
                route = seeds.setdefault(target, {"url": target, "categories": ["sitemap-discovered-published-candidate"], "provenance": []})
                route["provenance"].append({"type": "live-public-sitemap", "sitemapUrl": url, "checkedAt": result.get("checkedAt"), "note": "Sitemap advertisement does not establish source ownership, successful serving, or runtime coverage."})
        if sitemap_entry_count > args.max_sitemap_entries:
            for pending in sitemap_pending:
                sitemap_gaps.append({"url": pending, "reason": "coverage-gap:sitemap-entry-cap"})
            break

    html_pending = set(seeds)
    assets = set()
    for depth in range(args.link_depth + 1):
        remaining = max(0, args.max_html - len(html_results))
        selected = sorted(html_pending - html_results.keys())[:remaining]
        for url in set(html_pending) - set(selected) - html_results.keys():
            deferred[url] = "HTML-count-cap"
        if not selected:
            break
        batch(selected, "html", html_results)
        html_pending = set()
        for url in selected:
            result = html_results[url]
            if not result.get("ok") or result.get("possibleSoft404"):
                continue
            for ref in result.get("html", {}).get("references", []):
                edge = {"from": url, **ref}
                references.append(edge)
                target = ref["url"]
                if not ref["allowedHost"]:
                    external.setdefault(target, []).append({"from": url, "kind": ref["kind"]})
                elif ref["kind"] in ("navigation", "embed") and is_html_url(target):
                    if target not in html_results:
                        if depth < args.link_depth:
                            html_pending.add(target)
                        else:
                            deferred[target] = "HTML-discovery-depth-cap"
                else:
                    assets.add(target)
    for depth in range(args.css_depth + 1):
        # HTML may be referenced by both href and src. Do not request it twice.
        pending = sorted(assets - asset_results.keys() - html_results.keys())
        selected = pending[:max(0, args.max_assets-len(asset_results))]
        for url in set(pending) - set(selected):
            deferred[url] = "asset-count-cap"
        if not selected:
            break
        batch(selected, "asset", asset_results)
        assets = set()
        for url in selected:
            for target in asset_results[url].get("cssReferences", []):
                references.append({"from": url, "url": target, "kind": "css-asset", "allowedHost": allowed(target)})
                if not allowed(target):
                    external.setdefault(target, []).append({"from": url, "kind": "css-asset"})
                elif target not in asset_results and target not in html_results:
                    if depth < args.css_depth:
                        assets.add(target)
                    else:
                        deferred[target] = "CSS-discovery-depth-cap"
    all_results = {**sitemap_results, **html_results, **asset_results}
    issues = list(sitemap_gaps)
    for url, result in all_results.items():
        reason = None
        if result.get("skipped"):
            reason = "not-checked:" + result["skipped"]
        elif not result.get("ok"):
            reason = "http-or-network-failure"
        elif result.get("possibleSoft404"):
            reason = "possible-soft-404"
        elif result.get("unexpectedHtmlAsset"):
            reason = "asset-returned-html"
        elif result["kind"] == "html" and not result.get("htmlLike"):
            reason = "route-returned-non-html"
        if result.get("coverageIncomplete"):
            issues.append({"url": url, "reason": "coverage-gap:incomplete-" + result["kind"] + "-body", "bodyTruncated": result.get("bodyTruncated"), "bodyIncomplete": result.get("bodyIncomplete")})
        if reason:
            issues.append({"url": url, "reason": reason, "status": result.get("status"), "error": result.get("error"), "referrers": sorted({r["from"] for r in references if r["url"] == url})})
        if result["kind"] == "html" and result.get("ok") and result.get("htmlLike"):
            h = result["html"]
            # Missing metadata is an observation, not a universal design requirement.
            for key, missing in (("title", not h["title"]), ("canonical", not h["canonicals"]), ("description", not h["descriptions"])):
                if missing:
                    issues.append({"url": url, "reason": "metadata-missing-"+key, "severity": "observation"})
    fragments = []
    for ref in references:
        fragment = ref.get("fragment")
        result = html_results.get(ref["url"], {})
        if fragment and not fragment.startswith(":~:") and result.get("ok") and result.get("html") and not result.get("bodyTruncated") and not result.get("bodyIncomplete") and fragment not in result["html"]["ids"]:
            fragments.append({"from": ref["from"], "url": ref["url"], "fragment": fragment, "classification": "absent-in-static-html; may-be-runtime-generated"})
    live_routes = []
    for url, seed in seeds.items():
        live_routes.append({"url": url, "categories": seed["categories"], "provenance": seed["provenance"], "live": html_results.get(url, {"skipped": "not-scheduled"})})
    summary = {"generatedAt": now(), "elapsedSeconds": round(time.monotonic()-budget.start, 2),
               "staticSeedRoutes": static_seed_count, "sitemapDiscoveredAdditionalRoutes": len(seeds)-static_seed_count, "sitemapFiles": len(sitemap_results), "sitemapEntriesSeen": sitemap_entry_count,
               "seedRoutes": len(seeds), "seedRoutesRequested": sum("status" in html_results.get(u,{}) for u in seeds),
               "seedRoutesSuccessful": sum(bool(html_results.get(u,{}).get("ok")) and bool(html_results.get(u,{}).get("htmlLike")) and not html_results.get(u,{}).get("possibleSoft404") and not html_results.get(u,{}).get("coverageIncomplete") for u in seeds),
               "htmlTargets": len(html_results), "assetTargets": len(asset_results), "requestReservations": budget.requests, "bytesRead": budget.bytes,
               "incompleteHtmlCssSitemapBodies": sum(bool(r.get("coverageIncomplete")) for r in all_results.values()),
               "expectedShortAssetProbes": sum(bool(r.get("probeOnly")) for r in all_results.values()),
               "httpStatusCounts": dict(Counter(str(r.get("status", "not-received")) for r in all_results.values())),
               "issueCounts": dict(Counter(i["reason"] for i in issues)), "unrequestedExternalTargets": len(external), "deferredTargets": len(deferred), "staticMissingFragments": len(fragments),
               "scope": "HTML/HTTP smoke check only, not first-paint/browser/interaction/gameplay coverage.",
               "limits": vars(args),
               "coverageGaps": ["JavaScript is not executed. Games, downloads, archived code, authentication, forms and writes are not exercised.", "External-host links/assets are recorded but not requested. Only exact HTTPS allowlisted public hosts are fetched.", "Queries and fragments are removed for request deduplication; query-specific behavior is not covered.", "Only HTML attribute/inline-CSS references and CSS url()/@import references are discovered; JS imports/fetches, service workers and manifest dependencies are not evaluated.", "Asset GETs use a short byte range and a local read cap. This verifies an HTTP response, not full asset integrity or decoding.", "Static missing-fragment reports require review for runtime-generated anchors.", "Redirects may follow only allowlisted hosts; external redirect destinations are not fetched.", "HTML/CSS discovery, body reads, requests, bytes and time are bounded. Deferred, skipped and truncated results remain gaps.", "Runtime content changes since the pinned inventory may introduce or remove routes."]}
    # argparse callback functions are not serializable.
    summary["limits"] = {k:v for k,v in summary["limits"].items() if not callable(v)}
    for filename, data in (("route-results.json", live_routes), ("sitemap-results.json", list(sitemap_results.values())), ("summary.json", summary), ("issues.json", issues), ("references.json", references), ("external-unchecked.json", external), ("deferred.json", deferred), ("missing-fragments.json", fragments)):
        write_json(out / filename, data)
    print(json.dumps(summary, indent=2))
    hard = [i for i in issues if i.get("severity") != "observation"]
    if hard or deferred or summary["seedRoutesSuccessful"] != len(seeds):
        return 1
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    inv = sub.add_parser("inventory")
    inv.add_argument("--source-inventory", required=True)
    inv.add_argument("--blog-inventory", required=True)
    inv.add_argument("--main-source", required=True)
    inv.add_argument("--main-commit", required=True)
    inv.add_argument("--blog-commit", required=True)
    inv.add_argument("--blog-provenance", default="Earlier exact production build; release source commit requires independent confirmation")
    inv.add_argument("--previous-http")
    inv.add_argument("--output", required=True)
    inv.set_defaults(func=inventory)
    live = sub.add_parser("live")
    live.add_argument("--inventory", required=True)
    live.add_argument("--output", required=True)
    live.add_argument("--workers", type=int, default=4)
    live.add_argument("--rate", type=float, default=4)
    live.add_argument("--timeout", type=float, default=15)
    live.add_argument("--seconds", type=float, default=900)
    live.add_argument("--max-requests", type=int, default=3400)
    live.add_argument("--max-html", type=int, default=1000)
    live.add_argument("--max-assets", type=int, default=2200)
    live.add_argument("--max-total-bytes", type=int, default=100*1024*1024)
    live.add_argument("--max-html-bytes", type=int, default=8*1024*1024)
    live.add_argument("--max-css-bytes", type=int, default=1024*1024)
    live.add_argument("--asset-probe-bytes", type=int, default=4096)
    live.add_argument("--link-depth", type=int, default=2)
    live.add_argument("--css-depth", type=int, default=2)
    live.add_argument("--sitemap-root", dest="sitemap_roots", action="append")
    live.add_argument("--max-sitemaps", type=int, default=12)
    live.add_argument("--max-sitemap-entries", type=int, default=2000)
    live.set_defaults(func=run_live)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
