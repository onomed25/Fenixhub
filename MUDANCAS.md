# Relatório de Modificações do Projeto Fenixhub

Este documento detalha todas as intervenções, migrações, correções de bugs e melhorias arquiteturais realizadas no repositório.

---

## 1. Migração do Backend (Node.js/Express para Go/Gin)

O backend original em JavaScript (Node.js/Express) foi completamente descontinuado e substituído por uma arquitetura em **Go (Golang)** de alta performance utilizando o framework **Gin**.

### Arquivos Removidos
- Backend legado: `index.js`, `src/hfDatabase.js`, `src/media-merger.js`, `src/security.js`, `src/viewsTracker.js`.
- Serviços obsoletos: `telegram-service.js`, `telegram-service-refactored.js`, `telegram-service-refactored.test.js`.
- Dependências Node desnecessárias: pasta `node_modules/` e `package-lock.json`.

### Nova Estrutura em Go
- `main.go`: Ponto de entrada do servidor HTTP, configuração de CORS unificado, cabeçalhos de segurança, injeção de dependências e rotas estáticas.
- `internal/config/config.go`: Leitor centralizado das variáveis do arquivo `.env`.
- `internal/auth/auth.go`: Gerenciamento de tokens JWT (HS256, 30 dias de validade), verificação segura de senhas Admin e Ajudante (com suporte a hash bcrypt e SHA-256 com `subtle.ConstantTimeCompare`), e extração unificada de credenciais (Header, Cookie ou Form).
- `internal/hf/hf.go`: Cliente REST nativo para o Hugging Face Dataset (`Fenixflix/Database`), com downloads concorrentes do catálogo (pool de 15 workers), commits atômicos via protocolo `application/x-ndjson`, cache em memória e validação prévia de existência de arquivos para evitar erros 404 em deleções.
- `internal/database/db.go`: Camada de dados dual com suporte a PostgreSQL (Supabase) e fallback automático para SQLite local (`fenixhub.db`) caso o banco remoto esteja pausado ou offline.
- `internal/merger/merger.go`: Motor de mesclagem e deduplicação de streams (chave composta `name|url`), injeção automática de data de criação (`criado_em`), preservação de colaboradores e sanitização de placeholders (ex: "aleatorio").
- `internal/views/views.go`: Rastreador de visualizações concorrente e thread-safe, com agregação de metadados e persistência assíncrona debounced em disco (`cache/views_cache.json`).
- `internal/handlers/handlers.go`: Controladores de todas as rotas da API (Catálogo, Upload, Moderação, Pedidos, Denúncias, Discord OAuth e TMDB Proxy).

---

## 2. Correção de Rotas Estáticas e Inicialização

- **Mapeamento de `/js`:** Identificado que o frontend ficava com o catálogo zerado e tela inativa porque o `main.go` não possuía o mapeamento para `./public/js`, causando erro 404 ao carregar `/js/app.js`. Adicionado `r.Static("/js", "./public/js")`.
- **Scripts de execução:** O arquivo `package.json` foi adaptado para que `npm start` execute diretamente `go run .`.

---

## 3. Uploads de Mídia e Envio Direto (Sem Telegram)

- **Desacoplamento do Telegram:** O fluxo de envio agora aceita links de vídeo diretos (Render, Koyeb, CDNs, etc.) sem depender de sessões ou contas de telefone do Telegram.
- **Flexibilidade no `/upload`:** O endpoint aceita múltiplos formatos de entrada:
  1. JSON envelopado: `{"nome": "tt...", "conteudo": {...}}`
  2. JSON de mídia direto: `{"id": "tt...", "type": "movie", "streams": [...]}`
  3. Upload de arquivo multipart: `curl -F "file=@tt123.json"`
  4. Formulário tradicional do frontend (`FormData` com `nome`, `conteudo`, `uploader_nick`).
- **Autenticação Unificada:** Requer autenticação via senha de Admin, Ajudante ou sessão ativa do Discord. Envios de colaboradores/admins são publicados de imediato; envios de membros normais são direcionados para a fila de moderação (`pendentes/`).
- **Upload em Lote:** Testado e aprovado para processar envios sequenciais sem conflitos de concorrência no Hugging Face.

---

## 4. Integração e Login com o Discord

- **Validação de API:** Validado o bot oficial e a guilda **FenixFlix** contra a API v10 do Discord.
- **Cargos Reconhecidos:** Mapeamento automático dos cargos de Ajudante (`1524608411600289926`) e Colaborador (`1544051060610437200`).
- **Compatibilidade com o Frontend:**
  - O endpoint `/api/auth/me` foi atualizado para retornar o token JWT e atributos de usuário no primeiro nível do JSON, garantindo que o `localStorage.setItem('discord_token', data.token)` do frontend seja populado instantaneamente.
  - Adicionado cabeçalho `SameSite=Lax` aos cookies `discord_token` para garantir persistência após redirecionamentos de login entre domínios.

