# ⚡ Quick Start Deploy - 5 Minutos para Produção

## Seu Backend
✅ **Já está rodando em**: `https://banckend-production-14a1.up.railway.app`

## Passo 1️⃣: Preparar Repositório Git (2 min)

```bash
# Se ainda não tem repositório
git init
git add .
git commit -m "Initial commit: Nexora Trading Platform"

# Criar repositório no GitHub (recomendado)
# https://github.com/new
# Depois fazer push
git remote add origin https://github.com/seu-usuario/seu-repo.git
git branch -M main
git push -u origin main
```

**Resultado esperado**: Seu código está no GitHub

---

## Passo 2️⃣: Deploy no Vercel (2 min)

### Opção A: Via Website (Mais Fácil)
1. Vá para: https://vercel.com/new
2. Clique "Import Git Repository"
3. Selecione seu repositório
4. Clique "Import"
5. **AGUARDE O DEPLOY** ⏳

### Opção B: Via CLI
```bash
npm install -g vercel  # Se não tiver
vercel
# Siga as instruções
```

**Resultado esperado**: URL será gerada. Exemplo: `https://nexora-trading.vercel.app`

---

## Passo 3️⃣: Configurar Variáveis de Ambiente (1 min)

No Vercel Dashboard do seu projeto:
1. Vá para **Settings** → **Environment Variables**
2. Adicione estas 4 variáveis:

```
Nome: NEXT_PUBLIC_API_URL
Valor: https://banckend-production-14a1.up.railway.app

Nome: NEXT_PUBLIC_DERIV_APP_ID
Valor: 3356rGdzrsnQaEKsg8MMA

Nome: NEXT_PUBLIC_DERIV_CALLBACK_URL
Valor: https://SEU-DOMINIO.vercel.app/callback
(substitua SEU-DOMINIO pelo seu)

Nome: NEXT_PUBLIC_WS_URL
Valor: wss://banckend-production-14a1.up.railway.app
```

3. Clique "Save"
4. Vá para **Deployments** → seu deploy recente
5. Clique **"Redeploy"** para aplicar variáveis

**Resultado esperado**: Variáveis estão salvadas e deploy rodando

---

## Passo 4️⃣: Configurar Callback no Deriv (1 min)

1. Vá para: https://app.deriv.com
2. Procure por **Account Settings** ou **API Token**
3. Vá para **My Apps** → sua aplicação (ou crie uma)
4. Em **Redirect URIs**, adicione:
   ```
   https://SEU-DOMINIO.vercel.app/callback
   https://SEU-DOMINIO.vercel.app/menu
   ```
5. Salve

**Resultado esperado**: Deriv aceita seu domínio

---

## Passo 5️⃣: Testar (1 min) ✅

1. Acesse sua URL Vercel: `https://seu-dominio.vercel.app`
2. Clique "Login com Deriv"
3. Você deve ser redirecionado para Deriv
4. Faça login/autorize
5. Volta para seu app e carrega dashboard

**Se tudo funcionou**: 🎉 **PRONTO PARA PRODUÇÃO!**

---

## 🆘 Não funcionou?

### "Página em branco ou erro 500"
- Verifique os logs: Vercel → Deployments → seu deploy → Logs
- Procure por erros na build

### "CORS error ou requisições falhando"
- Confirme que variáveis de ambiente foram adicionadas
- Clique "Redeploy" após adicionar variáveis
- Aguarde 1-2 minutos para propagar

### "Login não funciona"
- Verifique callback URL no Deriv
- Confirme que `NEXT_PUBLIC_DERIV_CALLBACK_URL` é exato
- Certifique-se que APP ID está correto

### "WebSocket não conecta"
- Abra DevTools (F12) → Console
- Procure por erros relacionados a WebSocket
- Verifique se backend está rodando

---

## 📋 Checklist Rápido

- [ ] Código no GitHub
- [ ] Deployment criado no Vercel
- [ ] 4 variáveis de ambiente configuradas
- [ ] Redeploy realizado
- [ ] Callback configurado no Deriv
- [ ] Testou login com sucesso
- [ ] Dashboard carrega após login
- [ ] WebSocket conecta

**Tudo marcado?** Você está em produção! 🚀

---

## 📚 Documentação Completa

Para instruções detalhadas, veja:
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy detalhado
- **[CHECKLIST-DEPLOY.md](./CHECKLIST-DEPLOY.md)** - Checklist completo
- **[TESTING.md](./TESTING.md)** - Guia de testes
- **[README.md](./README.md)** - Overview geral

---

## 🎯 Próximos Passos (Opcional)

Depois de em produção:

1. **Domínio Customizado** (opcional)
   - Compre domínio em GoDaddy, Namecheap, etc
   - Configure DNS
   - Adicione em Vercel → Domains

2. **Monitoramento** (recomendado)
   - Configure Sentry para error tracking
   - Use Vercel Analytics para performance

3. **Backups** (importante)
   - Configure backups automáticos do banco
   - Monitore logs regularmente

---

**Pronto? Comece em Vercel agora! 🚀**
