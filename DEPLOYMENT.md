# Guia de Deploy - Nexora Trading Platform

## 🚀 Publicação no Vercel

### Pré-requisitos
- Conta no Vercel (https://vercel.com)
- Repositório Git (GitHub, GitLab ou Bitbucket)
- Backend rodando em: `https://banckend-production-14a1.up.railway.app`

### Passo 1: Configurar Repositório Git

```bash
# Inicializar Git (se ainda não feito)
git init
git add .
git commit -m "Initial commit: Nexora Trading Platform"

# Criar repositório no GitHub/GitLab
# Depois fazer push
git remote add origin <seu-repositorio>
git push -u origin main
```

### Passo 2: Deploy no Vercel

**Opção A: CLI (Linha de Comando)**
```bash
npm install -g vercel
vercel
```

**Opção B: Website**
1. Vá para https://vercel.com/new
2. Selecione "Import Git Repository"
3. Selecione seu repositório
4. Configure as variáveis de ambiente (veja Passo 3)
5. Clique "Deploy"

### Passo 3: Configurar Variáveis de Ambiente

No Vercel Dashboard, em "Settings" → "Environment Variables", adicione:

```
NEXT_PUBLIC_API_URL = https://banckend-production-14a1.up.railway.app
NEXT_PUBLIC_DERIV_APP_ID = 3356rGdzrsnQaEKsg8MMA
NEXT_PUBLIC_DERIV_CALLBACK_URL = https://seu-dominio-vercel.com/callback
NEXT_PUBLIC_WS_URL = wss://banckend-production-14a1.up.railway.app
```

### Passo 4: Configurar Callback no Deriv

1. Acesse sua conta Deriv Developer
2. Vá para "My Apps"
3. Edite sua aplicação
4. Adicione em "Redirect URIs":
   - `https://seu-dominio-vercel.com/callback`
   - `https://seu-dominio-vercel.com/menu`

### Passo 5: Verificar CORS no Backend

Certifique-se de que seu backend Railway permite requisições de:
- `https://seu-dominio-vercel.com`
- Todos os endpoints necessários têm CORS habilitado

### ✅ Pós-Deploy

1. **Testar Login**: Clique em "Login com Deriv"
2. **Verificar Conexão**: Verifique se o dashboard carrega dados
3. **Monitor de Erros**: Use Vercel Analytics para monitorar

## 🔧 Troubleshooting

### Erro: "API_BASE_URL is empty"
- Verifique se `NEXT_PUBLIC_API_URL` está configurado no Vercel
- Redeploy após adicionar a variável

### Erro: "CORS error"
- Confirme que o backend permite `https://seu-dominio.com`
- Verifique se a URL do backend está correta

### Erro: "Token inválido"
- O token Deriv pode ter expirado
- Faça logout e login novamente
- Verifique se o callback está correto

## 📊 Monitoramento

- **Vercel Analytics**: https://vercel.com/dashboard
- **Erro Logs**: Verifique em "Deployments" → "Logs"
- **Real-time Alerts**: Configure em Settings → Alerts

## 🔐 Segurança

- Todas as variáveis sensíveis estão em variáveis de ambiente
- CORS está restrito ao domínio de produção
- CSP (Content Security Policy) está configurado no middleware
- Headers de segurança estão ativados

## 📝 Domínio Customizado

1. Vá para Vercel Dashboard
2. Selecione seu projeto
3. Settings → Domains
4. Adicione seu domínio customizado
5. Siga as instruções de configuração de DNS
