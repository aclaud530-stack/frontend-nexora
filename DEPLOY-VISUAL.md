# 🎨 Guia Visual - Deploy Passo a Passo

## 📍 Você está aqui

```
v0 Application (Your Browser)
         ↓
   [Downloaded ZIP]
    (este arquivo)
```

---

## PASSO 1️⃣: Download do Projeto

### O que você tem agora:
- ✅ Aplicação Next.js completa
- ✅ Componentes React prontos
- ✅ Integração com Backend Railway
- ✅ Configuração de segurança
- ✅ Documentação completa

### Próximo passo:
```
⬇️ Descompactar ZIP
⬇️ Abrir terminal na pasta
```

---

## PASSO 2️⃣: Criar Repositório GitHub

### No seu computador:

```bash
# Navegar até a pasta
cd nexora-trading

# Inicializar git
git init

# Adicionar todos os arquivos
git add .

# Primeira commit
git commit -m "Initial commit: Nexora Trading Platform"
```

### No GitHub (https://github.com/new):

```
Repository name: nexora-trading
Description: Nexora - Automated Trading Platform
Public: Yes (recomendado)
Add .gitignore: ✓ (já incluído)

Criar repositório
```

### De volta no terminal:

```bash
git remote add origin https://github.com/SEU-USUARIO/nexora-trading.git
git branch -M main
git push -u origin main
```

### Resultado Visual:

```
┌─────────────────────────────────────┐
│  GitHub                             │
│  ✅ nexora-trading (seu repositório)│
│     └─ código enviado               │
└─────────────────────────────────────┘
```

---

## PASSO 3️⃣: Publicar no Vercel

### Na web (https://vercel.com/new):

```
1️⃣ Clique: "Import Git Repository"
          ↓
2️⃣ Procure por "nexora-trading"
          ↓
3️⃣ Clique: "Import"
          ↓
4️⃣ Vercel começa a fazer build
          ↓
⏳ Aguarde 2-3 minutos
          ↓
✅ Deploy completo!
          ↓
   Você recebe uma URL
   (exemplo: https://nexora-trading-abc123.vercel.app)
```

### Resultado Visual:

```
┌────────────────────────────────────────┐
│  Vercel Dashboard                      │
│  ✅ nexora-trading (seu projeto)       │
│     ├─ Domains: vercel.app URL         │
│     ├─ Deployments: (em progresso)     │
│     └─ Environment Variables: (vazio)  │
└────────────────────────────────────────┘
```

---

## PASSO 4️⃣: Adicionar Variáveis de Ambiente

### No Vercel Dashboard:

```
Seu Projeto
    ↓
Settings
    ↓
Environment Variables
    ↓
[ADICIONAR VARIÁVEIS]
```

### Variável 1:
```
Name:  NEXT_PUBLIC_API_URL
Value: https://banckend-production-14a1.up.railway.app
Scopes: ✓ Production ✓ Preview ✓ Development
Salvar
```

### Variável 2:
```
Name:  NEXT_PUBLIC_DERIV_APP_ID
Value: 3356rGdzrsnQaEKsg8MMA
Scopes: ✓ Production ✓ Preview ✓ Development
Salvar
```

### Variável 3:
```
Name:  NEXT_PUBLIC_DERIV_CALLBACK_URL
Value: https://SEU-DOMINIO.vercel.app/callback
(substitua SEU-DOMINIO pelo seu)
Scopes: ✓ Production ✓ Preview ✓ Development
Salvar
```

### Variável 4:
```
Name:  NEXT_PUBLIC_WS_URL
Value: wss://banckend-production-14a1.up.railway.app
Scopes: ✓ Production ✓ Preview ✓ Development
Salvar
```

### Depois:

```
Deployments → [seu deployment recente]
    ↓
Clique "Redeploy"
    ↓
⏳ Aguarde rebuild (2-3 min)
    ↓
✅ Pronto!
```

---

## PASSO 5️⃣: Configurar Callback Deriv

### No site Deriv (https://app.deriv.com):

```
Account Menu (canto superior)
    ↓
Settings / Security / Preferences
    ↓
Procure por: "API" ou "Apps"
    ↓
Sua Application (3356rGdzrsnQaEKsg8MMA)
    ↓
EDITAR → Redirect URIs
```

### Adicione:
```
https://SEU-DOMINIO.vercel.app/callback
```

### E também:
```
https://SEU-DOMINIO.vercel.app/menu
```

### Clique Salvar

---

## PASSO 6️⃣: Testar Tudo

### Teste 1: Homepage
```
1️⃣ Vá para: https://SEU-DOMINIO.vercel.app
   ↓
2️⃣ Você vê: Logo Nexora + Botão "Login com Deriv"
   ↓
✅ Homepage funcionando!
```

### Teste 2: Login OAuth
```
1️⃣ Clique: "Login com Deriv"
   ↓
2️⃣ Você é redirecionado para: https://auth.deriv.com/...
   ↓
3️⃣ Vê tela de login Deriv
   ↓
4️⃣ Faça login (ou autorize se já está logado)
   ↓
5️⃣ Redirecionado de volta para seu app
   ↓
✅ OAuth funcionando!
```

