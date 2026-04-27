# 🧪 Guia de Testes - Nexora Trading Platform

## Testes Locais (Antes do Deploy)

### Pré-requisito
```bash
# Certifique-se de ter as dependências instaladas
pnpm install

# Ou npm
npm install
```

### 1. Iniciar Aplicação Localmente
```bash
pnpm dev
# ou
npm run dev
```

Acesse: `http://localhost:3000`

### 2. Testes Básicos de Renderização
- [ ] **Homepage carrega**: Você vê "Nexora" e botão de login
- [ ] **Sem erros no Console**: Abra F12 → Console, não deve ter erros em vermelho
- [ ] **Responsivo**: Resize a janela (mobile, tablet, desktop) - layout se adapta

### 3. Testes de Integração com Backend

#### 3.1 Verificar Conectividade
```bash
# Em outro terminal, teste se o backend está acessível
curl https://banckend-production-14a1.up.railway.app/api/health

# Resultado esperado: Status 200 com resposta JSON
```

#### 3.2 WebSocket
1. Abra DevTools (F12)
2. Vá para "Network"
3. Filtre por "WS"
4. Se vir conexão para `wss://banckend-production-14a1.up.railway.app`, está bom

### 4. Teste de Login (Se possível localmente)

**Nota**: Para testar login completo, você precisa configurar callback local.

Se tiver, configure no Deriv:
```
Redirect URI: http://localhost:3000/callback
```

Então:
1. Clique "Login com Deriv"
2. Você deve ser redirecionado para Deriv
3. Depois redirecionado para http://localhost:3000/callback
4. Depois para /dashboard

### 5. Testes de Build
```bash
# Compilar para produção
pnpm build

# Resultados esperados:
# ✓ Compiled successfully
# ✓ Generating static pages
# ✓ Finalizing page optimization
```

Se houver erros, você verá `✗` em vermelho.

## Testes Pós-Deploy (No Vercel)

### 1. Acessibilidade
- [ ] Acesse sua URL Vercel: `https://[seu-projeto].vercel.app`
- [ ] Página carrega em < 3 segundos
- [ ] Sem erros 404 ou 500

### 2. Funcionalidade
- [ ] Homepage renderiza corretamente
- [ ] Botão "Login com Deriv" é clicável
- [ ] Clique dispara redirecionamento para Deriv

### 3. Login Flow
1. [ ] Clique "Login com Deriv"
2. [ ] Redirecionado para: `https://auth.deriv.com/oauth/authorize`
3. [ ] Faça login no Deriv (ou autorize se já logado)
4. [ ] Redirecionado de volta para seu app
5. [ ] Token salvo em localStorage
6. [ ] Dashboard carrega com dados reais

### 4. Dashboard
Após login bem-sucedido:
- [ ] Saldo aparece (balance)
- [ ] Gráficos carregam
- [ ] Tabela de trades mostra dados
- [ ] Botões Start/Stop Bot estão presentes

### 5. Teste de WebSocket
1. Abra DevTools (F12)
2. Vá para "Network" → "WS"
3. Procure por conexão WSS
4. Status deve ser "101 Switching Protocols"

### 6. Performance
1. Vá para: `https://[seu-projeto].vercel.app`
2. Abra DevTools → Lighthouse
3. Execute auditoria
4. Esperado:
   - Performance > 80
   - Accessibility > 80
   - Best Practices > 80

## Testes de Erro

### Cenário 1: Backend Offline
1. Desligue o backend
2. Tente acessar dashboard
3. Esperado: Mensagem de erro clara
4. Não deve quebrar a página

### Cenário 2: Token Expirado
1. Após login, aguarde token expirar ou delete localStorage
2. Tente fazer uma ação
3. Esperado: Redireciona para login

### Cenário 3: CORS Error
1. Se receber erro CORS:
   - Verifique se backend permite seu domínio
   - Confirme headers de CORS no backend
   - Teste com curl: `curl -H "Origin: seu-dominio" -v https://backend...`

## Testes Manuais - Checklist Completo

### Login
- [ ] Botão "Login" é visível
- [ ] Clique abre OAuth Deriv
- [ ] Após autorizar, volta ao app
- [ ] Tokens aparecem em localStorage

### Dashboard
- [ ] Balance carrega
- [ ] Moeda está correta
- [ ] Gráficos renderizam
- [ ] Trades aparecem

### Bot Controls
- [ ] Botão "Start Bot" funciona
- [ ] Status muda para "Running"
- [ ] Botão "Stop Bot" funciona
- [ ] Trades aparecem na tabela

### Menu
- [ ] Menu carrega corretamente
- [ ] Links navegam para as páginas
- [ ] Estratégias aparecem (se tiver)

### Logout
- [ ] Botão logout remove token
- [ ] Redireciona para home
- [ ] localStorage é limpo

## Testes Automatizados (Opcional)

Se quiser adicionar testes automatizados, crie um arquivo `tests/app.test.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await expect(page).toHaveTitle(/Nexora/)
  await expect(page.locator('text=Login')).toBeVisible()
})

test('api connection works', async () => {
  const response = await fetch('https://backend-url.com/api/health')
  expect(response.status).toBe(200)
})
```

Execute com:
```bash
pnpm add -D @playwright/test
npx playwright test
```

## Ferramentas Úteis

### DevTools (F12)
- **Console**: Veja erros JS
- **Network**: Veja requisições HTTP/WebSocket
- **Application**: Veja localStorage, cookies
- **Performance**: Analise velocidade

### curl
```bash
# Testar backend
curl -H "Authorization: Bearer TOKEN" \
  https://backend-url/api/accounts

# Testar CORS
curl -H "Origin: seu-dominio.com" -v \
  https://backend-url/api/accounts
```

### Lighthouse (DevTools)
1. F12 → Lighthouse
2. Clique "Analyze page load"
3. Veja score em várias categorias

## Relatório de Testes

Antes de considerar o deploy completo, preencha:

```
[ ] Homepage carrega sem erros
[ ] Build compila com sucesso
[ ] WebSocket conecta
[ ] Backend responde
[ ] Login funciona
[ ] Dashboard carrega
[ ] Gráficos renderizam
[ ] Bot pode iniciar
[ ] Logout funciona
[ ] Performance > 80
[ ] Sem erros CORS
[ ] Navegação funciona
[ ] Responsivo em mobile
```

Se todas as caixas estão marcadas ✓, você está pronto para produção!
