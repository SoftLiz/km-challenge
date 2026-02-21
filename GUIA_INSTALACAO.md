# 🏃‍♂️ GUIA COMPLETO — MoveChallenge

## Conteúdo do projeto

```
movechallenge/
├── app/
│   ├── layout.js          ← estrutura base da app
│   ├── page.js            ← toda a aplicação (dashboard, ranking, etc.)
│   └── globals.css        ← estilos globais
├── lib/
│   ├── firebase.js        ← conexão com Firebase
│   ├── db.js              ← funções de base de dados
│   └── AuthContext.js     ← gestão de autenticação
├── public/
│   └── manifest.json      ← configuração PWA
├── firestore.rules        ← regras de segurança (copiar no Firebase)
├── .env.local.example     ← template das variáveis de ambiente
├── next.config.js
└── package.json
```

---

## PASSO 1 — Verifica o Node.js

Abre o terminal (no VS Code: Terminal → New Terminal) e escreve:

```bash
node --version
```

Se aparecer `v18.x.x` ou superior, estás bem.
Se não tiveres, vai a https://nodejs.org e instala a versão LTS.

---

## PASSO 2 — Cria o projeto Next.js

No terminal, vai à pasta onde queres o projeto e executa:

```bash
npx create-next-app@14 movechallenge --no-typescript --no-tailwind --no-eslint --src-dir=false --app --import-alias="@/*"
cd movechallenge
```

---

## PASSO 3 — Instala as dependências

```bash
npm install firebase framer-motion
```

---

## PASSO 4 — Substitui os ficheiros

Copia os ficheiros que geramos para dentro da pasta `movechallenge/`:

- `app/layout.js` → substitui o existente
- `app/page.js` → substitui o existente
- `app/globals.css` → substitui o existente
- `lib/firebase.js` → cria a pasta lib e adiciona
- `lib/db.js` → adiciona
- `lib/AuthContext.js` → adiciona
- `public/manifest.json` → adiciona
- `next.config.js` → substitui o existente
- `.gitignore` → substitui o existente

---

## PASSO 5 — Cria o projeto Firebase

1. Vai a https://console.firebase.google.com
2. Clica em **"Criar um projeto"**
3. Dá um nome (ex: `movechallenge`)
4. Desativa o Google Analytics (opcional) e clica **Continuar**

### Ativa a Autenticação:
1. No menu esquerdo → **Authentication** → **Get started**
2. Em **Sign-in method** → clica em **Email/Password** → ativa → **Save**

### Ativa o Firestore:
1. No menu esquerdo → **Firestore Database** → **Create database**
2. Escolhe **Start in production mode** → **Next**
3. Escolhe a região mais próxima (ex: `europe-west3`) → **Enable**

---

## PASSO 6 — Obtém as credenciais Firebase

1. No Firebase Console → clica na ⚙️ (engrenagem) → **Project settings**
2. Desce até **Your apps** → clica em **</>** (Web)
3. Regista a app com o nome `movechallenge-web`
4. Copia o objeto `firebaseConfig` que aparece

---

## PASSO 7 — Cria o ficheiro .env.local

Na pasta do projeto, cria um ficheiro chamado `.env.local` (sem extensão .txt!) e cola:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=movechallenge.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=movechallenge
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=movechallenge.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

⚠️ Substitui os valores pelos do teu firebaseConfig real.

---

## PASSO 8 — Configura as Regras do Firestore

1. Firebase Console → **Firestore Database** → aba **Rules**
2. Substitui tudo pelo conteúdo do ficheiro `firestore.rules`
3. Clica **Publish**

---

## PASSO 9 — Define o utilizador Master

O primeiro utilizador a registar-se na app terá role `user` por padrão.
Para tornar alguém Master, tens de editar manualmente no Firestore:

1. Firebase Console → **Firestore Database** → coleção `users`
2. Clica no documento do teu utilizador
3. Edita o campo `role` de `user` para `master`

---

## PASSO 10 — Testa localmente

```bash
npm run dev
```

Abre o browser em http://localhost:3000

✅ Cria uma conta
✅ Define-te como Master no Firestore
✅ Cria um desafio
✅ Testa adicionar km
✅ Convida amigos para testarem noutros dispositivos (enquanto estiver em localhost, só tu tens acesso)

---

## PASSO 11 — Publica online (Vercel) — GRATUITO

### Opção A — Via interface web (mais fácil):

1. Cria conta gratuita em https://vercel.com (usa a conta Google ou GitHub)
2. Faz upload do código para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "primeiro commit"
   ```
   Depois vai ao GitHub.com, cria um repositório e segue as instruções para push.
3. Na Vercel → **New Project** → importa o teu repositório GitHub
4. Em **Environment Variables** adiciona todas as variáveis do `.env.local`
5. Clica **Deploy**

Em 2 minutos tens o teu app online em `https://movechallenge.vercel.app`

### Opção B — Via terminal:
```bash
npx vercel --prod
```

---

## PASSO 12 — Instalar como app no telemóvel (PWA)

### No iPhone (Safari):
1. Abre o link da app no Safari
2. Toca no botão de partilhar (quadrado com seta)
3. Toca em **"Adicionar ao ecrã principal"**
4. A app aparece como ícone no ecrã! 🎉

### No Android (Chrome):
1. Abre o link no Chrome
2. Aparece automaticamente uma notificação para instalar
3. Ou: menu (3 pontos) → **"Adicionar ao ecrã principal"**

---

## ❓ Problemas comuns

**Erro: "Firebase: Error (auth/invalid-api-key)"**
→ Verifica se o `.env.local` está correto e reinicia o servidor (`npm run dev`)

**A app não carrega / página em branco**
→ Abre as DevTools do browser (F12) → aba Console → vê o erro

**"Permission denied" no Firestore**
→ Verifica se colaste as regras corretas no Firebase Console

**Não consigo criar desafio**
→ Verifica se o teu utilizador tem `role: "master"` no Firestore

---

## 🔗 Links úteis

- Firebase Console: https://console.firebase.google.com
- Vercel Dashboard: https://vercel.com/dashboard
- Next.js Docs: https://nextjs.org/docs

---

## 💡 Próximos passos (versão 2)

Quando quiseres evoluir a app, pede ajuda e implementamos:
- ✅ Notificações push diárias
- ✅ Streak de dias consecutivos
- ✅ Integração Google Fit / Apple Health
- ✅ Código de convite para o desafio
- ✅ Gráficos de evolução por semana
