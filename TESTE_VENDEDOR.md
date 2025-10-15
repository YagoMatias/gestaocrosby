# 🧪 Guia Rápido: Criar Usuário Vendedor

## ✅ Método Recomendado: Painel Admin

### Passo a Passo Completo:

1. **Acesse o Painel Admin**

   ```
   http://localhost:5173/painel-admin
   ```

   (ou URL de produção se já estiver em deploy)

2. **Faça Login como Owner**

   - Use suas credenciais de proprietário

3. **Clique em "+ Novo Usuário"**

   - Botão localizado no canto superior direito da tela

4. **Preencha o Formulário:**

   - **Nome**: `Vendedor Teste` (ou nome real)
   - **Email**: `vendedor@crosby.com.br`
   - **Senha**: `Crosby@2024` (ou senha de sua escolha)
   - **Perfil**: Selecione **"Vendedor"** no dropdown
   - **Status**: Marque a checkbox **"Ativo"** ✓

5. **Clique em "Salvar"**

   - O usuário será criado imediatamente

6. **Faça Logout**

   - Clique no menu de usuário e faça logout

7. **Teste o Login do Vendedor**
   - Email: `vendedor@crosby.com.br`
   - Senha: `Crosby@2024`

---

## ✅ O Que Você Deve Ver Após Login:

### Sidebar (Menu Lateral):

✅ **Home**  
✅ **Crosby Bot** ← **APENAS ESSA OPÇÃO**

❌ **NÃO** deve aparecer:

- BI Externo
- Dashboard Faturamento
- Financeiro
- CMV
- Varejo, Multimarcas, Revenda, Franquias
- Clientes
- Vigia
- Ranking
- Painel Admin

### Badge do Usuário (Rodapé da Sidebar):

Deve mostrar: **"Vendedor"** em cor verde esmeralda

---

## 🎯 Testar Funcionalidades do Crosby Bot:

1. Clique em **"Crosby Bot"** no menu
2. Teste criar um fluxo:

   - Clique em **"Texto"** para adicionar mensagem
   - Digite uma mensagem de teste
   - Veja o preview aparecer

3. Teste importar contatos:

   - Clique em **"Importar Excel/CSV"**
   - Selecione um arquivo CSV com formato:
     ```csv
     telefone,nome
     11999887766,João Silva
     11988776655,Maria Santos
     ```

4. Teste visualizar preview:
   - Clique em **"Visualizar Preview"**
   - Veja como as mensagens aparecerão no WhatsApp

---

## 🚨 Troubleshooting

### Problema: "Vendedor" não aparece no dropdown

**Solução:**

- Execute o SQL no Supabase:
  ```sql
  INSERT INTO user_profiles (name, label, color, description, level)
  VALUES ('vendedor', 'Vendedor', '#10b981', 'Acesso apenas ao Crosby Bot', 60);
  ```

### Problema: Vendedor vê outros menus além de Home e Crosby Bot

**Solução:**

- Verifique se o role está correto:
  ```sql
  SELECT email, raw_user_meta_data->>'role' as role
  FROM auth.users
  WHERE email = 'vendedor@crosby.com.br';
  ```
- Deve retornar: `vendedor`

### Problema: Erro ao tentar enviar fluxo

**Solução:**

- Verifique o console do navegador (F12)
- Veja a seção de "Erro permission denied" no arquivo `CONFIGURAR_VENDEDOR.md`

---

## 📊 Exemplo de Arquivo CSV para Teste:

Crie um arquivo chamado `contatos_teste.csv`:

```csv
telefone,nome
11999887766,João Silva
11988776655,Maria Santos
11977665544,Pedro Costa
11966554433,Ana Oliveira
```

Salve e importe no Crosby Bot para testar.

---

## ✨ Sucesso!

Se tudo estiver funcionando:

- ✅ Login como vendedor funcionou
- ✅ Apenas Home e Crosby Bot aparecem
- ✅ Crosby Bot carrega normalmente
- ✅ É possível criar fluxos e importar contatos

**Parabéns! O perfil Vendedor está configurado corretamente! 🎉**
