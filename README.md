# Incentive Meta — Render Web Service + GitHub + StreamElements + TMDB

Este projeto roda como **UM Web Service do Render**. O GitHub serve somente como repositório-fonte do deploy.

Fluxo:

```text
Chat -> StreamElements $(customapi) -> Render Web Service -> TMDB -> imagem 1920x1080 -> Incentive
```

## Comando no chat

```text
!meta 150 | 2 | One Piece
!meta 80,50 | T3 | Naruto Shippuden
!meta 50 | Frieren
```

- primeiro campo: valor da meta;
- segundo campo opcional: temporada;
- último campo: nome da série/anime.

## Imagem 1920x1080

O Web Service procura nesta ordem:

1. poster/capa da temporada;
2. imagem de episódio da temporada;
3. backdrop da série;
4. poster geral da série.

A resposta final de `/image/season` é JPEG 1920x1080. Posters verticais são montados sobre fundo desfocado para manter 16:9 sem deformar a capa.

# 1. GitHub

Crie um repositório e envie **todos os arquivos desta pasta**. Não envie `.env` nem tokens.

# 2. Render — New > Web Service

No Render:

1. clique **New > Web Service**;
2. conecte sua conta do GitHub;
3. selecione o repositório deste projeto;
4. configure:

```text
Language/Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

O programa escuta automaticamente em `0.0.0.0:$PORT`, portanto não crie uma porta manual.

## Environment Variables do Web Service

Adicione em **Render > Web Service > Environment**:

```text
TMDB_BEARER_TOKEN=SEU_TOKEN_TMDB
CHAT_SECRET=UM_SEGREDO_GRANDE_ALEATORIO
PUBLIC_BASE_URL=https://SEU-SERVICO.onrender.com
```

O `PUBLIC_BASE_URL` pode ser omitido porque o serviço consegue descobrir o próprio host na requisição, mas é recomendado configurá-lo.

Opcionais:

```text
TMDB_API_KEY=
TMDB_LANGUAGE=pt-BR
TMDB_FALLBACK_LANGUAGE=en-US
IMAGE_JPEG_QUALITY=92
ALLOWED_CHAT_USERS=
```

`ALLOWED_CHAT_USERS` aceita logins separados por vírgula, por exemplo:

```text
icarolinaporto,xyzgx
```

# 3. Conectar a conta do Incentive

O Incentive não publica uma API documentada de criação/edição de meta. Portanto o Web Service reproduz a **requisição real que o painel autenticado da sua conta faz**. Isso evita inventar um endpoint que não existe.

Faça uma vez:

1. abra seu painel do Incentive;
2. pressione `F12` e abra `Network`;
3. crie uma meta de teste com nome raro, por exemplo `AUTO_META_TESTE_98765`, valor `123.45` e uma imagem de teste;
4. encontre a requisição que criou a meta;
5. clique nela com o botão direito -> `Copy` -> `Copy as cURL (bash)`;
6. depois do deploy, abra:

```text
https://SEU-SERVICO.onrender.com/configurar.html
```

7. cole o cURL, o título/valor usados no teste e, se a requisição contiver a imagem, a URL/identificador da imagem;
8. clique em **Gerar variável do Render**;
9. copie o valor gerado para:

```text
INCENTIVE_CREATE_CURL_B64
```

em **Render > seu Web Service > Environment** e salve.

O cURL é transformado em template com estes placeholders:

```text
{{TITLE}}
{{AMOUNT}}
{{AMOUNT_CENTS}}
{{SEASON}}
{{IMAGE_URL}}
{{TMDB_ID}}
{{USER}}
{{PROVIDER}}
```

O Web Service remove automaticamente headers inadequados para replay, como `Content-Length`, `Host`, `Connection` e `Accept-Encoding`.

> Se o Incentive fizer upload da imagem em uma requisição separada e a criação da meta aceitar somente um ID interno de upload, será necessário reproduzir também esse segundo request. Isso depende do funcionamento privado atual do painel do Incentive.

# 4. StreamElements

Crie o Custom Command `!meta` e coloque a permissão como **Moderator** ou **Broadcaster**.

Use como resposta:

```text
$(customapi https://SEU-SERVICO.onrender.com/se/meta?key=SEU_CHAT_SECRET&q=$(queryescape $(1:))&user=$(queryescape $(sender.name))&provider=$(provider))
```

Troque:

```text
SEU-SERVICO
SEU_CHAT_SECRET
```

pelos valores do seu Web Service.

O StreamElements faz essa chamada por GET, então o endpoint `/se/meta` recebe a mensagem, consulta o TMDB, gera a URL 1920x1080 e chama o Incentive no servidor.

# 5. Testes

Status do Web Service:

```text
https://SEU-SERVICO.onrender.com/health
```

Deve retornar algo semelhante a:

```json
{"ok":true,"incentive":true,"tmdb":true}
```

Testar TMDB/temporada:

```text
https://SEU-SERVICO.onrender.com/api/preview?title=One%20Piece&season=2
```

O JSON retorna `image1920x1080`. Abra essa URL e confirme a imagem final.

Depois teste no chat:

```text
!meta 150 | 2 | One Piece
```

# Render Free

Este pacote **não usa GitHub Actions nem outro processo fora do Web Service**. Em plano Free, o Render pode suspender um Web Service ocioso; nesse caso o primeiro comando depois de um período parado pode não responder dentro do limite do StreamElements. Um plano do Render que mantenha o serviço ativo evita essa limitação.

# Rotas

```text
GET /health
GET /api/preview?title=...&season=...
GET /image/season?title=...&season=...&sig=...
GET /se/meta?key=...&q=...&user=...&provider=...
GET /configurar.html
```

# Segurança

- deixe sua chave/token TMDB apenas no Environment do Render;
- deixe cookies/token do Incentive somente no Environment do Render;
- não publique `CHAT_SECRET` em arquivo do GitHub;
- configure `!meta` para Moderator/Broadcaster;
- opcionalmente use `ALLOWED_CHAT_USERS` como segunda trava.
