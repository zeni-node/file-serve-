# Padrão de arquitetura das rotas

As páginas em `src/routes/` representam as rotas da aplicação. Elas devem
compor a tela e organizar seus módulos, sem concentrar a implementação
detalhada de cada módulo.

## Referência: rota Início

A rota `Home.jsx` segue este fluxo:

1. `src/App.jsx` seleciona a rota e renderiza a página correspondente.
2. `src/routes/Home.jsx` importa os módulos da página e os organiza.
3. Cada módulo implementa sua própria interface, estado e interação.
4. Os estilos do layout da página e de cada módulo ficam separados.

Estrutura atual:

```text
src/
  routes/
    Home.jsx
  components/
    Home/
      Home.css
      On_Off/
        On_Off.jsx
        On_Off.css
      Files/
        Files.jsx
        Files.css
      ConnectedUsers/
        ConnectedUsers.jsx
        ConnectedUsers.css
```

## Responsabilidades

### Arquivo da rota

O arquivo em `src/routes/` deve:

- importar os módulos que pertencem à página;
- definir a composição e a ordem desses módulos;
- importar o CSS responsável pelo layout geral da página, quando necessário;
- manter a função da rota fácil de entender, sem lógica interna dos módulos.

Exemplo inspirado em `Home.jsx`:

```jsx
import ServerStatus from "../components/Home/ServerStatus/ServerStatus.jsx";
import ConnectedUsers from "../components/Home/ConnectedUsers/ConnectedUsers.jsx";
import "../components/Home/Home.css";

export default function Home() {
  return (
    <div className="home-modules">
      <ServerStatus />
      <ConnectedUsers />
    </div>
  );
}
```

Não coloque no arquivo da rota a implementação completa dos cartões, formulários,
listas ou controles que compõem a página.

### Pasta de componentes da rota

Cada rota deve ter uma pasta correspondente em `src/components/`. Nela ficam o
CSS de composição da página e os módulos exclusivos dessa rota:

```text
src/components/<Rota>/
  <Rota>.css
  <Modulo>/
    <Modulo>.jsx
    <Modulo>.css
```

Use um módulo para cada parte da tela que tenha uma responsabilidade própria,
por exemplo: status do servidor, seleção de pasta ou lista de usuários. O módulo
deve manter juntos:

- o JSX da sua interface;
- o estado e os efeitos relacionados àquela interface;
- as ações e interações oferecidas ao usuário;
- os estados de carregamento e de erro;
- seu arquivo CSS exclusivo.

O CSS `<Rota>.css` é para a disposição e o comportamento geral dos módulos na
página. O CSS `<Modulo>.css` é para a aparência interna do módulo. Evite colocar
estilos específicos de um módulo no CSS geral da rota.

### Componente da aplicação

`src/App.jsx` é responsável por associar o identificador da rota ao componente
de página e pela navegação global. A interface e a composição específicas de
cada página pertencem aos arquivos em `src/routes/`.

## Regras para novas páginas

1. Crie ou reutilize um componente em `src/routes/` para a página.
2. Crie a pasta da página em `src/components/<Rota>/`.
3. Separe a página em módulos com responsabilidades claras.
4. Importe e componha os módulos no arquivo da rota.
5. Mantenha os estilos do layout geral separados dos estilos de cada módulo.
6. Preserve os padrões de tratamento de carregamento, erros, acessibilidade e
   integração usados pelo restante do projeto.
7. Se um módulo precisar ser compartilhado por várias rotas, coloque-o em uma
   área compartilhada de componentes em vez de duplicar sua implementação.

## Exemplo de uma nova rota

```text
src/
  routes/
    Users.jsx
  components/
    Users/
      Users.css
      UserList/
        UserList.jsx
        UserList.css
      UserSummary/
        UserSummary.jsx
        UserSummary.css
```

`Users.jsx` deve importar `UserList` e `UserSummary` e cuidar apenas da
composição. Cada módulo deve cuidar da própria implementação.
