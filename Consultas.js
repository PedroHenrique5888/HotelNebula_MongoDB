// Hotel Nebula — Parte 3: Radar de Comando
// Execução: mongosh --file 03_consultas.js   (após rodar 02_insercao.js)

use("hotel_nebula");

const titulo = t => print(`\n===== ${t} =====`);
const mostrar = cursor => cursor.forEach(doc => printjson(doc));

// =====================================================================
// 1. QUARTOS POR CARACTERÍSTICAS
// =====================================================================

titulo("1.1 Quartos com vista para o mar");
mostrar(db.quartos.find({ "caracteristicas.vista": "mar" },
  { numero: 1, tipo: 1, categoria: 1, preco_diaria: 1, _id: 0 }));

titulo("1.2 Quartos com banheira");
mostrar(db.quartos.find({ "caracteristicas.banheira": true },
  { numero: 1, tipo: 1, preco_diaria: 1, _id: 0 }));

titulo("1.3 Quartos de luxo com vista para o mar E banheira");
mostrar(db.quartos.find(
  { categoria: "luxo", "caracteristicas.vista": "mar", "caracteristicas.banheira": true },
  { numero: 1, tipo: 1, preco_diaria: 1, _id: 0 }));

titulo("1.4 Quartos que possuem TODAS as comodidades listadas ($all)");
mostrar(db.quartos.find({ comodidades: { $all: ["banheira", "cafeteira"] } },
  { numero: 1, comodidades: 1, _id: 0 }));

titulo("1.5 Quartos com hidromassagem (campo presente só em alguns documentos)");
mostrar(db.quartos.find({ "caracteristicas.hidromassagem": { $exists: true, $eq: true } },
  { numero: 1, descricao: 1, _id: 0 }));

titulo("1.6 Quartos de luxo disponíveis, do mais barato ao mais caro, com área > 50 m²");
mostrar(db.quartos.find(
  { categoria: "luxo", status: "disponivel", "caracteristicas.area_m2": { $gt: 50 } },
  { numero: 1, preco_diaria: 1, "caracteristicas.area_m2": 1, _id: 0 }).sort({ preco_diaria: 1 }));

// =====================================================================
// 2. HÓSPEDES COM MAIS DE UMA RESERVA
// =====================================================================

titulo("2.1 Hóspedes com mais de uma reserva (exclui canceladas)");
mostrar(db.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: {
      _id: "$hospede_id",
      qtd_reservas: { $sum: 1 },
      total_noites: { $sum: "$num_noites" },
      total_gasto_diarias: { $sum: "$valor_total" },
      ultima_reserva: { $max: "$data_checkin" } } },
  { $match: { qtd_reservas: { $gt: 1 } } },
  { $lookup: { from: "hospedes", localField: "_id", foreignField: "_id", as: "hospede" } },
  { $unwind: "$hospede" },
  { $project: { _id: 0, nome: "$hospede.nome", email: "$hospede.email",
                qtd_reservas: 1, total_noites: 1, total_gasto_diarias: 1, ultima_reserva: 1 } },
  { $sort: { qtd_reservas: -1, total_gasto_diarias: -1 } }
]));

// =====================================================================
// 3. FATURAMENTO
// =====================================================================

const faturamentoPeriodo = (inicio, fim) => db.pagamentos.aggregate([
  { $match: { status: "pago", data_pagamento: { $gte: inicio, $lt: fim } } },
  { $group: { _id: null, faturamento: { $sum: "$valor_total" }, qtd_pagamentos: { $sum: 1 },
              ticket_medio: { $avg: "$valor_total" } } },
  { $project: { _id: 0, faturamento: 1, qtd_pagamentos: 1, ticket_medio: { $round: ["$ticket_medio", 2] } } }
]);

titulo("3.1 Faturamento em abril de 2025");
mostrar(faturamentoPeriodo(new Date("2025-04-01T00:00:00Z"), new Date("2025-05-01T00:00:00Z")));

titulo("3.2 Faturamento anual de 2025");
mostrar(faturamentoPeriodo(new Date("2025-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z")));

titulo("3.3 Faturamento mês a mês em 2025");
mostrar(db.pagamentos.aggregate([
  { $match: { status: "pago", data_pagamento: { $gte: new Date("2025-01-01T00:00:00Z"), $lt: new Date("2026-01-01T00:00:00Z") } } },
  { $group: { _id: { $month: "$data_pagamento" }, faturamento: { $sum: "$valor_total" }, pagamentos: { $sum: 1 } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, mes: "$_id", faturamento: 1, pagamentos: 1 } }
]));

