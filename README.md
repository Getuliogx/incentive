# Incentive Meta — tudo dentro de UM Render Web Service

Fluxo:

```text
Chat -> bot StreamElements -> Render Web Service -> TMDB -> imagem 1920x1080 -> Incentive
```

O projeto usa o endpoint identificado no painel do Incentive:

```text
PUT https://api.incentive.gg/v1/panel/interactions/goal
```

com o mesmo formato de payload observado no painel (`name`, `minDonation`, `maxValue`, `currentValue`, `image`, `enableAlerts`, `type`, `alertWidget`, `goalWidget`).

## O que ja esta pronto

- comando `!meta` via `$(customapi)` do StreamElements;
- backend Express para Render Web Service;
- chamada autenticada ao Incentive usando `INCENTIVE_BEARER_TOKEN`;
- pesquisa no TMDB em pt-BR;
- temporada opcional;
- prioridade de imagem da temporada;
- fallback automatico;
- JPEG final exatamente 1920x1080;
- posters verticais convertidos para 16:9 com fundo desfocado, sem deformar;
- cache de imagens;
- pagina de teste;
- historico das ultimas chamadas para diagnostico;
- sem `INCENTIVE_CREATE_CURL_B64`;
- sem `PUBLIC_BASE_URL`;
- sem GitHub Actions;
- sem Blueprint.

## Ordem das imagens

Para serie com temporada:

1. poster/capa da temporada;
2. still de episodio da temporada;
3. backdrop geral da serie;
4. poster geral da serie.

Sem temporada, o servico tambem consegue procurar filme.

## Render

Crie **New > Web Service**, conecte o GitHub e use:

```text
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

Variaveis obrigatorias:

```text
TMDB_BEARER_TOKEN=...
INCENTIVE_BEARER_TOKEN=...
```

So isso. `PORT` e fornecida automaticamente pelo Render.

## StreamElements

Crie o comando `!meta`, coloque permissao **Moderator** ou **Broadcaster**, e use:

```text
$(customapi https://SEU-SERVICO.onrender.com/se/meta?q=$(queryescape ${1:}))
```

Exemplos:

```text
!meta 300 | T1 | Pokémon
!meta 150 | T2 | One Piece
!meta 80,50 | Naruto Shippuden | T3
!meta 50 | Frieren
```

## Testes

Status:

```text
https://SEU-SERVICO.onrender.com/health
```

Preview da escolha no TMDB:

```text
https://SEU-SERVICO.onrender.com/api/preview?title=Pokemon&season=1
```

Imagem final:

```text
https://SEU-SERVICO.onrender.com/image/season?title=Pokemon&season=1
```

Historico das ultimas chamadas:

```text
https://SEU-SERVICO.onrender.com/api/history
```

## Segredos

Nao coloque tokens no GitHub. Cole-os em **Render > Web Service > Environment**. O Bearer do Incentive pode expirar; quando isso acontecer, substitua somente `INCENTIVE_BEARER_TOKEN` no Render.


## Versao 2.3.0 - correcoes

- A imagem e gerada e validada em 1920x1080 **antes** de criar a meta no Incentive.
- O link da imagem agora usa uma rota curta `.jpg`, sem query string.
- Series/animes sem temporada informada usam automaticamente a **1ª temporada**.
- A temporada entra automaticamente no titulo da meta:
  - `!meta 500 | Frieren` -> `Frieren - 1ª Temporada`
  - `!meta 200 | T2 | Avatar: A Lenda de Aang` -> `Avatar: A Lenda de Aang - 2ª Temporada`
  - `!meta 150 | CDZ | 3` -> `CDZ - 3ª Temporada`
- Filmes continuam sem sufixo de temporada.

A ordem de imagem continua: poster da temporada -> still de episodio -> backdrop -> poster.


## Correção 2.3.0
- não usa mais URL externa no campo `image`; agora cria a meta e faz o upload local do JPG 1920x1080 no endpoint do Incentive.
- título usa o nome canônico da TMDB com temporada, ex.: `Frieren - 1ª Temporada`.


## Correção 2.3.0
O PUT de criação do Incentive pode retornar o ID como texto puro, JSON, objeto aninhado ou no header Location. Esta versão reconhece todos esses formatos antes de fazer o upload local do JPG em `/v1/panel/interactions/goal/{ID}/image`.


## Correção 2.4.0
- prefere imagens widescreen (still/backdrop) antes de poster.
- quando só houver poster, ele é recortado direto em 1920x1080, sem cópia desfocada atrás e sem layout de retrato centralizado.


## Correção 2.5.0 — imagem de capa
- removida a prioridade de frame aleatório de episódio.
- agora usa primeiro o `backdrop_path` oficial principal do TMDB, em widescreen.
- still de episódio ficou apenas como último fallback.
- poster de temporada, quando necessário, é convertido para 1920x1080 sem cópia desfocada ao fundo.