---

## 5. Endpoints de Populares e Recentes (Integração com Stremio Addon)

- **Populares (`GET /api/vistos`):**
  - O backend agrega visualizações em 3 camadas: catálogo do Hugging Face, rastreador em tempo real em disco/memória (`views_cache.json`) e banco relacional.
  - Sanitização rigorosa: remoção automática de extensões `.json` e filtros para descartar registros espúrios ou de testes (`tt_file_upload`, `tt9999999`, prefixos `test`).
  - Ordenação decrescente pelo campo de visualizações (`v` / `views`).
  - Suporte a filtros: `?type=movie`, `?type=series` e `?split=true`.
  - Formato de resposta compatível com o Stremio Addon:
    ```json
    [
      { "id": "tt14688458", "type": "movie", "v": 1197, "views": 1197 },
      { "id": "tt26545992", "type": "series", "v": 642, "views": 642 }
    ]
    ```
  - Consumo direto pelo Stremio Addon (`app.py` via `_rebuild_populares_fenix_background`) para alimentar os catálogos `Filmes Populares` e `Séries Populares` (`populares_fenix`).

- **Recentes (`GET /api/all` / `GET /api/catalog`):**
  - O endpoint `/api/all` foi padronizado para servir o catálogo completo por padrão (com suporte opcional a `?names_only=true`), mantendo 100% de compatibilidade retroativa com o redirecionamento da versão anterior em Node.js.
  - Alimenta a rotina `build_recent_catalog()` do Stremio Addon, que consome `/api/all` para extrair os IDs de filmes e séries disponíveis e construir os catálogos `Filmes Recentes` (`recentes_movie`) e `Séries Recentes` (`recentes_series`).

---

## 6. Estado do Frontend e Limpeza

- **HTML Revertido:** O arquivo `index.html` foi integralmente restaurado para o seu estado original via git checkout, desfazendo alterações visuais conforme solicitação.
- **Limpeza no Hugging Face:** Todos os arquivos criados para testes locais (`tt_test_sample.json`, `tt_test_frontend_form.json`, `tt_batch_01.json`, etc.) foram permanentemente excluídos do repositório `Fenixflix/Database`. O repositório contém apenas os 353 títulos oficiais limpos.

---

## 7. Atualizações Recentes no Servidor (`server`), Inicialização e Fallbacks

- **Injeção de Variáveis em Rotas Estáticas (`main.go`):** Leitura de `index.html` com substituição dinâmica de `__TELEGRAM_API_URL_PLACEHOLDER__` pelo valor configurado em `TELEGRAM_API_URL`.
- **Rotas de Fallback do Telegram (`main.go`):** Criação dos endpoints `/api/telegram/status`, `/api/telegram/login-phone` e `/api/telegram/login-code` retornando mensagens informativas em JSON, prevenindo erros 404 e ruídos no console do cliente.
- **Frontend Flexibilizado (`public/js/app.js`):** O frontend agora trata a ausência da API do Telegram de forma não bloqueante. O painel de login fica oculto e o formulário permite colar links diretos de streaming sem travar o usuário.
- **Pipeline de Build e Deploy (`package.json`):**
  - Script `build`: compila o binário nativo `server` utilizando o compilador Go do sistema ou efetuando download autônomo do Go 1.23.2 em ambientes de nuvem (Render).
  - Script `postinstall`: dispara automaticamente o build após a instalação de pacotes.
  - Script `start`: executa o binário nativo `./server` com fallback seguro para build antecipado.
- **Binário Compilado (`server`):** Recompilado e atualizado localmente com todas as correções de rotas, filtros e compatibilidade.

---

## 8. Otimizações de Desempenho e Sincronia (Servidor & Addon)

1. **Ordenação Cronológica Real dos Recentes (`internal/hf/hf.go`):**
   - Implementada a função `extractItemTimestamp` para extrair a data real de cadastro (`criado_em`) tanto no nível raiz do documento quanto nos objetos de streams internos.
   - O catálogo é ordenado de forma estritamente decrescente, garantindo que os lançamentos e adições mais recentes fiquem no topo.

2. **Filtro Direto de Tipo no Addon (`Fenix_Apoiadores/app.py`):**
   - O addon passa a requisitar `/api/vistos?type={content_type}` diretamente ao servidor Go.
   - Adicionada validação antecipada de `item.get("type")`, evitando leituras de cache desnecessárias e cortando o tráfego de dados e chamadas externas ao TMDB pela metade.

3. **Deduplicação e Validação dos Recentes (`Fenix_Apoiadores/app.py`):**
   - Em `build_recent_catalog()`, foi adicionado controle com `seen_ids` e validação de prefixo `tt...`.
   - Impede títulos duplicados ou identificadores inválidos de consumirem quotas de busca no TMDB.


