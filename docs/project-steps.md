# 🗺️ Roadmap - Wedding API

## ✅ Concluído

- [x] Configuração inicial do projeto (Node.js, Fastify, Drizzle ORM, PostgreSQL)
- [x] Modelagem do banco de dados
  - [x] Tabela `guests` (convidados)
  - [x] Tabela `gifts` (presentes - catálogo)
  - [x] Tabela `purchases` (compras realizadas)
  - [x] Tabela `memories` (lembranças/fotos)
  - [x] Tabela `admins` (administradores)
- [x] Configuração do Drizzle ORM
- [x] Setup do Docker Compose (PostgreSQL)
- [x] Migrations do banco de dados
- [x] Estrutura de pastas organizada (routes, controllers, services, utils)
- [x] Configuração do Biome (linter/formatter)
- [x] Configuração do Swagger (documentação API)
- [x] **Gestão de Convidados**
  - [x] Importação de convidados via CSV
  - [x] Buscar família por telefone
  - [x] Confirmar presença de convidados
  - [x] Agrupar convidados por telefone (família)
  - [x] Separação entre adultos e crianças

---

## 🚧 Próximos Passos

### **1. Sistema de Autenticação (Admin)** 🔐

**Prioridade:** ALTA

- [ ] Criar service de autenticação (`auth.service.ts`)
- [ ] Implementar hash de senha (bcrypt)
- [ ] Implementar JWT (jsonwebtoken)
- [ ] Criar rota de registro de admin
- [ ] Criar rota de login de admin
- [ ] Criar middleware de autenticação
- [ ] Proteger rotas administrativas

**Endpoints:**
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

---

### **2. CRUD de Presentes (Admin)** 🎁

**Prioridade:** ALTA

- [ ] Criar `gifts.service.ts`
- [ ] Criar `gifts.controller.ts`
- [ ] Criar `gifts.routes.ts`
- [ ] Implementar upload de imagens (Cloudinary ou S3)
- [ ] Proteger rotas com middleware de autenticação

**Endpoints:**
```
GET    /api/gifts              (público - listar presentes disponíveis)
GET    /api/gifts/:id          (público - detalhes do presente)
POST   /api/gifts              (admin - criar presente)
PUT    /api/gifts/:id          (admin - atualizar presente)
DELETE /api/gifts/:id          (admin - deletar presente)
POST   /api/gifts/:id/upload   (admin - upload de imagem)
```

**Features:**
- Validação de dados com Zod
- Suporte a múltiplas imagens por presente
- Marcar presente como disponível/indisponível
- Listar presentes comprados vs disponíveis

---

### **3. Gestão de Convidados (Admin)** 👥

**Prioridade:** MÉDIA

- [ ] Estender rotas de convidados para admin
- [ ] Criar endpoint para adicionar convidado manualmente
- [ ] Criar endpoint para editar convidado
- [ ] Criar endpoint para deletar convidado
- [ ] Listar todos os convidados confirmados
- [ ] Exportar lista de convidados (CSV)

**Endpoints:**
```
GET    /api/admin/guests              (listar todos)
POST   /api/admin/guests              (criar convidado)
PUT    /api/admin/guests/:id          (editar convidado)
DELETE /api/admin/guests/:id          (deletar convidado)
GET    /api/admin/guests/confirmed    (listar confirmados)
GET    /api/admin/guests/export       (exportar CSV)
```

---

### **4. Sistema de Compras** 💳

**Prioridade:** MÉDIA

- [ ] Criar `purchases.service.ts`
- [ ] Criar `purchases.controller.ts`
- [ ] Criar `purchases.routes.ts`
- [ ] Implementar lógica de compra
- [ ] Validar se presente está disponível
- [ ] Associar compra ao convidado
- [ ] Listar compras por convidado
- [ ] Listar compras por presente (admin)

