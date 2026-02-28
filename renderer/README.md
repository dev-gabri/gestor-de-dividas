# Renderer (React + Vite)

Frontend do app Electron.

## Scripts
- `npm run dev` - servidor local Vite
- `npm run build` - build de produção
- `npm run lint` - lint do código

## Ambiente
Copie:
```bash
cp .env.example .env
```

E preencha:
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Para documentação geral do projeto, veja `../README.md`.

## Assets
Os assets do app ficam separados por responsabilidade:

- `renderer/public/branding/`
- `renderer/public/images/backgrounds/`
- `renderer/public/images/company/`
- `../resources/icons/`

Convenção:

- `renderer/public/branding/`: logo e ícone usados em tempo de execução pelo frontend.
- `renderer/public/images/`: imagens estáticas da interface.
- `resources/icons/`: ícones de empacotamento para Electron Builder.
