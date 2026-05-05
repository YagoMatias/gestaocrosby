import sys

path = r'c:\Users\teccr\gestaocrosby\src\pages\FaturamentoCanal.jsx'
content = open(path, 'rb').read()

# ── 1. Adicionar estado de sort após useState('') do busca ─────────────────
old1 = b"  const [busca, setBusca] = useState('');\r\n"
new1 = (
    b"  const [busca, setBusca] = useState('');\r\n"
    b"  const [sortField, setSortField] = useState('issue_date');\r\n"
    b"  const [sortDir, setSortDir] = useState('desc');\r\n"
)
assert old1 in content, 'PATCH 1 not found'
content = content.replace(old1, new1, 1)

# ── 2. Substituir o useMemo de transacoesFiltradas para incluir sort ────────
old2 = (
    b"  const transacoesFiltradas = useMemo(() => {\r\n"
    b"    if (!dados?.transacoes) return [];\r\n"
    b"    if (!busca) return dados.transacoes;\r\n"
    b"    const b = busca.toLowerCase();\r\n"
    b"    return dados.transacoes.filter(t =>\r\n"
    b"      (t.person_name || '').toLowerCase().includes(b) ||\r\n"
    b"      (t.invoice_code || '').toLowerCase().includes(b) ||\r\n"
    b"      (t.operation_name || '').toLowerCase().includes(b) ||\r\n"
    b"      String(t.branch_code).includes(b)\r\n"
    b"    );\r\n"
    b"  }, [dados, busca]);\r\n"
)
new2 = (
    b"  const transacoesFiltradas = useMemo(() => {\r\n"
    b"    if (!dados?.transacoes) return [];\r\n"
    b"    let list = dados.transacoes;\r\n"
    b"    if (busca) {\r\n"
    b"      const b = busca.toLowerCase();\r\n"
    b"      list = list.filter(t =>\r\n"
    b"        (t.person_name || '').toLowerCase().includes(b) ||\r\n"
    b"        (t.invoice_code || '').toLowerCase().includes(b) ||\r\n"
    b"        (t.operation_name || '').toLowerCase().includes(b) ||\r\n"
    b"        String(t.branch_code).includes(b)\r\n"
    b"      );\r\n"
    b"    }\r\n"
    b"    list = [...list].sort((a, b) => {\r\n"
    b"      let va = a[sortField]; let vb = b[sortField];\r\n"
    b"      if (va == null && vb == null) return 0;\r\n"
    b"      if (va == null) return 1;\r\n"
    b"      if (vb == null) return -1;\r\n"
    b"      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;\r\n"
    b"      return sortDir === 'asc'\r\n"
    b"        ? String(va).localeCompare(String(vb), 'pt-BR')\r\n"
    b"        : String(vb).localeCompare(String(va), 'pt-BR');\r\n"
    b"    });\r\n"
    b"    return list;\r\n"
    b"  }, [dados, busca, sortField, sortDir]);\r\n"
)
assert old2 in content, 'PATCH 2 not found'
content = content.replace(old2, new2, 1)

# ── 3. Substituir o <thead> com cabeçalhos clicáveis ──────────────────────
old3 = (
    b'<thead className="sticky top-0 bg-white border-b border-gray-200 z-10">\r\n'
    b'                <tr>\r\n'
    b'                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>\r\n'
    b'                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Filial</th>\r\n'
    b'                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NF</th>\r\n'
    b'                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>\r\n'
    b'                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Operacao</th>\r\n'
    b'                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>\r\n'
    b'                  <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Pagamento</th>\r\n'
    b'                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>\r\n'
    b'                </tr>\r\n'
    b'              </thead>'
)
new3 = (
    b'<thead className="sticky top-0 bg-white border-b border-gray-200 z-10">\r\n'
    b'                <tr>\r\n'
    b'                  {[{label:\'Data\',field:\'issue_date\',align:\'left\',px:\'px-4\'},{label:\'Filial\',field:\'branch_code\',align:\'left\',px:\'px-3\'},{label:\'NF\',field:\'invoice_code\',align:\'left\',px:\'px-3\'},{label:\'Cliente\',field:\'person_name\',align:\'left\',px:\'px-3\'},{label:\'Operacao\',field:\'operation_name\',align:\'left\',px:\'px-3\'},{label:\'Vendedor\',field:\'vendedor_nome\',align:\'left\',px:\'px-3\'}].map(({label,field,align,px}) => (\r\n'
    b'                    <th key={field} onClick={() => { if (sortField === field) setSortDir(d => d === \'asc\' ? \'desc\' : \'asc\'); else { setSortField(field); setSortDir(\'asc\'); } }} className={`text-${align} py-3 ${px} text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap`}>\r\n'
    b'                      {label}{sortField === field ? (sortDir === \'asc\' ? \' \xe2\x96\xb2\' : \' \xe2\x96\xbc\') : \'\'}\r\n'
    b'                    </th>\r\n'
    b'                  ))}\r\n'
    b'                  <th onClick={() => { if (sortField === \'payment_condition\') setSortDir(d => d === \'asc\' ? \'desc\' : \'asc\'); else { setSortField(\'payment_condition\'); setSortDir(\'asc\'); } }} className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 hidden md:table-cell whitespace-nowrap">\r\n'
    b'                    Pagamento{sortField === \'payment_condition\' ? (sortDir === \'asc\' ? \' \xe2\x96\xb2\' : \' \xe2\x96\xbc\') : \'\'}\r\n'
    b'                  </th>\r\n'
    b'                  <th onClick={() => { if (sortField === \'total_value\') setSortDir(d => d === \'asc\' ? \'desc\' : \'asc\'); else { setSortField(\'total_value\'); setSortDir(\'desc\'); } }} className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">\r\n'
    b'                    Valor{sortField === \'total_value\' ? (sortDir === \'asc\' ? \' \xe2\x96\xb2\' : \' \xe2\x96\xbc\') : \'\'}\r\n'
    b'                  </th>\r\n'
    b'                </tr>\r\n'
    b'              </thead>'
)
assert old3 in content, 'PATCH 3 not found'
content = content.replace(old3, new3, 1)

open(path, 'wb').write(content)
print('DONE - 3 patches applied')
