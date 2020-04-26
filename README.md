# closed-function-plugin

[![Coverage Status](https://coveralls.io/repos/github/FilipeBeck/closed-function-plugin/badge.svg?branch=master)](https://coveralls.io/github/FilipeBeck/closed-function-plugin?branch=master)

Plugin Webpack empacotador de funções fechadas, compilando-as como uma unidade independente. Útil para serializção e execução em contextos externos.

## Uso

As funções fechadas precisam ter um único bloco rotulado com `$closed`. A função não pode capturar nenhuma variável, com exceção das importações.

## Exemplo

```typescript
function someClosedFunction() {
  $closed: {
    // Do something...
  }
}
```
