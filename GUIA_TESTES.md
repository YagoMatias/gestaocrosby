# 🧪 Guia de Testes - Sistema de Dashboards

## ✅ Verificação Pré-Requisitos

- [ ] Backend rodando: `http://localhost:5000`
- [ ] Frontend rodando: `http://localhost:3001`
- [ ] Supabase configurado e acessível
- [ ] Usuário admin/owner disponível
- [ ] Usuários normais criados para atribuição

---

## 🎯 Testes Funcionais

### 1️⃣ Autenticação

```
1. Abrir http://localhost:3001
2. Verificar se página de login aparece
3. Login como admin/owner
4. Verificar se menu aparece
5. Verificar "Gerenciador de Dashboards" aparece no sidebar
6. Fazer logout
7. Login como usuário normal
8. Verificar que "Gerenciador de Dashboards" NÃO aparece
```

✅ **Esperado:** Sidebar muda baseado em role

---

### 2️⃣ Listar Dashboards (Admin/Owner)

```
1. Login como admin/owner
2. Ir em "Gerenciador de Dashboards"
3. Verificar se lista de dashboards aparece
4. Verificar colunas: ID, Nome, Descrição, Usuários, Widgets, Ações
```

✅ **Esperado:**

- Lista carrega sem erro 400
- Widget count aparece correto
- Sem dados mockados

---

### 3️⃣ Criar Dashboard

```
1. Clique em "Novo Dashboard"
2. Preencher:
   - Nome: "Dashboard Teste"
   - Descrição: "Dashboard para teste"
   - Selecionar 2-3 usuários
3. Clique em "Criar Dashboard"
4. Verificar se dashboard aparece na lista
```

✅ **Esperado:**

- Modal fecha
- Dashboard aparece no topo da lista
- Sem erros no console

---

### 4️⃣ Editar Dashboard

```
1. Clique no ícone Editar (lápis) de um dashboard
2. Alterar nome e descrição
3. Adicionar/remover usuários
4. Clique "Salvar Alterações"
5. Verificar se alterações aparecem na lista
```

✅ **Esperado:**

- Modal fecha
- Dashboard atualizado na lista
- Alterações persistem

---

### 5️⃣ Incluir Widget

```
1. Clique no ícone "Incluir Widget" (quadrado) de um dashboard
2. Modal abre com 5 passos
3. Passo 1 - Selecionar View:
   - Deve mostrar views do backend
   - Clique em uma view
4. Passo 1 - Selecionar Colunas:
   - Deve mostrar colunas da view
   - Selecione 2-3 colunas
5. Clique "Próximo" → Passo 2
```

✅ **Esperado:**

- Views carregam sem erro
- Colunas aparecem dinamicamente
- Sem erro 400

---

### 6️⃣ Configurar Filtros (Passo 2)

```
1. Clique "Adicionar Filtro"
2. Selecione coluna, operador (=), valor
3. Clique "Adicionar"
4. Filtro aparece na lista
5. Clique "Próximo"
```

✅ **Esperado:**

- Filtro é criado e exibido
- Pode remover filtro
- Sem validação de erro

---

### 7️⃣ Agregações (Passo 3)

```
1. Clique "Adicionar Agregação"
2. Selecione coluna numérica e função (SUM/COUNT/AVG)
3. Clique "Adicionar"
4. Agregação aparece na lista
5. Opcionalmente: adicionar ORDER BY
6. Clique "Próximo"
```

✅ **Esperado:**

- Agregação criada corretamente
- ORDER BY funciona
- Sem erros

---

### 8️⃣ Tipo de Visualização (Passo 4)

```
1. Selecione tipo: table, bar, pie ou line
2. Clique "Próximo"
```

✅ **Esperado:**

- Tipo selecionado é destacado
- Transição suave para próximo passo

---

### 9️⃣ Preview & Salvar (Passo 5)

```
1. Verificar preview com dados reais do API
2. Se erro no preview: voltar e ajustar
3. Se OK: clique "Salvar Widget"
4. Verificar se modal fecha
5. Voltar para Gerenciador
6. Verificar se widget_count aumentou
```

✅ **Esperado:**

- Preview carrega dados reais
- Widget salvo no Supabase
- Counter atualiza

