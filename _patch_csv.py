content = open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'rb').read()

old = b"+ '\"',\r\n      '\"' + (t.payment_condition"
new = b"+ '\"',\r\n      t.user_code || '',\r\n      '\"' + (t.payment_condition"

if old in content:
    content = content.replace(old, new, 1)
    print('CSV ROW: OK')
else:
    print('CSV ROW: NOT FOUND')
    idx = content.find(b'payment_condition')
    print(repr(content[idx-80:idx+60]))

open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'wb').write(content)
print('DONE')
