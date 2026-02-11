#!/usr/bin/env bash
set -euo pipefail

# NHB Inventory Sync — pulls from Notion, rebuilds the PWA
# Usage: ./sync.sh [--push]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NOTION_TOKEN="${NOTION_TOKEN:-$(cat "$SCRIPT_DIR/.notion-token" 2>/dev/null || true)}"
DB_ID="254dd4a4-d25c-80dd-96d4-dcfce8a34bb1"

if [[ -z "$NOTION_TOKEN" ]]; then
    echo "Error: Set NOTION_TOKEN env var or create .notion-token file"
    exit 1
fi

echo "Pulling inventory from Notion..."

python3 -c "
import urllib.request, json, sys

token = '$NOTION_TOKEN'
db_id = '$DB_ID'
headers = {
    'Authorization': f'Bearer {token}',
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
}

items = []
cursor = None
while True:
    body = {'page_size': 100}
    if cursor:
        body['start_cursor'] = cursor
    req = urllib.request.Request(
        f'https://api.notion.com/v1/databases/{db_id}/query',
        data=json.dumps(body).encode(),
        headers=headers,
        method='POST'
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())

    for page in data['results']:
        if page.get('in_trash'):
            continue
        props = page['properties']

        def txt(p):
            v = props.get(p, {})
            if v.get('type') == 'title':
                return ''.join(t['plain_text'] for t in v.get('title', []))
            if v.get('type') == 'rich_text':
                return ''.join(t['plain_text'] for t in v.get('rich_text', []))
            return ''

        def sel(p):
            v = props.get(p, {})
            s = v.get('select')
            return s['name'] if s else ''

        def num(p):
            v = props.get(p, {})
            return v.get('number')

        def multi(p):
            v = props.get(p, {})
            return [o['name'] for o in v.get('multi_select', [])]

        name = txt('Item')
        if not name:
            continue

        item = {'n': name}
        a = sel('Area')
        if a: item['a'] = a
        l = txt('Location')
        if l: item['l'] = l
        q = num('Quantity')
        if q is not None: item['q'] = q
        t = txt('Note')
        if t: item['t'] = t
        s = sel('Status')
        if s: item['s'] = s
        p = multi('Priority')
        if p: item['p'] = p

        items.append(item)

    if not data.get('has_more'):
        break
    cursor = data['next_cursor']

items.sort(key=lambda x: x['n'])
print(f'Fetched {len(items)} items', file=sys.stderr)

json.dump(items, sys.stdout, separators=(',', ':'), ensure_ascii=False)
" > /tmp/nhb-sync-data.json

ITEM_COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/nhb-sync-data.json'))))")
echo "Got $ITEM_COUNT items"

echo "Building index.html..."

# Read the existing index.html and replace only the JSON data block
python3 -c "
import re, json

with open('/tmp/nhb-sync-data.json') as f:
    data = f.read()

# Escape </ for safe HTML embedding
safe = data.replace('</', '<\\\/')

with open('$SCRIPT_DIR/index.html') as f:
    html = f.read()

# Replace content between the script tags
html = re.sub(
    r'(<script id=\"inventory-data\" type=\"application/json\">).*?(</script>)',
    r'\1\n' + safe + r'\n\2',
    html,
    flags=re.DOTALL
)

with open('$SCRIPT_DIR/index.html', 'w') as f:
    f.write(html)

print('index.html updated')
"

# Bump service worker cache version
CURRENT=$(grep -oP "nhb-inventory-v\K\d+" "$SCRIPT_DIR/sw.js")
NEXT=$((CURRENT + 1))
sed -i '' "s/nhb-inventory-v${CURRENT}/nhb-inventory-v${NEXT}/" "$SCRIPT_DIR/sw.js"
echo "Service worker bumped to v${NEXT}"

echo ""
echo "Sync complete! $ITEM_COUNT items embedded."
echo "Test locally: cd $SCRIPT_DIR && python3 -m http.server 8000"

if [[ "${1:-}" == "--push" ]]; then
    cd "$SCRIPT_DIR"
    git add index.html sw.js
    git commit -m "sync: update inventory data ($ITEM_COUNT items)"
    git push
    echo "Pushed to GitHub!"
fi