titulo("3.4 Faturamento por método de pagamento (usa o array de parcelas)");
mostrar(db.pagamentos.aggregate([
  { $match: { status: "pago" } },
  { $unwind: "$parcelas" },
  { $match: { "parcelas.status": "aprovado" } },
  { $group: { _id: "$parcelas.metodo", total: { $sum: "$parcelas.valor" }, transacoes: { $sum: 1 } } },
  { $sort: { total: -1 } }
]));

titulo("3.5 Diárias x serviços: composição da receita por mês de checkout");
mostrar(db.hospedagens.aggregate([
  { $match: { status: "encerrada" } },
  { $group: { _id: { $month: "$checkout_real" },
              diarias: { $sum: "$total_diarias" }, servicos: { $sum: "$total_servicos" }, total: { $sum: "$total_geral" } } },
  { $sort: { _id: 1 } }
]));

titulo("3.6 Receita por categoria de quarto");
mostrar(db.hospedagens.aggregate([
  { $lookup: { from: "quartos", localField: "quarto_id", foreignField: "_id", as: "q" } },
  { $unwind: "$q" },
  { $group: { _id: "$q.categoria", receita: { $sum: "$total_geral" }, hospedagens: { $sum: 1 } } },
  { $sort: { receita: -1 } }
]));

// =====================================================================
// 4. OCUPAÇÃO
// =====================================================================

titulo("4.1 Reservas por mês (check-in), excluindo canceladas");
mostrar(db.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: { $month: "$data_checkin" }, reservas: { $sum: 1 }, noites_vendidas: { $sum: "$num_noites" } } },
  { $sort: { reservas: -1 } },
  { $project: { _id: 0, mes: "$_id", reservas: 1, noites_vendidas: 1 } }
]));

titulo("4.2 Check-ins por dia da semana (1=domingo ... 7=sábado)");
mostrar(db.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: { $dayOfWeek: "$data_checkin" }, checkins: { $sum: 1 } } },
  { $sort: { checkins: -1 } },
  { $project: { _id: 0, dia_semana: "$_id", checkins: 1 } }
]));

titulo("4.3 Noites ocupadas por dia da semana (expande cada noite da estadia)");
mostrar(db.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $addFields: { noites: { $range: [0, "$num_noites"] } } },
  { $unwind: "$noites" },
  { $addFields: { data_noite: { $add: ["$data_checkin", { $multiply: ["$noites", 86400000] }] } } },
  { $group: { _id: { $dayOfWeek: "$data_noite" }, noites_ocupadas: { $sum: 1 } } },
  { $sort: { noites_ocupadas: -1 } },
  { $project: { _id: 0, dia_semana: "$_id", noites_ocupadas: 1 } }
]));

titulo("4.4 Quartos mais reservados");
mostrar(db.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: "$quarto_snapshot.numero", tipo: { $first: "$quarto_snapshot.tipo" }, reservas: { $sum: 1 } } },
  { $sort: { reservas: -1 } }
]));

titulo("4.5 Taxa de cancelamento por canal de venda");
mostrar(db.reservas.aggregate([
  { $group: { _id: "$canal", total: { $sum: 1 },
              canceladas: { $sum: { $cond: [{ $eq: ["$status", "cancelada"] }, 1, 0] } } } },
  { $project: { _id: 0, canal: "$_id", total: 1, canceladas: 1,
                taxa_cancelamento_pct: { $round: [{ $multiply: [{ $divide: ["$canceladas", "$total"] }, 100] }, 1] } } }
]));

// =====================================================================
// 5. EXTRAS DE GESTÃO
// =====================================================================

titulo("5.1 Serviços mais consumidos (unwind do array embutido)");
mostrar(db.hospedagens.aggregate([
  { $unwind: "$servicos_consumidos" },
  { $group: { _id: "$servicos_consumidos.nome", unidades: { $sum: "$servicos_consumidos.quantidade" },
              receita: { $sum: "$servicos_consumidos.total" } } },
  { $sort: { receita: -1 } }
]));

titulo("5.2 Nota média e quantidade de avaliações por quarto");
mostrar(db.feedbacks.aggregate([
  { $match: { visivel: true } },
  { $group: { _id: "$quarto_id", nota_media: { $avg: "$nota_geral" }, avaliacoes: { $sum: 1 } } },
  { $lookup: { from: "quartos", localField: "_id", foreignField: "_id", as: "q" } },
  { $unwind: "$q" },
  { $project: { _id: 0, quarto: "$q.numero", categoria: "$q.categoria",
                nota_media: { $round: ["$nota_media", 2] }, avaliacoes: 1 } },
  { $sort: { nota_media: -1 } }
]));

titulo("5.3 Avaliações ainda sem resposta do hotel");
mostrar(db.feedbacks.find({ resposta_hotel: { $exists: false } },
  { nota_geral: 1, comentario: 1, data_avaliacao: 1, _id: 0 }));
