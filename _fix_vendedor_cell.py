content = open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'rb').read()

old = b"(t.user_code ? String(t.user_code) : '\\u2014')"
new = b"(t.dealer_code ? String(t.dealer_code) : '\\u2014')"

if old in content:
    print('Found! Replacing...')
    content = content.replace(old, new)
    open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'wb').write(content)
    print('Done.')
else:
    print('Pattern not found. Searching for user_code occurrences:')
    idx = content.find(b'user_code')
    while idx != -1:
        print(repr(content[max(0,idx-60):idx+120]))
        print('---')
        idx = content.find(b'user_code', idx+1)