**Endpoints:**
```
POST /api/purchases              (criar compra - público)
GET  /api/purchases/:id          (detalhes da compra)
GET  /api/admin/purchases        (listar todas - admin)
GET  /api/admin/purchases/gift/:giftId  (compras por presente)
PUT  /api/admin/purchases/:id/status    (atualizar status - admin)
```

---

### **5. Integração com Gateway de Pagamento** 💰

**Prioridade:** BAIXA (por último)

**Opções:**
- Stripe
- Mercado Pago
- Yapay

**Tarefas:**
- [ ] Escolher gateway de pagamento
- [ ] Configurar credenciais (env)
- [ ] Criar service de pagamento
- [ ] Implementar criação de checkout
- [ ] Implementar webhook para confirmação
- [ ] Atualizar status de compra após pagamento
- [ ] Enviar confirmação por email (opcional)

**Endpoints:**
```
POST /api/payments/checkout        (criar sessão de pagamento)
POST /api/payments/webhook         (receber confirmação do gateway)
GET  /api/admin/payments           (listar pagamentos - admin)
```

---

### **6. Lembranças/Memórias** 📸

**Prioridade:** BAIXA

- [ ] Criar `memories.service.ts`
- [ ] Criar `memories.controller.ts`
- [ ] Criar `memories.routes.ts`
- [ ] Implementar upload de fotos
- [ ] Listar memórias (público)
- [ ] Deletar memórias (admin)

**Endpoints:**
```
GET    /api/memories           (listar - público)
POST   /api/admin/memories     (upload - admin)
DELETE /api/admin/memories/:id (deletar - admin)
```

---

## 🔧 Melhorias Técnicas

### **Testes**
- [ ] Configurar Vitest
- [ ] Criar testes unitários para services
- [ ] Criar testes de integração para routes
- [ ] Configurar coverage mínimo (80%)

### **Validação e Segurança**
- [ ] Rate limiting (evitar spam)
- [ ] CORS configurado
- [ ] Helmet (segurança headers HTTP)
- [ ] Validação de arquivos upload (tamanho, tipo)
- [ ] Sanitização de inputs

### **Observabilidade**
- [ ] Logger estruturado (Pino)
- [ ] Monitoramento de erros (Sentry)
- [ ] Métricas (Prometheus)

### **CI/CD**
- [ ] GitHub Actions
- [ ] Deploy automático (Railway, Render, Vercel)
- [ ] Testes automatizados no CI

### **Documentação**
- [ ] README.md completo
- [ ] Como rodar o projeto
- [ ] Exemplos de requisições
- [ ] Diagrama de arquitetura
- [ ] Documentação do Swagger completa

---

## 📦 Dependências a Instalar

```bash
# Autenticação
npm install bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken

# Upload de arquivos
npm install cloudinary # ou @aws-sdk/client-s3

# Pagamentos
npm install stripe # ou mercadopago

# Segurança
npm install @fastify/helmet @fastify/cors @fastify/rate-limit

# Email (opcional)
npm install nodemailer
npm install -D @types/nodemailer

# Testes
npm install -D vitest @vitest/ui
```

---

## 🎯 Ordem de Implementação Sugerida

1. ✅ **Gestão de Convidados** (Concluído)
2. 🔐 **Autenticação Admin**
3. 🎁 **CRUD de Presentes**
4. 👥 **Gestão Completa de Convidados (Admin)**
5. 💳 **Sistema de Compras**
6. 📸 **Lembranças/Memórias**
7. 💰 **Integração com Gateway de Pagamento**

---

## 📝 Notas

- Sempre proteger rotas administrativas com autenticação
- Validar todos os inputs com Zod
- Manter documentação Swagger atualizada
- Fazer commits semânticos
- Criar migrations para mudanças no banco

proximos Passos
Autenticação com Better Auth funcionando
⏳ Criar endpoints para gerenciar presentes (CRUD protegido)
⏳ Criar endpoints para visualizar convidados confirmados
⏳ Integrar com gateway de pagamentos (Stripe/Mercado Pago)
