import argparse
import contextlib
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
import route_audit as a


class Response(io.BytesIO):
    def __init__(self, data, status=200, content_type='text/html', final='https://tront.xyz/'):
        super().__init__(data)
        self.status=status
        self.headers={'Content-Type':content_type, 'Content-Length':str(len(data))}
        self.final=final
    def geturl(self):return self.final


def args(**changes):
    values=dict(seconds=10,rate=4,timeout=1,max_total_bytes=100000,max_requests=10,max_html_bytes=10000,max_css_bytes=10000,asset_probe_bytes=1000,max_sitemaps=12,max_sitemap_entries=2000,sitemap_roots=[])
    values.update(changes)
    return argparse.Namespace(**values)


class Tests(unittest.TestCase):
    def test_url_identity(self):
        self.assertEqual(a.clean_url('../X/?a=1#z','https://tront.xyz/blog/post/'),'https://tront.xyz/blog/X/')
        self.assertNotEqual(a.clean_url('/A/','https://tront.xyz/'),a.clean_url('/a/','https://tront.xyz/'))
    def test_no_action_schemes(self):
        for url in ['javascript:alert(1)','mailto:a@b.com','data:text/plain,hi','https://u:p@tront.xyz/']:
            self.assertIsNone(a.clean_url(url,'https://tront.xyz/'))
    def test_host_allowlist(self):
        for url in ['http://tront.xyz/','https://tront.xyz.evil.example/','https://evil.example/','https://tront.xyz:8443/','https://u:p@tront.xyz/']:
            self.assertFalse(a.allowed(url))
        for url in ['https://tront.xyz/','https://monke.tront.xyz/','https://punk.tront.xyz/']:
            self.assertTrue(a.allowed(url))
    def test_invalid_port(self):
        self.assertIsNone(a.clean_url('https://tront.xyz:bad/a','https://tront.xyz/'))
    def test_metadata(self):
        h=a.Page('<title>A &amp; B</title><link rel="canonical" href="/a/"><meta name="description" content="desc"><meta name="robots" content="noindex">','https://tront.xyz/').metadata()
        self.assertEqual(h['title'],'A & B');self.assertEqual(h['canonicals'],['https://tront.xyz/a/']);self.assertEqual(h['descriptions'],['desc'])
    def test_base_refs_fragments(self):
        h=a.Page('<base href="/blog/"><a href="x/?q=1#intro">X</a><img src="i.png"><div id="intro"></div>','https://tront.xyz/').metadata()
        self.assertEqual(h['references'][0]['url'],'https://tront.xyz/blog/x/');self.assertEqual(h['references'][0]['fragment'],'intro');self.assertTrue(h['references'][0]['queryIgnored'])
    def test_srcset_css_and_lazy_images(self):
        h=a.Page('<style>.a{background:url(a.png)}</style><img srcset="b.png 1x, c.png 2x" data-src="d.png" style="background:url(e.png)">','https://tront.xyz/').metadata()
        self.assertEqual({r['url'] for r in h['references']},{'https://tront.xyz/'+x+'.png' for x in 'abcde'})
    def test_do_not_evaluate_scripts_or_forms(self):
        h=a.Page('<script>fetch("/secret"); location="/write"</script><form action="/delete" method="post"></form>','https://tront.xyz/').metadata()
        self.assertEqual(h['references'],[]);self.assertEqual(h['formsNotSubmitted'][0]['method'],'post')
    def test_css_import(self):
        self.assertEqual(a.css_refs('@import "a.css"; .a { background:url(\'b.png\'); }'),['a.css','b.png'])
    def test_html_classifier(self):
        self.assertTrue(a.is_html_url('https://tront.xyz/blog/'));self.assertTrue(a.is_html_url('https://tront.xyz/404.html'));self.assertFalse(a.is_html_url('https://tront.xyz/x.swf'))
    def test_no_network_outside_allowed_hosts(self):
        with patch('urllib.request.build_opener') as op:
            r=a.fetch('https://example.com/','html',args(),a.Budget(args()))
            op.assert_not_called();self.assertIn('skipped',r)
    def fake_fetch(self, body, kind='html', status=200, content_type='text/html', **kwargs):
        ar=args(**kwargs)
        with patch('urllib.request.build_opener') as op:
            op.return_value.open.return_value=Response(body,status,content_type)
            return a.fetch('https://tront.xyz/',kind,ar,a.Budget(ar))
    def test_success_html(self):
        r=self.fake_fetch(b'<html><title>Home</title></html>');self.assertTrue(r['ok']);self.assertEqual(r['html']['title'],'Home')
    def test_proxy_not_success(self):
        r=self.fake_fetch(b'<html><title>SiteUnavailable</title></html>');self.assertFalse(r['ok']);self.assertTrue(r['intermediaryError'])
    def test_soft_404(self):
        r=self.fake_fetch(b'<html><title>404: Page not found</title></html>');self.assertTrue(r['possibleSoft404'])
    def test_asset_html(self):
        r=self.fake_fetch(b'<html>404</html>',kind='asset');self.assertTrue(r['unexpectedHtmlAsset'])
    def test_body_cap(self):
        r=self.fake_fetch(b'<html>'+b'x'*2000,max_html_bytes=100);self.assertTrue(r['bodyTruncated']);self.assertEqual(r['bytesRead'],101)
    def test_request_budget(self):
        ar=args(max_requests=0)
        with patch('urllib.request.build_opener') as op:
            r=a.fetch('https://tront.xyz/','html',ar,a.Budget(ar));op.assert_not_called();self.assertEqual(r['skipped'],'request-budget')
    def test_external_redirect_blocked(self):
        ar=args();handler=a.SafeRedirect(a.Budget(ar));req=__import__('urllib.request',fromlist=['Request']).Request('https://tront.xyz/')
        with self.assertRaises(urllib.error.HTTPError):handler.redirect_request(req,None,301,'',{},'https://example.com/')
        self.assertEqual(len(handler.history),1)
    def test_live_report_uses_actual_results(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);inv=base/'in.json';inv.write_text(json.dumps({'routes':[{'url':'https://tront.xyz/','categories':['main'],'provenance':[]}]}))
            ar=args(inventory=str(inv),output=str(base/'out'),workers=1,max_html=3,max_assets=3,link_depth=1,css_depth=1)
            def fake(url,kind,args,budget):
                return {'url':url,'kind':kind,'status':200,'ok':True,'htmlLike':True,'html':a.Page('<title>A</title><a href="/b/">B</a>',url).metadata()}
            with patch.object(a,'fetch',side_effect=fake):
                self.assertEqual(a.run_live(ar),0)
            report=json.loads((base/'out/summary.json').read_text());self.assertEqual(report['seedRoutesSuccessful'],1);self.assertEqual(report['htmlTargets'],2)

    def test_proxy_with_whitespace_not_success(self):
        r=self.fake_fetch(b'<html><title>Site Unavailable</title></html>');self.assertFalse(r['ok']);self.assertTrue(r['intermediaryError'])
    def test_html_body_cap_is_coverage_gap(self):
        r=self.fake_fetch(b'<html>'+b'x'*2000,max_html_bytes=100);self.assertTrue(r['coverageIncomplete']);self.assertFalse(r['probeOnly'])
    def test_css_body_cap_is_coverage_gap(self):
        r=self.fake_fetch(b'.a{color:red}'+b'x'*2000,kind='asset',content_type='text/css',asset_probe_bytes=100);self.assertTrue(r['coverageIncomplete'])
    def test_binary_probe_is_not_coverage_gap(self):
        r=self.fake_fetch(b'x'*2000,kind='asset',content_type='image/png',asset_probe_bytes=100);self.assertTrue(r['bodyTruncated']);self.assertTrue(r['probeOnly']);self.assertFalse(r['coverageIncomplete'])
    def test_sitemap_xml(self):
        r=self.fake_fetch(b'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://tront.xyz/tutorials/sitemap.xml</loc></sitemap></sitemapindex>',kind='sitemap',content_type='application/xml')
        self.assertEqual(r['sitemapType'],'sitemapindex');self.assertEqual(r['sitemapEntries'][0]['kind'],'sitemap')
    def test_sitemap_dtd_rejected(self):
        r=self.fake_fetch(b'<!DOCTYPE x [<!ENTITY x "hello">]><urlset/>',kind='sitemap',content_type='application/xml');self.assertIn('sitemapError',r)
    def report_from_fake(self, fake, **changes):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);inv=base/'in.json';inv.write_text(json.dumps({'routes':[{'url':'https://tront.xyz/','categories':['main'],'provenance':[]}]}))
            ar=args(inventory=str(inv),output=str(base/'out'),workers=1,max_html=3,max_assets=3,link_depth=1,css_depth=1)
            for key,value in changes.items():setattr(ar,key,value)
            with patch.object(a,'fetch',side_effect=fake),contextlib.redirect_stdout(io.StringIO()):code=a.run_live(ar)
            return code,json.loads((base/'out/summary.json').read_text()),json.loads((base/'out/issues.json').read_text())
    def test_truncated_live_html_is_nonclean(self):
        def fake(url,kind,args,budget):return {'url':url,'kind':kind,'status':200,'ok':True,'htmlLike':True,'coverageIncomplete':True,'bodyTruncated':True,'html':a.Page('<title>A</title>',url).metadata()}
        code,summary,issues=self.report_from_fake(fake)
        self.assertEqual(code,1);self.assertEqual(summary['seedRoutesSuccessful'],0);self.assertTrue(any(x['reason']=='coverage-gap:incomplete-html-body' for x in issues))
    def sitemap_fake(self,url,kind,args,budget):
        base={'url':url,'kind':kind,'status':200,'ok':True}
        if kind=='sitemap':
            if url.endswith('/sitemap.xml') and '/tutorials/' not in url:return {**base,'sitemapEntries':[{'raw':'https://tront.xyz/tutorials/sitemap.xml','url':'https://tront.xyz/tutorials/sitemap.xml','kind':'sitemap'}]}
            return {**base,'sitemapEntries':[{'raw':'https://tront.xyz/tutorials/new/','url':'https://tront.xyz/tutorials/new/','kind':'url'}]}
        return {**base,'htmlLike':True,'html':a.Page('<title>A</title>',url).metadata()}
    def test_sitemap_discovery_has_distinct_counts(self):
        code,summary,issues=self.report_from_fake(self.sitemap_fake,sitemap_roots=['https://tront.xyz/sitemap.xml'])
        self.assertEqual(code,0);self.assertEqual(summary['sitemapFiles'],2);self.assertEqual(summary['staticSeedRoutes'],1);self.assertEqual(summary['sitemapDiscoveredAdditionalRoutes'],1)
    def test_sitemap_file_cap_nonclean(self):
        code,summary,issues=self.report_from_fake(self.sitemap_fake,sitemap_roots=['https://tront.xyz/sitemap.xml'],max_sitemaps=1)
        self.assertEqual(code,1);self.assertTrue(any(x['reason']=='coverage-gap:sitemap-file-cap' for x in issues))
    def test_sitemap_entry_cap_nonclean(self):
        code,summary,issues=self.report_from_fake(self.sitemap_fake,sitemap_roots=['https://tront.xyz/sitemap.xml'],max_sitemap_entries=1)
        self.assertEqual(code,1);self.assertTrue(any(x['reason']=='coverage-gap:sitemap-entry-cap' for x in issues))
    def test_external_sitemap_not_requested(self):
        calls=[]
        def fake(url,kind,args,budget):calls.append(url);return self.sitemap_fake(url,kind,args,budget)
        code,summary,issues=self.report_from_fake(fake,sitemap_roots=['https://example.com/sitemap.xml'])
        self.assertEqual(code,1);self.assertNotIn('https://example.com/sitemap.xml',calls)

if __name__=='__main__':unittest.main()
