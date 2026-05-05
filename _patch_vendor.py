content = open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'rb').read()

# Update cell to show nome if available, else user_code
old = b'text-xs font-mono">{t.user_code || \'\u2014\'}</td>'
new = b'text-xs font-mono">{t.vendedor_nome || (t.user_code ? String(t.user_code) : \'\u2014\')}</td>'

if old in content:
    content = content.replace(old, new, 1)
    print('CELL: OK')
else:
    print('CELL: NOT FOUND - checking...')
    idx = content.find(b'user_code')
    while idx != -1:
        seg = content[idx:idx+80]
        if b'2014' in seg or b'\\u' in seg:
            print('At', idx, repr(content[idx-30:idx+80]))
        idx = content.find(b'user_code', idx+1)

open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'wb').write(content)
print('DONE')