### Teste 3: Dashboard
```
1️⃣ Após login, deve carregar dashboard
   ↓
2️⃣ Você vê:
   - Saldo da conta
   - Gráficos
   - Tabela de trades
   ↓
✅ Dashboard funcionando!
```

### Teste 4: Verificar Erros
```
1️⃣ Abra DevTools: F12
   ↓
2️⃣ Vá para "Console"
   ↓
3️⃣ Procure por erros em VERMELHO
   ↓
❌ Se houver: Revise as variáveis de ambiente
✅ Se não houver: Tudo certo!
```

---

## 🎯 Fluxo Completo Visual

```
┌─────────────────────────────────────────────┐
│  1️⃣ Seu Computador                          │
│     ├─ Código no GitHub                    │
│     ├─ Repo: nexora-trading                │
│     └─ Status: ✅ Enviado                  │
└────────────┬────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────┐
│  2️⃣ Vercel (Seu App em Produção)           │
│     ├─ URL: seu-dominio.vercel.app          │
│     ├─ Auto-deploy do GitHub                │
│     ├─ Build: ✅ Sucesso                    │
│     └─ Variáveis: ✅ Configuradas           │
└────────────┬────────────────────────────────┘
             │
      ┌──────┴──────┐
      ↓             ↓
    HTTPS         WSS
      │             │
      ↓             ↓
┌─────────────────────────────────────────────┐
│  3️⃣ Seu Backend (Railway)                   │
│     ├─ URL: banckend-production-14a1...app  │
│     ├─ APIs: ✅ Respondendo                 │
│     ├─ WebSocket: ✅ Conectando             │
│     └─ Database: ✅ Conectado               │
└────────────┬────────────────────────────────┘
             │
      ┌──────┴──────┐
      ↓             ↓
   OAuth         Database
   (Deriv)      (PostgreSQL)
```

---

## 📱 Dispositivos Suportados

Sua aplicação funciona em:

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   📱 Smartphone  │    │   💻 Computador  │    │   📱 Tablet      │
│                  │    │                  │    │                  │
│ iPhone / Android │    │ Windows / Mac    │    │ iPad / Android   │
│  ✅ Responsivo   │    │  ✅ Full Design  │    │ ✅ Otimizado     │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## ⚠️ Se Algo Não Funcionar

### Erro: "Página em branco"
```
Solução:
1️⃣ Vercel Dashboard → Deployments → Logs
2️⃣ Procure por erros em vermelho
3️⃣ Revise as variáveis de ambiente
```

### Erro: "CORS error"
```
Solução:
1️⃣ F12 → Console → procure por "CORS"
2️⃣ Verifique se NEXT_PUBLIC_API_URL está correto
3️⃣ Certifique-se que backend permite seu domínio
```

### Erro: "OAuth failed"
```
Solução:
1️⃣ Verifique se callback URL está correta em Deriv
2️⃣ Confirme se NEXT_PUBLIC_DERIV_CALLBACK_URL é exato
3️⃣ Teste callback URL manualmente no navegador
```

---

## ✅ Checklist Final

```
Preparação:
[ ] Código baixado e descompactado
[ ] Repositório criado no GitHub

Deploy:
[ ] Projeto importado no Vercel
[ ] Build passou sem erros
[ ] 4 variáveis adicionadas
[ ] Redeploy realizado

Configuração:
[ ] Callback URL adicionado em Deriv
[ ] Domínio Vercel obtido

Testes:
[ ] Homepage carrega
[ ] Login funciona
[ ] Dashboard aparece
[ ] Sem erros no console
[ ] WebSocket conecta

Pronto para Produção:
✅ TUDO FUNCIONANDO!
```

---

## 🎉 Você está PRONTO!

```
╔═════════════════════════════════════════╗
║                                         ║
║  🚀 SUA APLICAÇÃO ESTÁ EM PRODUÇÃO!    ║
║                                         ║
║  URL: https://seu-dominio.vercel.app   ║
║                                         ║
║  Backend: Railway ✅                    ║
║  Frontend: Vercel ✅                    ║
║  OAuth: Deriv ✅                        ║
║                                         ║
║  Acesse e comece a usar! 🎯             ║
║                                         ║
╚═════════════════════════════════════════╝
```

---

## 📚 Documentação de Referência

Leia esses arquivos para mais detalhes:

```
📄 QUICK-START-DEPLOY.md   (5 min) ⭐ COMECE AQUI
📄 DEPLOYMENT.md           (detalhado)
📄 CHECKLIST-DEPLOY.md     (verifications)
📄 TESTING.md              (testes)
📄 README.md               (overview)
```

---

## 💬 Dúvidas Frequentes

**P: Quanto tempo leva para fazer deploy?**
R: 10-15 minutos total (5 min GitHub + 2-3 min Vercel + 5 min Deriv)

**P: Preciso de cartão de crédito?**
R: Não para Vercel (free tier). GitHub é gratuito. Deriv pode cobrar.

**P: Posso usar domínio customizado?**
R: Sim! Adicione em Vercel → Domains (após ter a URL funcionando)

**P: Como monitoro problemas em produção?**
R: Vercel Dashboard → Logs + Console do navegador (F12)

---

**Pronto? Comece agora! 🚀**
