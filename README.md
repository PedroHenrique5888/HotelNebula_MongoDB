# Hotel Nebula — Banco de Dados MongoDB

Projeto de modelagem, implementação e consulta de um banco não relacional para a rede Hotel Nebula, preparado para uma futura API de gestão hoteleira.

## Estrutura do repositório

```
hotel-nebula/
├── README.md                  # Parte 1: modelagem, justificativas e arquitetura
├── docs/esquema-colecoes.md   # Esquema das 8 coleções com exemplos JSON
├── 02_insercao.js             # Parte 2: criação das coleções + dados de exemplo
└── 03_consultas.js            # Parte 3: consultas de gestão
```

## Como executar

```bash
mongosh --file 02_insercao.js   # cria o banco hotel_nebula e popula
mongosh --file 03_consultas.js  # executa as consultas
```

---

## Parte 1 — Origem do Sistema

### Núcleos de informação

| Núcleo | Coleção | Papel |
|---|---|---|
| Pessoas atendidas | `hospedes` | Cadastro do cliente |
| Inventário | `quartos` | Características, preço e status |
| Intenção de estadia | `reservas` | Compromisso futuro (pode ser cancelado) |
| Estadia real | `hospedagens` | Check-in/out efetivo e consumo |
| Financeiro | `pagamentos` | Quitação, métodos e parcelas |
| Operação | `funcionarios` | Equipe, turnos e permissões |
| Catálogo | `servicos` | Serviços e preços vigentes |
| Qualidade | `feedbacks` | Avaliações e respostas do hotel |

### Proposta de modelagem

Regra geral: **embutir** o que nasce, vive e é lido junto com o documento pai; **referenciar** o que tem ciclo de vida próprio, é compartilhado ou cresce sem limite.

| Coleção | Referencia | Embute |
|---|---|---|
| `hospedes` | — | endereço, preferências |
| `quartos` | — | comodidades (array), características, fotos |
| `reservas` | hospede, quarto | snapshot do hóspede e do quarto |
| `hospedagens` | reserva, hospede, quarto, funcionários | array de serviços consumidos |
| `pagamentos` | hospedagem, reserva, hospede | array de parcelas |
| `feedbacks` | hospede, hospedagem, quarto | notas detalhadas, resposta do hotel |
| `funcionarios` | — | turno, permissões |
| `servicos` | — | horário disponível, tags |

### Respostas às questões importantes

**1. A reserva guarda dados do hóspede embutidos ou referenciados?** Os dois. Guarda `hospede_id` (referência, para navegar até o cadastro atual) e um `hospede_snapshot` com nome, e-mail e telefone. Se o hóspede mudar de telefone depois, a reserva continua mostrando o que foi usado na época, e listagens de reservas não precisam de `$lookup`. O mesmo vale para `quarto_snapshot`, que congela o preço da diária contratado.

**2. Avaliações ficam no quarto ou em coleção própria?** Em coleção própria. Um quarto acumula avaliações sem limite (risco de documento grande e reescritas constantes), e o gerente quer filtrar por nota, período e hóspede e calcular médias sem carregar o quarto inteiro. Cada feedback referencia hóspede, hospedagem e quarto.

**3. Serviços consumidos ficam dentro da hospedagem?** Sim, como array embutido. Eles compõem a conta daquela estadia, são sempre lidos com ela e têm tamanho limitado. Cada item guarda `nome` e `preco_unitario` copiados do catálogo, então reajustes futuros em `servicos` não alteram contas antigas.

**4. Como representar histórico sem perder flexibilidade?**
- Snapshots em reservas (preço e dados de contato da época).
- Preço copiado em cada serviço consumido.
- Separar `reservas` (intenção, com status `confirmada`/`cancelada`/`concluida`/`no_show`) de `hospedagens` (fato ocorrido): o histórico de cancelamentos fica preservado.
- Registros nunca são apagados; usa-se `status`, `ativo` e `visivel`.
- Campos opcionais variam por documento (ex.: `hidromassagem` só na cobertura, `pet` só em alguns hóspedes) sem migração de esquema.

### Justificativa resumida

- **Leitura primeiro:** as telas de recepção e gestão leem reserva + hóspede + quarto juntos; o snapshot evita junções.
- **Crescimento controlado:** arrays embutidos só onde o tamanho é naturalmente pequeno (serviços de uma estadia, parcelas de um pagamento). Coleções que crescem sem limite (`feedbacks`, `reservas`) são independentes.
- **Flexibilidade:** quartos de categorias diferentes têm características diferentes (ex.: cobertura com terraço privativo) sem colunas vazias.
- **Integridade mínima:** `$jsonSchema` valida campos essenciais e índices únicos protegem CPF e a relação reserva→hospedagem.

Exemplos JSON completos de cada coleção estão em [`docs/esquema-colecoes.md`](docs/esquema-colecoes.md).

---

## Parte 2 — Montagem do Núcleo

`02_insercao.js` cria as 8 coleções (com validação `$jsonSchema` nas principais) e insere:

- 3 funcionários, 5 serviços, 5 hóspedes, 6 quartos
- 9 reservas (7 concluídas, 1 cancelada, 1 futura confirmada)
- 7 hospedagens com serviços embutidos, e 7 pagamentos (alguns com mais de um método)
- 5 feedbacks, com e sem resposta do hotel

Os totais são calculados no script (noites × diária, soma de serviços), então os valores ficam consistentes entre reservas, hospedagens e pagamentos.

### Arquitetura adotada

- **Datas como `Date` (ISODate)**, não string, para permitir filtros por período e operadores como `$month` e `$dayOfWeek`.
- **Subdocumentos** para dados agrupados por significado (`endereco`, `caracteristicas`, `turno`).
- **Arrays** para listas pequenas e pesquisáveis (`comodidades`, `servicos_consumidos`, `parcelas`, `permissoes`, `tags`).
- **Formatos variáveis de propósito:** preferências diferentes por hóspede, características extras por quarto, `resposta_hotel` opcional, `duracao_min` só em serviços de spa.
- **Índices** pensados para as consultas da Parte 3 (vista/categoria, comodidades, hóspede+data, data de pagamento).
- **Escalabilidade:** `reservas`, `hospedagens`, `pagamentos` e `feedbacks` crescem com o tempo e podem ser particionadas (sharding) por data ou por hóspede no futuro, já que são coleções independentes.

---

## Parte 3 — Radar de Comando

`03_consultas.js` responde às perguntas pedidas e traz extras:

| Pergunta | Consulta |
|---|---|
| Quartos com vista para o mar / banheira / luxo | 1.1 a 1.6 (`find` com filtros em subdocumentos e `$all` em arrays) |
| Hóspedes com mais de uma reserva | 2.1 (`$group` + `$match` + `$lookup`) |
| Faturamento em abril, no ano, por mês | 3.1 a 3.3 |
| Faturamento por método, composição diárias × serviços, por categoria | 3.4 a 3.6 |
| Meses com mais reservas | 4.1 |
| Dias da semana mais movimentados (check-ins e noites ocupadas) | 4.2 e 4.3 |
| Quartos mais reservados, cancelamento por canal | 4.4 e 4.5 |
| Serviços mais consumidos, nota média por quarto, feedbacks sem resposta | 5.1 a 5.3 |

Observações:
- Reservas `cancelada` são excluídas das métricas de ocupação.
- Faturamento considera pagamentos com `status: "pago"` pela `data_pagamento`.
- `$dayOfWeek` retorna 1 = domingo até 7 = sábado, em UTC. Para fuso de São Paulo, use `{ $dayOfWeek: { date: "$campo", timezone: "America/Sao_Paulo" } }`.
