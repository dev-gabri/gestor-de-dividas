# Comercial Fagundes - Gestor de Dívidas

Aplicativo desktop para controle de fiado no mercado: clientes, vendas, pagamentos e extrato.

Desenvolvido por **Gabriel Franca**.

## Download do executável (Windows)
Baixe sempre a versão mais recente:

`https://github.com/dev-gabri/gestor-de-dividas/releases/latest/download/Comercial-Fagundes-Setup.exe`

Passos:
1. Clique no link acima.
2. Baixe o arquivo `Comercial-Fagundes-Setup.exe`.
3. Execute o instalador no Windows.

## Atualização automática
O sistema verifica novas versões automaticamente quando uma nova Release é publicada no GitHub.

## Tecnologias
- Electron
- React + TypeScript + Vite
- Supabase

## Desenvolvimento local
1. Instalar dependências:
```bash
npm ci
npm ci --prefix renderer
```
2. Criar ambiente:
```bash
cp renderer/.env.example renderer/.env
```
3. Preencher `renderer/.env`:
```env
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
```
4. Rodar app:
```bash
npm run dev
```
