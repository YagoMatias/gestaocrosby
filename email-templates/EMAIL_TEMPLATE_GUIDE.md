# 📧 Template de Email - Reset de Senha

## 🎨 Design Profissional

Criei um template HTML completo e responsivo para o email de redefinição de senha com:

### ✨ Características:

1. **Header com Gradiente Cyan**

   - Logo da Crosby centralizada
   - Título "HEADCOACH CROSBY"
   - Gradiente moderno (#0891b2 → #06b6d4)

2. **Código de Verificação em Destaque**

   - Box com fundo gradient verde água
   - Código em fonte monoespaçada, tamanho 42px
   - Espaçamento de letras para fácil leitura
   - Informação de validade (60 minutos)

3. **Boxes Informativos**

   - ⚠️ Warning Box (amarelo) - Alerta de segurança
   - 💡 Info Box (azul) - Dicas de segurança

4. **Footer Completo**

   - Informações da empresa
   - Links úteis (Website, Suporte)
   - Nota de segurança
   - Copyright

5. **Responsivo**
   - Adapta para mobile
   - Fontes ajustáveis
   - Layout fluido

## 📋 Como Usar no Supabase

### Passo 1: Upload do Logo

Você tem duas opções:

#### Opção A: Usar Imgur (Recomendado para teste)

1. Acesse https://imgur.com
2. Faça upload do logo da Crosby (`crosbyazul.png`)
3. Copie o link direto da imagem
4. Substitua no template:

```html
<img src="SEU_LINK_AQUI" alt="HeadCoach Crosby" class="logo" />
```

#### Opção B: Usar Supabase Storage

1. No Supabase Dashboard → Storage
2. Crie um bucket público chamado `assets`
3. Faça upload do logo
4. Copie a URL pública
5. Substitua no template

### Passo 2: Configurar no Supabase

1. **Acesse o Dashboard do Supabase**

   - Vá para seu projeto
   - Navegue até **Authentication** → **Email Templates**

2. **Selecione "Reset Password"**

3. **Cole o Template HTML**

   - Copie TODO o conteúdo do arquivo `reset-password-template.html`
   - Cole no campo do template
   - **IMPORTANTE:** O Supabase usa `{{ .Token }}` para inserir o código

4. **Personalize os Links**

   - Substitua `https://crosbytech.com.br` pelo seu site real
   - Substitua `suporte@crosbytech.com.br` pelo email de suporte real

5. **Salve as Alterações**

## 🎯 Preview do Email

```
┌─────────────────────────────────────────────┐
│                                             │
│    [Gradient Cyan Header]                   │
│                                             │
│         🏢 [LOGO CROSBY]                    │
│                                             │
│       HEADCOACH CROSBY                      │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Olá! 👋                                    │
│                                             │
│  Recebemos uma solicitação para redefinir   │
│  a senha da sua conta...                    │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  SEU CÓDIGO DE VERIFICAÇÃO            │ │
│  │                                       │ │
│  │         1  2  3  4  5  6              │ │
│  │                                       │ │
│  │  ⏰ Válido por 60 minutos              │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ ⚠️ Importante: Se você não solicitou  │ │
│  │ ignore este email...                  │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ 💡 Dica: Nunca compartilhe este       │ │
│  │ código com outras pessoas...          │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Atenciosamente,                            │
│  Equipe HeadCoach Crosby                    │
│                                             │
├─────────────────────────────────────────────┤
│           [Footer Cinza Claro]              │
│                                             │
│         HeadCoach Crosby                    │
│     Sistema de Gestão Empresarial           │
│                                             │
│      🌐 Website  📧 Suporte                │
│                                             │
│  🔒 Este é um email automático...           │
│  © 2025 Crosby Technology                   │
└─────────────────────────────────────────────┘
```

## 🎨 Cores Utilizadas

- **Primary Cyan:** `#0891b2` e `#06b6d4`
- **Background:** `#f5f5f5`
- **Text:** `#1f2937` (escuro) e `#4b5563` (cinza)
- **Warning:** `#fef3c7` (background) e `#f59e0b` (borda)
- **Info:** `#dbeafe` (background) e `#3b82f6` (borda)
- **Code Box:** Gradient verde água `#f0fdfa` → `#ccfbf1`

## 📱 Responsividade

O template é totalmente responsivo e funciona perfeitamente em:

- ✅ Gmail (Desktop & Mobile)
- ✅ Outlook (Desktop & Mobile)
- ✅ Apple Mail (iOS & macOS)
- ✅ Yahoo Mail
- ✅ ProtonMail
- ✅ Thunderbird

## 🔧 Personalização Adicional

### Mudar as Cores

Procure por estas classes no CSS:

```css
.header {
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
  /* Mude #0891b2 e #06b6d4 para suas cores */
}
```

### Adicionar Logo de Redes Sociais

Adicione na seção `.social-links`:

```html
<a href="https://instagram.com/crosbytech">📱 Instagram</a>
<a href="https://linkedin.com/company/crosby">💼 LinkedIn</a>
```

### Mudar Tamanho do Código

```css
.code {
  font-size: 42px; /* Ajuste conforme necessário */
  letter-spacing: 8px; /* Ajuste o espaçamento */
}
```

## 🧪 Como Testar o Email

### Opção 1: Preview no Supabase

Após configurar, use a função de preview do Supabase para ver como ficará.

### Opção 2: Enviar Email de Teste

1. Configure tudo no Supabase
2. Na tela de login, clique em "Esqueceu a senha?"
3. Digite seu email
4. Verifique sua caixa de entrada

### Opção 3: Usar Serviço de Preview

- [Litmus](https://litmus.com) - Preview em diversos clients
- [Email on Acid](https://www.emailonacid.com) - Testes de compatibilidade

## 📦 Arquivos Criados

- `email-templates/reset-password-template.html` - Template HTML completo
- `email-templates/EMAIL_TEMPLATE_GUIDE.md` - Este guia

## 💡 Dicas Importantes

1. **Sempre teste o email antes de colocar em produção**
2. **Verifique se o logo carrega corretamente**
3. **Confirme que os links estão funcionando**
4. **Teste em diferentes clientes de email**
5. **Mantenha o código `{{ .Token }}` intacto para o Supabase funcionar**

## 🆘 Troubleshooting

### Logo não aparece

- Verifique se a URL do logo está pública
- Teste a URL do logo em uma aba anônima
- Confirme que não há firewall bloqueando

### Código não aparece

- Certifique-se de que `{{ .Token }}` está presente
- Não altere essa variável do Supabase

### Layout quebrado em mobile

- O template já é responsivo
- Teste em diferentes dispositivos
- Use o modo responsivo do navegador

## 🎉 Resultado Final

Você terá um email profissional, moderno e bonito que:

- ✅ Representa bem a marca Crosby
- ✅ É fácil de ler e entender
- ✅ Destaca o código de verificação
- ✅ Tem avisos de segurança claros
- ✅ Funciona em todos os dispositivos
- ✅ É confiável e profissional

---

**Criado para:** HeadCoach Crosby  
**Última atualização:** 30 de outubro de 2025