---

### 🔟 Visualizar Widgets (Usuário)

```
1. Logout como admin
2. Login como usuário normal (que foi atribuído a um dashboard)
3. Ir em "Widgets"
4. Verificar se dashboards aparecem
5. Verificar se widgets aparecem com dados reais
6. Verificar se gráficos renderizam
```

✅ **Esperado:**

- Usuário vê apenas seus dashboards
- Widgets mostram dados reais
- Gráficos render corretamente (bar/pie/line)

---

### 1️⃣1️⃣ Deletar Dashboard

```
1. Login como admin
2. Ir em "Gerenciador de Dashboards"
3. Clique no ícone Trash de um dashboard
4. Confirme exclusão
5. Dashboard desaparece da lista
6. Widgets associados também são deletados
```

✅ **Esperado:**

- Dashboard e widgets deletados
- Lista atualiza
- Sem erros

---

## 🔍 Testes de Erro

### Erro 400 - NÃO DEVE MAIS APARECER ❌

```
Na console do navegador, não deve mais aparecer:
"invalid input syntax for type integer"
```

✅ **Esperado:** Erro resolvido com filtragem em JS

---

### Filtro com UUID Inválido ❌

```
Dashboard com usuarios = [1, 2, 3]
Usuário logado com id = "76b8906e-7504..." (UUID)
```

✅ **Esperado:**

- Dashboard NÃO aparece para o usuário
- Sem erro na API
- Comportamento correto (usuário não tem acesso)

---

## 📊 Testes de Dados

### Verificar Dados Reais (Não Mockados)

```javascript
// No console do navegador (F12)
1. Ir em Gerenciador de Dashboards
2. Abrir DevTools
3. No console, verificar que:
   - Não há hardcoded data
   - Dados vêm do Supabase
   - Estrutura é diferente de mock anterior
```

---

### Verificar Requests no Network Tab

```
1. Abrir DevTools → Network tab
2. Ir em Gerenciador de Dashboards
3. Verificar requests:
   - GET /rest/v1/dashboards
   - GET /rest/v1/widgets
   - POST /api/widgets/views
   - POST /api/widgets/query
```

✅ **Esperado:** Requests legítimas, sem erro 400

---

## 🎨 Testes de UI/UX

### Loading States

```
1. Abrir lista de dashboards
2. Verificar LoadingSpinner enquanto carrega
3. Após carregamento, dados aparecem
```

✅ **Esperado:** UX fluida com feedback visual

---

### Error Handling

```
1. Desconectar Supabase propositalmente
2. Tentar criar dashboard
3. Verificar se erro é exibido
4. Reconectar
5. Tentar novamente
```

✅ **Esperado:** Erros são mostrados ao usuário

---

## 🚀 Performance

### Tempo de Carregamento

```
1. Abrir Gerenciador de Dashboards
2. DevTools → Performance tab
3. Registrar tempo de carregamento
```

✅ **Esperado:** < 2 segundos

---

### Contagem de Requests

```
1. Network tab limpo
2. Carregar Gerenciador
3. Contar requests
```

✅ **Esperado:** ~3-5 requests (não 20+)

---

## ✅ Checklist Final

- [ ] Erro 400 resolvido
- [ ] Dashboards listam corretamente
- [ ] Criar/Editar/Deletar funcionam
- [ ] Widgets salvam com dados reais
- [ ] Preview carrega dados da API
- [ ] Usuários veem apenas seus dashboards
- [ ] Gráficos renderizam
- [ ] Sem dados mockados
- [ ] Loading states funcionam
- [ ] Error handling funciona
- [ ] Sidebar mostra apenas para admin/owner
- [ ] Logout/Login funciona
- [ ] Performance aceitável

---

## 📝 Notas

- Se erro persistir, verificar no console qual é a linha exata
- Verificar se `userId` está sendo enviado como INTEGER (não UUID)
- Verificar se Supabase `usuarios` é do tipo INTEGER[]
- Se Preview não funciona: verificar se REST API está rodando
- Se Widgets não salvam: verificar permissões no Supabase

---

## 🎉 Sucesso!

Se todos os testes passarem, o sistema está **100% funcional** e pronto para produção! 🚀
