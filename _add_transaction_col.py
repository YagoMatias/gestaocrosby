pb = r'c:\Users\teccr\gestaocrosby\backend\routes\crm.routes.js'
pf = r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx'

# ── BACKEND ────────────────────────────────────────────────────────────────────
bc = open(pb, 'rb').read()

# 1. SELECT - add transaction_code if not present
if b'transaction_code' not in bc:
    old_s = b"'branch_code, invoice_code,"
    new_s = b"'branch_code, transaction_code, invoice_code,"
    bc = bc.replace(old_s, new_s, 1)
    print('SELECT patched')
else:
    print('SELECT already has transaction_code')

# 2. Response mapping - backend uses LF
old_m = b'          branch_code: n.branch_code,\n          invoice_code: n.invoice_code,'
new_m = b'          branch_code: n.branch_code,\n          transaction_code: n.transaction_code,\n          invoice_code: n.invoice_code,'
if old_m in bc:
    bc = bc.replace(old_m, new_m)
    print(f'Mapping patched ({bc.count(new_m)} occurrences)')
elif b'transaction_code: n.transaction_code' in bc:
    print('Mapping already patched')
else:
    raise Exception('Mapping pattern not found')

open(pb, 'wb').write(bc)
print('Backend saved')

# ── FRONTEND ───────────────────────────────────────────────────────────────────
fc = open(pf, 'rb').read()
eol = b'\r\n' if b'\r\n' in fc else b'\n'
pad = b'                    '

# 3. Thead array - add Transacao after NF
if b"field:'transaction_code'" not in fc:
    old_nf = b"{label:'NF',field:'invoice_code',align:'left',px:'px-3'},"
    new_nf = old_nf + b"{label:'Transacao',field:'transaction_code',align:'left',px:'px-3'},"
    assert old_nf in fc, 'Thead NF not found'
    fc = fc.replace(old_nf, new_nf, 1)
    print('Thead patched')
else:
    print('Thead already has transaction_code')

# 4. Tbody cell
if b't.transaction_code' not in fc:
    invoice_td = b"font-mono\">{t.invoice_code || '\\u2014'}</td>"
    assert invoice_td in fc, 'invoice_code td not found'
    new_cell = invoice_td + eol + pad + b"<td className=\"py-2.5 px-3 text-gray-500 text-xs font-mono\">{t.transaction_code || '\\u2014'}</td>"
    fc = fc.replace(invoice_td, new_cell, 1)
    print('Tbody cell patched')
else:
    print('Tbody already has transaction_code')

# 5. CSV header
if b"'Transacao'" not in fc:
    old_h = b"const header = ['Data','Filial','NF','Cliente',"
    assert old_h in fc, 'CSV header not found'
    fc = fc.replace(old_h, b"const header = ['Data','Filial','NF','Transacao','Cliente',", 1)
    print('CSV header patched')

# 6. CSV row
if b't.transaction_code' not in fc:
    old_r = b"t.issue_date, t.branch_code, t.invoice_code || '-',"
    assert old_r in fc, 'CSV row not found'
    fc = fc.replace(old_r, b"t.issue_date, t.branch_code, t.invoice_code || '-', t.transaction_code || '',", 1)
    print('CSV row patched')

open(pf, 'wb').write(fc)
print('Frontend saved')
print('ALL DONE')
