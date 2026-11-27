"""산업연관분석 관련 뉴스를 구글 뉴스 RSS에서 모아 news.json으로 저장한다.
GitHub Actions가 매일 한 번 실행한다. 새로 가져오지 못하면 기존 news.json을 그대로 둔다."""
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

QUERIES = ['"산업연관표"', '"산업연관분석"', '"투입산출표"']   # 검색어는 여기서 바꿀 수 있습니다
KEEP = 30            # 저장해 둘 최대 기사 수
OUT = 'news.json'
KST = timezone(timedelta(hours=9))


def fetch(query):
    url = 'https://news.google.com/rss/search?' + urllib.parse.urlencode(
        {'q': query + ' when:180d', 'hl': 'ko', 'gl': 'KR', 'ceid': 'KR:ko'})
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def parse_rss(data):
    items = []
    for it in ET.fromstring(data).iter('item'):
        title = (it.findtext('title') or '').strip()
        link = (it.findtext('link') or '').strip()
        pub = it.findtext('pubDate')
        src_el = it.find('source')
        source = (src_el.text or '').strip() if src_el is not None else ''
        if source and title.endswith(' - ' + source):      # 제목 끝의 " - 매체명" 제거
            title = title[: -len(source) - 3].strip()
        try:
            date = parsedate_to_datetime(pub).astimezone(KST).strftime('%Y-%m-%d')
        except Exception:
            date = ''
        if title and link.startswith('http'):
            items.append({'title': title, 'link': link, 'source': source, 'date': date})
    return items


def main():
    old = []
    if os.path.exists(OUT):
        try:
            old = json.load(open(OUT, encoding='utf-8')).get('items', [])
        except Exception:
            old = []
    new = []
    for q in QUERIES:
        try:
            new += parse_rss(fetch(q))
        except Exception as e:
            print('검색 실패:', q, e, file=sys.stderr)
    if not new:
        print('새 기사를 가져오지 못해 기존 파일을 유지합니다.')
        return
    merged, seen = [], set()
    for a in new + old:                                    # 새 기사를 앞에 두고 중복 제거
        key = a['link']
        if key in seen:
            continue
        seen.add(key)
        merged.append(a)
    merged.sort(key=lambda a: a.get('date', ''), reverse=True)
    out = {'updatedAt': datetime.now(KST).strftime('%Y-%m-%d %H:%M'), 'items': merged[:KEEP]}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('저장:', len(out['items']), '건')


if __name__ == '__main__':
    main()
c
