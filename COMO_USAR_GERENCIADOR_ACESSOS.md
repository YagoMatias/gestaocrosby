# 🎯 Como Usar o Gerenciador de Acessos

## 📋 Visão Geral

O **Gerenciador de Acessos** é uma interface completa para controlar quais páginas cada usuário pode acessar no sistema. Com ele, você pode:

- ✅ Gerenciar permissões individualmente ou em massa
- ✅ Copiar permissões entre usuários
- ✅ Buscar e filtrar usuários
- ✅ Visualizar quantas páginas cada usuário tem acesso
- ✅ Organizar páginas por categoria

---

## 🚀 Como Acessar

1. Faça login como **owner** (apenas owners podem acessar)
2. Abra o **Sidebar**
3. Vá em **Administração** > **Gerenciador de Acessos**
4. Ou acesse diretamente: `/gerenciador-acessos`

---

## 🎨 Interface

A tela é dividida em 3 áreas principais:

### **1. Painel de Controles (Topo)**

- **Modo de Seleção**: Individual ou Em Massa
- **Copiar Permissões**: Selecione um usuário para copiar suas permissões
- **Botões de Ação**: Copiar, Salvar, Limpar

### **2. Painel de Usuários (Esquerda)**

- Lista com todos os 55 usuários do sistema
- Busca por nome, email ou role
- Indicador de quantas páginas cada um tem acesso
- Tags coloridas por role (owner, admin, manager, user, guest, vendedor)

### **3. Painel de Páginas (Direita)**

- Lista de todas as páginas do sistema
- Organizadas por categoria
- Checkboxes para marcar/desmarcar
- Contador de páginas selecionadas

---

## 🔧 Modos de Operação

### **🔹 Modo Individual**

Use para gerenciar permissões de **UM usuário por vez**.

**Como usar:**

1. Clique no botão **"Individual"** (topo)
2. Selecione um usuário na lista
3. Marque/desmarque as páginas que ele pode acessar
4. Clique em **"Salvar Permissões"**

**Exemplo:**

```
1. Selecionar: teste@timecrosby.com
2. Marcar: Home, Crosby Bot, Dashboard Faturamento
3. Salvar
✅ Resultado: Usuário agora só acessa essas 3 páginas
```

---

### **🔹 Modo Em Massa**

Use para gerenciar permissões de **VÁRIOS usuários ao mesmo tempo**.

**Como usar:**

1. Clique no botão **"Em Massa"** (topo)
2. Selecione múltiplos usuários (checkboxes aparecem)
3. Marque as páginas que TODOS os selecionados devem ter acesso
4. Clique em **"Salvar Permissões"**

**Exemplo:**

```
1. Selecionar: vendedor1@, vendedor2@, vendedor3@
2. Marcar: Home, Crosby Bot
3. Salvar
✅ Resultado: Os 3 vendedores agora têm acesso às mesmas 2 páginas
```

---

## 🎯 Funcionalidades Avançadas

### **📋 Copiar Permissões**

Copie as permissões de um usuário para outro(s).

**Como usar:**

1. No dropdown **"Copiar Permissões De"**, selecione o usuário de origem
2. Selecione o(s) usuário(s) de destino
3. Clique em **"Copiar"**

**Exemplo:**

```
Copiar de: fabioferreiraazevedo@gmail.com (admin, 40 páginas)
Para: teste@timecrosby.com
✅ Resultado: teste@ agora tem as mesmas 40 páginas que fabio@
```

---

### **🗑️ Limpar Todas as Permissões**

Remove TODAS as permissões de um ou mais usuários.

**Como usar:**

1. Selecione o(s) usuário(s)
2. Clique em **"Limpar Tudo"** (botão vermelho)
3. Confirme a ação

**⚠️ ATENÇÃO:** Esta ação é irreversível! O usuário ficará SEM ACESSO a nenhuma página.

---

### **📁 Selecionar Categoria Inteira**

Marque/desmarque todas as páginas de uma categoria de uma vez.

**Como usar:**

- Clique no checkbox ao lado do nome da categoria

**Exemplo:**

```
Clicar no checkbox de "Financeiro"
✅ Marca: Contas a Pagar, Contas a Receber, Fluxo de Caixa, etc (todas da categoria)
```

---

### **🔍 Buscar Usuários**

Filtre usuários por nome, email ou role.

**Exemplos:**

- `@gmail.com` → Mostra todos os usuários com email Gmail
- `vendedor` → Mostra todos os vendedores
- `yago` → Mostra usuários com "yago" no nome ou email

---

## 📊 Categorias de Páginas

O sistema organiza as páginas em categorias:

| Categoria         | Descrição                   | Exemplos                            |
| ----------------- | --------------------------- | ----------------------------------- |
| **Principal**     | Páginas principais          | Home, Crosby Bot, BI Externo        |
| **Financeiro**    | Gestão financeira           | Contas a Pagar, Fluxo de Caixa, DRE |
| **CMV**           | Custo de Mercadoria Vendida | CMV Consolidado, CMV Varejo         |
| **Varejo**        | Operações de varejo         | Dashboard Varejo, Metas             |
| **Multimarcas**   | Canal multimarcas           | Dashboard, CREDEV, Inadimplentes    |
| **Revenda**       | Canal revenda               | Dashboard, CREDEV, Inadimplentes    |
| **Franquias**     | Canal franquias             | Dashboard, Compras, CREDEV          |
| **Outros**        | Ferramentas gerais          | Clientes, Widgets, Ranking          |
| **Administração** | Ferramentas admin           | Painel Admin, Gerenciadores         |

