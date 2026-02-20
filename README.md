# Comercial Fagundes - Gestor de Dívidas

Aplicativo desktop em Electron + React para gestão de clientes, vendas, pagamentos e extrato.

## Stack
- Electron
- React + TypeScript + Vite
- Supabase

## Estrutura
- `electron/` - processo principal do Electron
- `renderer/` - interface React
- `.github/workflows/` - automação de release Windows

## Requisitos
- Node.js 20+
- npm 10+

## Configuração local
1. Instale dependências:
```bash
npm ci
npm ci --prefix renderer
```

2. Configure variáveis do frontend:
```bash
cp renderer/.env.example renderer/.env
```

3. Edite `renderer/.env`:
```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
```

## Desenvolvimento
```bash
npm run dev
```

## Qualidade e build
```bash
npm run check
```

## Gerar instalador Windows
```bash
npm run dist:win
```

Arquivo gerado:
- `dist/Comercial-Fagundes-Setup.exe`

## Conectar no GitHub (passo a passo)
1. Crie um repositório vazio no GitHub (sem README inicial).
2. No terminal da pasta do projeto, rode:
```bash
git config user.name "Seu Nome"
git config user.email "seu-email@exemplo.com"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git add .
git commit -m "chore: setup inicial"
git push -u origin main
```

Se já existir commit local e você só quer conectar o remoto, use:
```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

## Publicar instalador automático via tag
O workflow `.github/workflows/release-windows.yml` publica release automática.

Configure os secrets no GitHub:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois publique uma tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Para publicar uma atualização nova (auto-update), aumente a versão no `package.json` antes da nova tag:
```bash
npm version patch
git push origin main --follow-tags
```

Exemplo:
- versão atual `1.0.0`
- próxima versão `1.0.1`
- app instalado detecta e baixa automaticamente

Observação:
- o auto-update é habilitado para builds Windows publicados via GitHub Release com os arquivos:
  - `Comercial-Fagundes-Setup.exe`
  - `Comercial-Fagundes-Setup.exe.blockmap`
  - `latest.yml`

Link fixo de download:
```text
https://github.com/SEU_USUARIO/SEU_REPO/releases/latest/download/Comercial-Fagundes-Setup.exe
```
