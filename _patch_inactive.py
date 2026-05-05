content = open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'rb').read()

# Replace the vendor cell to show name with inactive badge
old = b'text-xs font-mono">{t.vendedor_nome || (t.user_code ? String(t.user_code) : \'\\u2014\')}</td>'
new = b'text-xs font-mono">{t.vendedor_nome ? (<span>{t.vendedor_nome}{t.vendedor_ativo === false && <span className="ml-1 text-gray-400 text-[10px]">(inativo)</span>}</span>) : (t.user_code ? String(t.user_code) : \'\\u2014\')}</td>'

if old in content:
    content = content.replace(old, new, 1)
    print('CELL: OK')
else:
    print('CELL: NOT FOUND')
    idx = content.find(b'vendedor_nome')
    while idx != -1:
        print('At', idx, repr(content[idx-10:idx+100]))
        idx = content.find(b'vendedor_nome', idx+1)

open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'wb').write(content)
print('DONE')
