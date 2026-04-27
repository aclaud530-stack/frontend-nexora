# ✅ Checklist de Deploy - Nexora Trading Platform

## Antes do Deploy

### Backend (Railway)
- [ ] Backend está rodando em: `https://banckend-production-14a1.up.railway.app`
- [ ] Todos os endpoints `/api/*` estão funcionando
- [ ] CORS está configurado para aceitar seu domínio Vercel
- [ ] Banco de dados está conectado e migrado
- [ ] Variáveis de ambiente do backend estão corretas

### Frontend (Aplicação Local)
- [ ] `npm install` ou `pnpm install` - todas as dependências instaladas
- [ ] `npm run dev` - aplicação roda sem erros localmente
- [ ] Testes básicos:
  - [ ] Página inicial carrega
  - [ ] Botão "Login com Deriv" aparece
  - [ ] Callback funciona localmente (se possível testar)
  - [ ] Dashboard carrega após login
  - [ ] Gráficos aparecem
  - [ ] Tabela de trades carrega

### Repositório Git
- [ ] Repositório criado no GitHub/GitLab/Bitbucket
- [ ] Todos os arquivos foram commitados
- [ ] `.env` está no `.gitignore` (não commitou credenciais)
- [ ] `.env.example` foi criado com variáveis de exemplo
- [ ] Branch principal é `main` ou `master`

### Credenciais Deriv
- [ ] App ID está correto: `3356rGdzrsnQaEKsg8MMA`
- [ ] Você tem acesso ao Deriv Developer Console
- [ ] Callback URL será configurada após deploy (veja próximo passo)

## Processo de Deploy

### 1️⃣ Conectar ao Vercel
- [ ] Acesse https://vercel.com/new
- [ ] Clique "Import Git Repository"
- [ ] Selecione seu repositório
- [ ] Projeto será criado automaticamente

### 2️⃣ Configurar Variáveis de Ambiente no Vercel
No Vercel Dashboard → Seu Projeto → Settings → Environment Variables

Adicione estas variáveis (substitua os valores):
```
NEXT_PUBLIC_API_URL
Valor: https://banckend-production-14a1.up.railway.app
Escopo: Production, Preview, Development

NEXT_PUBLIC_DERIV_APP_ID
Valor: 3356rGdzrsnQaEKsg8MMA
Escopo: Production, Preview, Development

NEXT_PUBLIC_DERIV_CALLBACK_URL
Valor: https://[seu-dominio-vercel].vercel.app/callback
Escopo: Production, Preview, Development

NEXT_PUBLIC_WS_URL
Valor: wss://banckend-production-14a1.up.railway.app
Escopo: Production, Preview, Development
```

- [ ] Salve as variáveis
- [ ] Clique "Redeploy" para aplicar

### 3️⃣ Obter URL do Vercel
Após deploy bem-sucedido:
- [ ] URL será: `https://[project-name].vercel.app`
- [ ] Copie esta URL (vamos precisar dela)

### 4️⃣ Configurar Callback no Deriv

1. [ ] Vá para: https://app.deriv.com
2. [ ] Acesse: Account Settings → API Token (ou Developer Console)
3. [ ] Vá para sua App (ou crie uma se não tiver)
4. [ ] Em "Redirect URIs", adicione:
   - `https://[seu-dominio].vercel.app/callback`
   - `https://[seu-dominio].vercel.app/menu`
5. [ ] Salve

### 5️⃣ Testar Deploy
- [ ] Acesse sua URL Vercel
- [ ] Página carrega sem erros
- [ ] Console não mostra erros (F12 → Console)
- [ ] Clique em "Login com Deriv"
- [ ] Você é redirecionado para Deriv
- [ ] Após autorizar, volta para `/callback`
- [ ] Dashboard carrega com dados
- [ ] Gráficos aparecem
- [ ] Conexão WebSocket está funcionando

## Após Deploy

### Monitoramento
- [ ] Configure alertas no Vercel para erros
- [ ] Monitore a aba "Logs" da plataforma
- [ ] Configure error tracking (Sentry, Datadog, etc - opcional)

### Produção
- [ ] Teste fluxo completo: Login → Dashboard → Start Bot
- [ ] Verifique performance (Vercel Analytics)
- [ ] Configure domínio customizado (opcional):
  - [ ] Compre domínio ou aponte existente
  - [ ] Configure DNS
  - [ ] Ative SSL em Vercel

### Manutenção
- [ ] Configure auto-deploy para cada push em `main`
- [ ] Mantenha dependências atualizadas
- [ ] Monitore logs regularmente
- [ ] Faça backups do banco (se aplicável)

## 🆘 Se algo der errado

### Erro durante Deploy
1. Verifique os logs no Vercel (Deployments → seu deploy → Logs)
2. Procure por erros de build
3. Confirme que todas as variáveis de ambiente foram adicionadas
4. Redeploy manualmente

### Aplicação carrega mas não funciona
1. Abra o Console (F12)
2. Procure por erros em vermelho
3. Verifique se `NEXT_PUBLIC_API_URL` está correto
4. Confirme que o backend está respondendo
5. Teste conexão: `curl https://banckend-production-14a1.up.railway.app/api/health`

### Login não funciona
1. Verifique se callback URL está configurada no Deriv
2. Confirme que `NEXT_PUBLIC_DERIV_APP_ID` está correto
3. Verifique `NEXT_PUBLIC_DERIV_CALLBACK_URL` está correto
4. Teste a URL de callback no navegador

### WebSocket não conecta
1. Verifique se `NEXT_PUBLIC_WS_URL` está correto
2. Certifique-se que o backend suporta WSS (WebSocket Secure)
3. Verifique CORS/política de origem

## 📞 Suporte

- **Vercel Docs**: https://vercel.com/docs
- **Deriv API Docs**: https://developers.deriv.com
- **Next.js Docs**: https://nextjs.org/docs
