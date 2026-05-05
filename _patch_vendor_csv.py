content = open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'rb').read()

# Update CSV row to show vendedor_nome || user_code
old = b"t.user_code || '',"
new = b"t.vendedor_nome || t.user_code || '',"

if old in content:
    content = content.replace(old, new, 1)
    print('CSV: OK')
else:
    print('CSV: NOT FOUND')
    idx = content.find(b'user_code')
    while idx != -1:
        print('At', idx, repr(content[idx-10:idx+50]))
        idx = content.find(b'user_code', idx+1)

open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'wb').write(content)
print('DONE')
