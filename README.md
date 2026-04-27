# 🚀 Nexora Trading Platform

Plataforma de trading automatizado integrada com Deriv API. Controle bots de trading, visualize gráficos em tempo real e monitore suas operações com uma interface moderna e intuitiva.

## ✨ Funcionalidades

- **🔐 Autenticação OAuth2** com Deriv
- **📊 Dashboard em tempo real** com gráficos e dados de conta
- **🤖 Controle de Bot** com start/stop
- **💹 Análise de Trades** com histórico detalhado
- **🎯 Múltiplas Estratégias** de trading
- **🌙 Tema escuro/claro** automático
- **📱 Design responsivo** para mobile/tablet/desktop
- **🔒 Segurança aprimorada** com CSP e headers de segurança

## 🛠️ Stack Tecnológico

### Frontend
- **Next.js 16** - Framework React moderno
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Componentes UI
- **Recharts** - Gráficos
- **Context API** - State management

### Backend
- **Railway** - Hospedagem: `https://banckend-production-14a1.up.railway.app`
- **Node.js / Deriv API** - Trading logic

### APIs Externas
- **Deriv API** - Trading e market data
- **WebSocket** - Conexão em tempo real

## 📋 Pré-requisitos

- Node.js >= 18
- pnpm/npm/yarn
- Conta Deriv (https://deriv.com)
- Acesso ao Dashboard Deriv para OAuth

## 🚀 Quick Start

### 1. Clonar Repositório
```bash
git clone <seu-repositorio>
cd nexora-trading
```

### 2. Instalar Dependências
```bash
pnpm install
```

### 3. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.example .env.local

# Editar .env.local com seus valores
NEXT_PUBLIC_API_URL=https://banckend-production-14a1.up.railway.app
NEXT_PUBLIC_DERIV_APP_ID=3356rGdzrsnQaEKsg8MMA
NEXT_PUBLIC_DERIV_CALLBACK_URL=http://localhost:3000/callback
NEXT_PUBLIC_WS_URL=wss://banckend-production-14a1.up.railway.app
```

### 4. Iniciar Servidor de Desenvolvimento
```bash
pnpm dev
```

Acesse: `http://localhost:3000`

### 5. Build para Produção
```bash
pnpm build
pnpm start
```

## 📚 Documentação

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guia completo de deploy no Vercel
- **[CHECKLIST-DEPLOY.md](./CHECKLIST-DEPLOY.md)** - Checklist de pré-deploy
- **[TESTING.md](./TESTING.md)** - Guia de testes

## 🏗️ Estrutura do Projeto

```
nexora-trading/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Homepage
│   ├── callback/                # OAuth callback
│   ├── dashboard/               # Dashboard principal
│   ├── menu/                    # Menu/settings
│   ├── layout.tsx               # Root layout
│   ├── providers.tsx            # Context providers
│   └── globals.css              # Estilos globais
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── dashboard/               # Dashboard components
│   │   ├── balance-card.tsx
│   │   ├── chart-section.tsx
│   │   ├── controls-section.tsx
│   │   ├── footer.tsx
│   │   └── trades-table.tsx
│   ├── loader.tsx               # Loading spinner
│   ├── theme-provider.tsx       # Theme setup
│   └── ...
├── lib/
│   ├── api.ts                   # API e WebSocket
│   ├── auth-context.tsx         # Auth state
│   ├── trading-context.tsx      # Trading state
│   ├── utils.ts                 # Utilities
│   └── ...
├── middleware.ts                # Next.js middleware (security)
├── next.config.mjs              # Next.js config
├── tailwind.config.ts           # Tailwind config
├── tsconfig.json                # TypeScript config
└── package.json                 # Dependencies
```

## 🔌 API Endpoints (Backend)

### Autenticação
- `POST /api/auth/callback` - Exchange OAuth token
- `GET /api/auth/validate` - Validate token
- `POST /api/auth/logout` - Logout

### Contas
- `GET /api/accounts` - List accounts
- `POST /api/accounts/switch` - Switch account
- `POST /api/accounts/{id}/reset` - Reset demo balance

### Trading
- `POST /api/trading/init` - Initialize session
- `GET /api/trading/symbols` - Get symbols
- `POST /api/trading/proposal` - Get contract proposal
- `POST /api/trading/buy` - Buy contract
- `POST /api/trading/sell` - Sell contract
- `GET /api/trading/balance` - Get balance

### WebSocket
- `ws://backend/` - WebSocket connection para dados em tempo real

## 🔐 Segurança

- **OAuth2** - Autenticação segura com Deriv
- **CSP (Content Security Policy)** - Proteção contra XSS
- **HTTPS/WSS** - Conexões encriptadas
- **Headers de Segurança**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Variáveis de Ambiente** - Credenciais seguras
- **Rate Limiting** - Proteção contra abuso

## 🚀 Deploy

### Vercel (Recomendado)
```bash
# Opção 1: Via CLI
vercel

# Opção 2: Via GitHub
# 1. Push para GitHub
# 2. Acesse vercel.com/new
# 3. Conecte seu repositório
# 4. Configure variáveis de ambiente
# 5. Deploy automático!
```

Veja [DEPLOYMENT.md](./DEPLOYMENT.md) para instruções detalhadas.

## 🧪 Testes

```bash
# Build para produção
pnpm build

# Análise de performance (Lighthouse)
# F12 → Lighthouse → Analyze page load

# Testes unitários (opcional)
pnpm test
```

Veja [TESTING.md](./TESTING.md) para guia completo de testes.

## 🐛 Troubleshooting

### "API_BASE_URL is empty"
- Verifique `.env.local`
- Assegure-se que `NEXT_PUBLIC_API_URL` está definido

### "CORS error"
- Confirme que backend permite seu domínio
- Verifique headers CORS no backend

### "WebSocket connection failed"
- Verifique se `NEXT_PUBLIC_WS_URL` está correto
- Backend deve suportar WSS (WebSocket Secure)

### "Token inválido"
- Faça logout e login novamente
- Verifique se Deriv callback URL está configurada

## 📞 Suporte

- **Deriv Docs**: https://developers.deriv.com
- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind Docs**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com

## 📄 Licença

Proprietary - Todos os direitos reservados

## 👥 Contribuindo

1. Crie uma branch (`git checkout -b feature/AmazingFeature`)
2. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
3. Push para a branch (`git push origin feature/AmazingFeature`)
4. Abra um Pull Request

## ✅ Status

- ✅ Frontend: Pronto para deploy
- ✅ Backend: Rodando em Railway
- ✅ OAuth: Configurado
- ✅ Build: Passando
- ⏳ Deploy: Aguardando suas variáveis de ambiente

---

**Pronto para publicar? Siga o [DEPLOYMENT.md](./DEPLOYMENT.md) 🚀**
