# ✅ TESTE RÁPIDO: Formato de Data Corrigido

## 🎯 Como Testar

### 1. Abra o Console do Navegador

Pressione `F12` → aba **Console**

### 2. Crie um Filtro de Data

1. Abra modal de criar widget
2. Selecione tabela `tra_transacao`
3. Vá para Step 2: Filtros
4. Adicione filtro:
   - Coluna: `dt_transacao (datetime2)`
   - Operador: `>`
   - Valor: Digite apenas a data: `2025-10-19`

### 3. Clique em Preview ou Próximo

### 4. Verifique o Console

**✅ SUCESSO - Você verá:**

```javascript
📅 [formatFilters] 2025-10-19 → 2025-10-19 00:00:00

🌐 [executeQuery] Executando query: {
  from: "tra_transacao",
  where: [{
    column: "dt_transacao",
    operator: ">",
    value: "2025-10-19 00:00:00"  // ✅ Hora adicionada!
  }]
}

✅ [executeQuery] Resultado: { success: true, ... }
```

**❌ FALHA - Se ver:**

```javascript
❌ [executeQuery] Erro: Parâmetros inválidos

// Valor ainda está:
value: "2025-10-19"  // ❌ Sem hora
```

---

## 🧪 Testes Diferentes

### Teste A: Apenas Data

**Digite:** `2025-10-19`  
**Esperado:** `2025-10-19 00:00:00`

### Teste B: Data + Hora (com seletor)

**Selecione:** `19/10/2025 14:30`  
**Esperado:** `2025-10-19 14:30:00`

### Teste C: Múltiplos Filtros

**Filtro 1:** `dt_transacao >= 2025-10-01`  
**Filtro 2:** `dt_transacao <= 2025-10-31`

**Esperado:**

```javascript
[{ value: '2025-10-01 00:00:00' }, { value: '2025-10-31 00:00:00' }];
```

---

## 📊 Resultado Visual no Console

```
Console (antes da correção):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 [executeQuery] Executando query
where: [{ value: "2025-10-19" }]
❌ 400 Bad Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Console (depois da correção):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 [formatFilters] 2025-10-19 → 2025-10-19 00:00:00
🌐 [executeQuery] Executando query
where: [{ value: "2025-10-19 00:00:00" }]
✅ 200 OK - 15 registros
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ✅ Checklist

```
[ ] Console mostra log "📅 [formatFilters]"
[ ] Valor convertido tem " 00:00:00" no final
[ ] Requisição retorna 200 OK (não 400)
[ ] Preview carrega dados
[ ] Widget salva sem erro
```

---

## 🔧 Se Não Funcionar

### 1. Limpe o cache do navegador

```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### 2. Verifique se está no arquivo correto

```
src/components/WidgetBuilderModal.jsx
Linha ~260: função formatFiltersForBackend
```

### 3. Verifique se o código foi salvo

```
// Deve ter este trecho:
else if (/^\d{4}-\d{2}-\d{2}$/.test(formattedValue)) {
  formattedValue = `${formattedValue} 00:00:00`;
}
```

### 4. Reinicie o servidor

```powershell
# Pare o servidor (Ctrl + C)
npm run dev
```

---

## 🎉 Confirmação de Sucesso

**✅ Está funcionando se:**

1. Log `📅 [formatFilters]` aparece no console
2. Data sem hora vira data com `00:00:00`
3. Preview/Save não dá erro 400
4. Dados são carregados corretamente

**🚀 PRONTO PARA USO!**
