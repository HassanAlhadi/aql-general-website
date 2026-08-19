import re, json, subprocess, os
src = open('Main.dc.html', encoding='utf-8').read()
tpl = src.split('<x-dc>',1)[1].split('</x-dc>',1)[0]
helmet = tpl.split('<helmet>',1)[1].split('</helmet>',1)[0]
body = tpl.split('</helmet>',1)[1]

# evaluate the component's renderVals() with node so the preview always matches the source
logic = src.split('<script data-dc-script',1)[1].split('>',1)[1].rsplit('</script>',1)[0]
shim = '''
class DCLogic { constructor(p){ this.props=p||{}; this.state={clock:'\\u0660\\u0662:\\u0664\\u0660'}; } setState(o){Object.assign(this.state,o);} }
''' + logic + '''
const c = new Component({});
process.stdout.write(JSON.stringify(c.renderVals()));
'''
open('/tmp/_logic.mjs','w',encoding='utf-8').write(shim)
vals = json.loads(subprocess.run(['node','/tmp/_logic.mjs'],capture_output=True,text=True,check=True).stdout)

def fill(t, ctx):
    def rep(m):
        cur = ctx
        for p in m.group(1).strip().split('.'):
            if isinstance(cur, dict) and p in cur: cur = cur[p]
            else: return m.group(0)
        return str(cur)
    return re.sub(r'\{\{\s*([\w.$]+)\s*\}\}', rep, t)

def find_block(t, start):
    """Return (inner_start, inner_end, close_end) for the sc-for opened at `start`,
    matching nested sc-for tags instead of stopping at the first close."""
    open_end = t.index('>', start) + 1
    depth, i = 1, open_end
    while depth:
        nxt_o = t.find('<sc-for', i)
        nxt_c = t.find('</sc-for>', i)
        if nxt_c == -1:
            raise ValueError('unbalanced sc-for')
        if nxt_o != -1 and nxt_o < nxt_c:
            depth += 1; i = nxt_o + 7
        else:
            depth -= 1; i = nxt_c + 9
    return open_end, i - 9, i


def expand(t, ctx):
    head = re.compile(r'<sc-for list="\{\{([\w.]+)\}\}" as="(\w+)"')
    out, pos = [], 0
    while True:
        m = head.search(t, pos)
        if not m:
            out.append(t[pos:]); break
        out.append(t[pos:m.start()])
        inner_start, inner_end, close_end = find_block(t, m.start())
        inner = t[inner_start:inner_end]
        cur = ctx
        for part in m.group(1).split('.'):
            cur = cur.get(part, []) if isinstance(cur, dict) else []
        for i, item in enumerate(cur or []):
            c2 = dict(ctx); c2[m.group(2)] = item; c2['$index'] = i
            out.append(expand(inner, c2))
        pos = close_end
    return fill(''.join(out), ctx)


body = expand(body, vals)
# resolve sc-if against the literals fill() left behind
body = re.sub(r'<sc-if value="(true|True)"[^>]*>(.*?)</sc-if>', lambda m: m.group(2), body, flags=re.S)
body = re.sub(r'<sc-if value="(false|False)"[^>]*>.*?</sc-if>', '', body, flags=re.S)

helmet = helmet.replace(
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kufam:wght@400..900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">',
  '<link rel="stylesheet" href="./fonts/fonts.css">')

open('preview.html','w',encoding='utf-8').write(
f'''<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>عقل لتقنية المعلومات</title>
{helmet}
</head><body>{body}</body></html>''')
print('preview rebuilt from source')
