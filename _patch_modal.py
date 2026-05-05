content = open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'rb').read()

# 1. Add Vendedor TH header
old_hdr = b'>Operacao</th>\r\n                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Pagamento</th>'
new_hdr = b'>Operacao</th>\r\n                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>\r\n                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Pagamento</th>'

if old_hdr in content:
    content = content.replace(old_hdr, new_hdr, 1)
    print('HEADER: OK')
else:
    print('HEADER: NOT FOUND')

# 2. Add Vendedor TD cell - find the cell after operation_name td
old_cell = b't.operation_name || t.operation_code}</td>\r\n                    <td className="py-2.5 px-3 text-gray-500 text-xs hidden md:table-cell max-w-[120px] truncate">'
new_cell = b't.operation_name || t.operation_code}</td>\r\n                    <td className="py-2.5 px-3 text-gray-500 text-xs font-mono">{t.user_code || \'\u2014\'}</td>\r\n                    <td className="py-2.5 px-3 text-gray-500 text-xs hidden md:table-cell max-w-[120px] truncate">'

if old_cell in content:
    content = content.replace(old_cell, new_cell, 1)
    print('CELL: OK')
else:
    print('CELL: NOT FOUND')

# 3. Fix colspan in tfoot (was 6, now needs to be 7 due to new column)
old_colspan = b'<td colSpan={6} className="py-3 px-4 text-sm font-bold text-gray-700">'
new_colspan = b'<td colSpan={7} className="py-3 px-4 text-sm font-bold text-gray-700">'

if old_colspan in content:
    content = content.replace(old_colspan, new_colspan, 1)
    print('COLSPAN: OK')
else:
    print('COLSPAN: NOT FOUND')

# 4. Add user_code to CSV export header and rows
old_csv_hdr = b"const header = ['Data','Filial','NF','Cliente','Cod. Cliente','Operacao','Pagamento','Valor'];"
new_csv_hdr = b"const header = ['Data','Filial','NF','Cliente','Cod. Cliente','Operacao','Vendedor','Pagamento','Valor'];"

if old_csv_hdr in content:
    content = content.replace(old_csv_hdr, new_csv_hdr, 1)
    print('CSV HDR: OK')
else:
    print('CSV HDR: NOT FOUND')

old_csv_row = b't.person_code,\r\n      \'"\'  + (t.operation_name || \'\').replace(/"/g, "\'"\'") + \'"\','
new_csv_row = b't.person_code,\r\n      \'"\'  + (t.operation_name || \'\').replace(/"/g, "\'"\'") + \'"\',\r\n      t.user_code || \'\','

if old_csv_row in content:
    content = content.replace(old_csv_row, new_csv_row, 1)
    print('CSV ROW: OK')
else:
    print('CSV ROW: NOT FOUND (checking alt)')
    # Try to find user_code insertion point another way
    idx = content.find(b'(t.operation_name || \'\').replace')
    if idx > -1:
        print('Found operation_name at', idx, repr(content[idx:idx+120]))

open(r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx', 'wb').write(content)
print('DONE')
