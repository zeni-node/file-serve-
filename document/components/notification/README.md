# Notificações globais

## Objetivo

O módulo de notificações apresenta avisos ao usuário em uma área global da
interface. Quem cria a notificação — uma tela do frontend ou o backend — fornece
todo o conteúdo e a aparência semântica. O módulo valida os dados e os exibe;
ele não inventa nem reescreve mensagens.

## Estrutura obrigatória

Toda notificação deve fornecer estes quatro campos:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `text` | texto não vazio | Título curto e principal da notificação. |
| `description` | texto não vazio | Explicação ou detalhe complementar ao título. |
| `color` | nome permitido | Cor semântica que identifica a categoria do aviso. |
| `icon` | nome permitido | Ícone semântico exibido junto ao aviso. |

`duration` é opcional. Quando omitido, a interface usa cinco segundos. O valor
`0` mantém a notificação visível até o usuário fechá-la.

## Valores de cor e ícone

`color` e `icon` usam identificadores semânticos, não valores CSS, nomes de
componentes React ou HTML arbitrário. Cada cor possui um ícone correspondente:

| `color` | Uso | `icon` correspondente |
| --- | --- | --- |
| `success` | Operação concluída com sucesso | `check` |
| `error` | Falha ou operação não concluída | `error` |
| `warning` | Atenção necessária ou possível problema | `warning` |
| `info` | Informação geral | `info` |

O módulo associa cada `color` à cor visual e cada `icon` a um ícone conhecido.
Combinações desconhecidas ou campos obrigatórios ausentes são dados inválidos:
devem ser reportados, não substituídos silenciosamente por valores padrão.

## Exemplos

### Frontend

Uma tela solicita a notificação passando os quatro campos obrigatórios:

```js
notify({
  text: "Arquivo enviado",
  description: "O arquivo relatório.pdf foi salvo no repositório.",
  color: "success",
  icon: "check"
});
```

### Backend

O backend envia o mesmo objeto pelo canal de comunicação com o frontend. No
aplicativo Electron, essa comunicação é feita por IPC; o backend não importa nem
renderiza componentes React:

```js
{
  text: "Servidor indisponível",
  description: "Não foi possível abrir a porta configurada.",
  color: "error",
  icon: "error"
}
```

## Regras de uso

1. Frontend e backend devem respeitar o mesmo formato e os mesmos valores
   permitidos.
2. `text` deve ser curto; use `description` para explicar o que aconteceu ou
   qual ação o usuário pode tomar.
3. A categoria deve ser coerente: por exemplo, erro usa `color: "error"` e
   `icon: "error"`.
4. Mensagens são fornecidas por quem envia a notificação. O módulo não gera
   conteúdo a partir da categoria.
5. O módulo controla apenas apresentação, validação do contrato, fechamento,
   animação e som.

## Uso no frontend

As telas React obtêm a função `notify` do módulo compartilhado:

```jsx
import { useNotification } from "../components/NotificationGlobal/notification.jsx";

function MinhaTela() {
  const { notify } = useNotification();

  function salvar() {
    notify({
      text: "Arquivo enviado",
      description: "O arquivo foi salvo no repositório.",
      color: "success",
      icon: "check"
    });
  }

  return <button onClick={salvar}>Salvar</button>;
}
```

O hook deve ser usado dentro do `NotificationProvider`, já montado na raiz da
aplicação.

## Uso pelo backend

O backend Electron envia o mesmo objeto pelo canal IPC `server:notification`.
Por exemplo, o handler de inicialização envia uma notificação de erro quando o
servidor não consegue iniciar. O preload encaminha o evento e o módulo global
apresenta o conteúdo recebido.

```js
event.sender.send("server:notification", {
  text: "Não foi possível iniciar o servidor",
  description: error.message,
  color: "error",
  icon: "error"
});
```

O módulo valida os campos antes de exibir uma notificação. No frontend, dados
inválidos geram um erro; dados inválidos recebidos do backend são registrados no
console e não são exibidos.