---

## 💡 Casos de Uso Comuns

### **Caso 1: Novo Vendedor**

```
Objetivo: Criar acesso para novo vendedor
Ação:
1. Modo Individual
2. Selecionar: novovendedor@timecrosby.com
3. Marcar: Home, Crosby Bot
4. Salvar

Resultado: Vendedor acessa apenas Home e Crosby Bot
```

---

### **Caso 2: Equipe Financeira**

```
Objetivo: Dar acesso ao financeiro para 5 pessoas
Ação:
1. Modo Em Massa
2. Selecionar: user1@, user2@, user3@, user4@, user5@
3. Expandir categoria "Financeiro"
4. Clicar no checkbox da categoria (marca tudo)
5. Salvar

Resultado: 5 usuários têm acesso a todas as páginas financeiras
```

---

### **Caso 3: Replicar Perfil**

```
Objetivo: Novo gerente com mesmo acesso que outro gerente
Ação:
1. Copiar Permissões De: marciocrosby@timecrosby.com
2. Selecionar: novogerente@timecrosby.com
3. Clicar em "Copiar"

Resultado: Novo gerente tem exatamente o mesmo acesso
```

---

### **Caso 4: Remover Acesso Temporário**

```
Objetivo: Tirar acessos de usuário que saiu
Ação:
1. Modo Individual
2. Selecionar: usuariosai@timecrosby.com
3. Clicar em "Limpar Tudo"
4. Confirmar

Resultado: Usuário sem acesso a nenhuma página
```

---

## ⚠️ Regras Importantes

### **1. Owners Sempre Têm Acesso Total**

- Owners não podem ter permissões removidas
- Owners veem todas as páginas automaticamente
- Esta é uma regra hardcoded no sistema

### **2. Sistema Não Usa Mais Roles**

- O sistema antigo baseava-se em roles (owner, admin, manager, etc)
- **AGORA**: Cada usuário tem permissões individuais
- Role serve apenas para identificação visual

### **3. Usuário Precisa Recarregar**

- Após alterar permissões, o usuário precisa:
  - Fazer logout e login novamente
  - OU recarregar a página (F5)
- As permissões são carregadas no login

### **4. Páginas de Admin**

- Painel Admin e Gerenciador de Dashboards só aparecem para owners
- Mesmo que você marque essas páginas para outros usuários, eles não conseguirão acessar

---

## 🎨 Indicadores Visuais

### **Cores dos Roles**

- 🟣 **Owner** (Roxo) - Proprietário
- 🔴 **Admin** (Vermelho) - Administrador
- 🟠 **Manager** (Laranja) - Gerente
- 🟢 **User** (Verde) - Financeiro
- 🟢 **Vendedor** (Verde Escuro) - Vendedor
- ⚫ **Guest** (Cinza) - Convidado

### **Estados de Seleção**

- ✅ **Checkbox marcado** - Usuário/página selecionado
- ☑️ **Checkbox indeterminado** - Algumas páginas da categoria marcadas
- ⬜ **Checkbox vazio** - Não selecionado

### **Destaque de Usuário**

- 🔵 **Fundo azul** - Usuário selecionado
- ⚪ **Fundo branco** - Não selecionado
- **Borda azul** - Usuário selecionado no modo individual

---

## 🐛 Solução de Problemas

### **Não consigo acessar o Gerenciador**

- ✅ Verifique se você é **owner**
- ✅ Apenas owners podem acessar esta página

### **Permissões não aparecem após salvar**

- ✅ Recarregue a página com F5
- ✅ O usuário alterado precisa fazer logout/login

### **Erro ao salvar permissões**

- ✅ Verifique se você selecionou usuários
- ✅ Verifique a conexão com internet
- ✅ Verifique se as migrations foram executadas

### **Usuário não consegue acessar página**

- ✅ Verifique se a página está marcada no gerenciador
- ✅ Peça para o usuário fazer logout/login
- ✅ Verifique se não é página exclusiva de owner

---

## 📝 Checklist Rápido

**Antes de começar:**

- [ ] Executou as migrations no Supabase?
- [ ] Está logado como owner?
- [ ] Sistema está funcionando corretamente?

**Ao gerenciar acessos:**

- [ ] Selecionou o modo correto (Individual/Massa)?
- [ ] Selecionou os usuários?
- [ ] Marcou as páginas desejadas?
- [ ] Clicou em Salvar?
- [ ] Viu mensagem de sucesso?

**Após salvar:**

- [ ] Pediu para usuário fazer logout/login?
- [ ] Testou o acesso?
- [ ] Verificou se está funcionando?

---

## 🎉 Pronto!

Agora você está pronto para gerenciar os acessos de todos os 55 usuários do sistema de forma fácil e eficiente!

Se tiver dúvidas, consulte este guia ou entre em contato com o suporte técnico.
