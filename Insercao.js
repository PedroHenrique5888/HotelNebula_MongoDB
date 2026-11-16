// Hotel Nebula — Parte 2: Montagem do Núcleo
// Execução: mongosh --file 02_insercao.js
// Cria o banco, valida o formato mínimo e insere documentos coerentes entre si.

use("hotel_nebula");

// ---------- Limpeza e criação das coleções ----------
["hospedes","quartos","reservas","hospedagens","pagamentos","funcionarios","servicos","feedbacks"]
  .forEach(c => db.getCollection(c).drop());

// Validação mínima (consistência sem engessar campos variáveis)
db.createCollection("hospedes", { validator: { $jsonSchema: {
  bsonType: "object", required: ["nome","cpf","email","ativo"],
  properties: { nome:{bsonType:"string"}, cpf:{bsonType:"string"}, email:{bsonType:"string"}, ativo:{bsonType:"bool"} } } } });
db.createCollection("quartos", { validator: { $jsonSchema: {
  bsonType: "object", required: ["numero","tipo","categoria","preco_diaria","status"],
  properties: { preco_diaria:{bsonType:["double","int","decimal"], minimum:0},
                status:{enum:["disponivel","ocupado","manutencao","limpeza"]},
                comodidades:{bsonType:"array", items:{bsonType:"string"}} } } } });
db.createCollection("reservas", { validator: { $jsonSchema: {
  bsonType: "object", required: ["hospede_id","quarto_id","data_checkin","data_checkout","status"],
  properties: { status:{enum:["confirmada","cancelada","concluida","no_show"]},
                data_checkin:{bsonType:"date"}, data_checkout:{bsonType:"date"} } } } });
["hospedagens","pagamentos","funcionarios","servicos","feedbacks"].forEach(c => db.createCollection(c));

// ---------- Auxiliares ----------
const d = s => new Date(s + "T00:00:00Z");
const DIA = 86400000, HORA = 3600000;
const soma = (arr, f) => arr.reduce((t, x) => t + f(x), 0);

// ---------- Funcionários ----------
const F = [
  { _id: new ObjectId(), nome:"Juliana Martins", cpf:"987.654.321-11", email:"juliana.martins@hotelnebula.com",
    telefone:"+55 21 99123-4567", cargo:"recepcionista", departamento:"recepção",
    turno:{tipo:"manha", entrada:"07:00", saida:"15:00"},
    permissoes:["checkin","checkout","reservas_visualizar","reservas_editar"], data_admissao:d("2022-08-01"), salario:3200.00, ativo:true },
  { _id: new ObjectId(), nome:"Rafael Souza", cpf:"111.222.333-44", email:"rafael.souza@hotelnebula.com",
    telefone:"+55 11 97777-1111", cargo:"recepcionista", departamento:"recepção",
    turno:{tipo:"tarde", entrada:"15:00", saida:"23:00"},
    permissoes:["checkin","checkout","reservas_visualizar"], data_admissao:d("2023-02-15"), salario:3100.00, ativo:true },
  { _id: new ObjectId(), nome:"Patrícia Lima", cpf:"555.666.777-88", email:"patricia.lima@hotelnebula.com",
    telefone:"+55 11 96666-2222", cargo:"gerente", departamento:"administração",
    turno:{tipo:"comercial", entrada:"09:00", saida:"18:00"},
    permissoes:["checkin","checkout","reservas_visualizar","reservas_editar","relatorios","feedbacks_responder"],
    data_admissao:d("2019-05-10"), salario:9500.00, ativo:true }
];
db.funcionarios.insertMany(F);

// ---------- Serviços ----------
const S = [
  { _id:new ObjectId(), nome:"Café da manhã", categoria:"alimentacao", descricao:"Café da manhã completo no restaurante do hotel.",
    preco:45.00, unidade:"pessoa", disponivel:true, horario_disponivel:{inicio:"06:30", fim:"10:30"}, tags:["incluso_suite","buffet","opcao_vegana"] },
  { _id:new ObjectId(), nome:"Lavanderia", categoria:"conveniencia", descricao:"Lavagem e passadoria, entrega em 24h.",
    preco:80.00, unidade:"pacote", disponivel:true, horario_disponivel:{inicio:"08:00", fim:"17:00"}, tags:["24h"] },
  { _id:new ObjectId(), nome:"Minibar", categoria:"alimentacao", descricao:"Itens do frigobar do quarto.",
    preco:25.00, unidade:"item", disponivel:true, tags:["bebidas","snacks"] },
  { _id:new ObjectId(), nome:"Spa - Massagem relaxante", categoria:"bem_estar", descricao:"Sessão de 50 minutos.",
    preco:220.00, unidade:"sessao", disponivel:true, horario_disponivel:{inicio:"10:00", fim:"20:00"}, tags:["agendamento","spa"], duracao_min:50 },
  { _id:new ObjectId(), nome:"Transfer aeroporto", categoria:"transporte", descricao:"Traslado privativo até o aeroporto.",
    preco:180.00, unidade:"viagem", disponivel:true, tags:["agendamento"] }
];
db.servicos.insertMany(S);
const [cafe, lavanderia, minibar, spa, transfer] = S;

// ---------- Hóspedes (preferências com formatos variáveis) ----------
const H = [
  { _id:new ObjectId(), nome:"Carlos Andrade", cpf:"123.456.789-00", email:"carlos.andrade@email.com", telefone:"+55 11 98765-4321",
    data_nascimento:d("1985-03-22"), nacionalidade:"Brasileiro",
    endereco:{logradouro:"Rua das Palmeiras, 142", cidade:"São Paulo", estado:"SP", cep:"01310-100", pais:"Brasil"},
    preferencias:{tipo_quarto:"suite", andar_alto:true, fumante:false, cama:"king"}, data_cadastro:d("2024-01-15"), ativo:true },
  { _id:new ObjectId(), nome:"Mariana Costa", cpf:"234.567.890-11", email:"mariana.costa@email.com", telefone:"+55 21 98888-1212",
    data_nascimento:d("1990-07-09"), nacionalidade:"Brasileira",
    endereco:{logradouro:"Av. Atlântica, 900", cidade:"Rio de Janeiro", estado:"RJ", cep:"22010-000", pais:"Brasil"},
    preferencias:{tipo_quarto:"luxo", vista:"mar", cama:"queen", alergias_travesseiro:true}, data_cadastro:d("2024-03-02"), ativo:true },
  { _id:new ObjectId(), nome:"João Pereira", cpf:"345.678.901-22", email:"joao.pereira@email.com", telefone:"+55 31 97777-3434",
    data_nascimento:d("1978-11-30"), nacionalidade:"Brasileiro",
    endereco:{logradouro:"Rua da Bahia, 1200", cidade:"Belo Horizonte", estado:"MG", cep:"30160-011", pais:"Brasil"},
    preferencias:{fumante:false}, data_cadastro:d("2024-06-20"), ativo:true },
  { _id:new ObjectId(), nome:"Fernanda Oliveira", cpf:"456.789.012-33", email:"fernanda.oliveira@email.com", telefone:"+55 41 96666-5656",
    data_nascimento:d("1993-01-14"), nacionalidade:"Brasileira",
    endereco:{logradouro:"Rua XV de Novembro, 55", cidade:"Curitiba", estado:"PR", cep:"80020-310", pais:"Brasil"},
    preferencias:{tipo_quarto:"luxo", andar_alto:true, pet:true, cama:"king"}, data_cadastro:d("2024-09-11"), ativo:true },
  { _id:new ObjectId(), nome:"Lucas Fernandez", cpf:"567.890.123-44", email:"lucas.fernandez@email.com", telefone:"+54 11 5555-7878",
    data_nascimento:d("1988-05-05"), nacionalidade:"Argentino",
    endereco:{logradouro:"Calle Florida 300", cidade:"Buenos Aires", estado:"CABA", cep:"C1005", pais:"Argentina"},
    preferencias:{tipo_quarto:"standard"}, data_cadastro:d("2025-01-05"), ativo:true }
];
db.hospedes.insertMany(H);
const [carlos, mariana, joao, fernanda, lucas] = H;

// ---------- Quartos (características variam por categoria) ----------
const Q = [
  { _id:new ObjectId(), numero:"101", andar:1, tipo:"standard", categoria:"economico", capacidade_max:2, preco_diaria:250.00,
    descricao:"Quarto padrão com vista para o jardim interno.", comodidades:["ar-condicionado","tv 42\"","frigobar","wifi","cofre"],
    caracteristicas:{vista:"jardim", banheira:false, varanda:false, area_m2:28}, status:"disponivel",
    fotos:["https://storage.hotelnebula.com/quartos/101/foto1.jpg"], ultima_limpeza:new Date("2025-03-31T08:00:00Z") },
  { _id:new ObjectId(), numero:"102", andar:1, tipo:"standard", categoria:"economico", capacidade_max:3, preco_diaria:260.00,
    descricao:"Quarto padrão com cama extra.", comodidades:["ar-condicionado","tv 42\"","frigobar","wifi"],
    caracteristicas:{vista:"estacionamento", banheira:false, varanda:false, area_m2:30}, status:"disponivel", fotos:[],
    ultima_limpeza:new Date("2025-03-31T09:00:00Z") },
  { _id:new ObjectId(), numero:"201", andar:2, tipo:"superior", categoria:"conforto", capacidade_max:2, preco_diaria:380.00,
    descricao:"Quarto superior com varanda e vista lateral para o mar.", comodidades:["ar-condicionado","tv 50\"","frigobar","wifi","cofre","cafeteira"],
    caracteristicas:{vista:"mar", banheira:false, varanda:true, area_m2:35}, status:"disponivel", fotos:[],
    ultima_limpeza:new Date("2025-03-31T10:00:00Z") },
  { _id:new ObjectId(), numero:"301", andar:3, tipo:"suite", categoria:"luxo", capacidade_max:3, preco_diaria:650.00,
    descricao:"Suíte de luxo com vista frontal para o mar e banheira.", comodidades:["ar-condicionado","tv 55\"","frigobar","wifi","cofre","cafeteira","banheira","roupao"],
    caracteristicas:{vista:"mar", banheira:true, varanda:true, area_m2:52}, status:"disponivel", fotos:[],
    ultima_limpeza:new Date("2025-03-31T11:00:00Z") },
  { _id:new ObjectId(), numero:"302", andar:3, tipo:"suite", categoria:"luxo", capacidade_max:4, preco_diaria:720.00,
    descricao:"Suíte família de luxo com sala de estar e banheira.", comodidades:["ar-condicionado","tv 55\"","frigobar","wifi","cofre","banheira","sala-estar"],
    caracteristicas:{vista:"piscina", banheira:true, varanda:true, area_m2:60}, status:"manutencao", fotos:[],
    ultima_limpeza:new Date("2025-03-29T11:00:00Z") },
  { _id:new ObjectId(), numero:"401", andar:4, tipo:"cobertura", categoria:"luxo", capacidade_max:4, preco_diaria:1500.00,
    descricao:"Cobertura presidencial com terraço privativo e hidromassagem.", comodidades:["ar-condicionado","tv 65\"","frigobar","wifi","cofre","hidromassagem","banheira","mordomo"],
    caracteristicas:{vista:"mar", banheira:true, varanda:true, area_m2:120, hidromassagem:true, terraco_privativo:true}, status:"disponivel", fotos:[],
    ultima_limpeza:new Date("2025-03-31T12:00:00Z") }
];
db.quartos.insertMany(Q);
const [q101, q102, q201, q301, q302, q401] = Q;

// ---------- Reservas (com snapshot de hóspede e quarto) ----------
const R = [];
function reserva(n, h, q, ci, co, nh, status, canal, obs) {
  const cin = d(ci), cout = d(co), noites = Math.round((cout - cin) / DIA);
  const doc = {
    _id:new ObjectId(), hospede_id:h._id,
    hospede_snapshot:{nome:h.nome, email:h.email, telefone:h.telefone},
    quarto_id:q._id, quarto_snapshot:{numero:q.numero, tipo:q.tipo, preco_diaria:q.preco_diaria},
    data_checkin:cin, data_checkout:cout, num_noites:noites, num_hospedes:nh, valor_total:noites * q.preco_diaria,
    status, canal, codigo_reserva:`HN-2025-${String(n).padStart(5,"0")}`,
    data_criacao:new Date(cin - 20 * DIA), data_atualizacao:new Date(cin - 20 * DIA)
  };
  if (obs) doc.observacoes = obs;
  R.push(doc); return doc;
}
const r1 = reserva(1, carlos,   q101, "2025-01-10", "2025-01-13", 2, "concluida", "site_proprio");
const r2 = reserva(2, mariana,  q201, "2025-02-14", "2025-02-17", 2, "concluida", "booking");
const r3 = reserva(3, fernanda, q301, "2025-03-07", "2025-03-10", 2, "concluida", "site_proprio", "Viaja com cachorro de pequeno porte.");
const r4 = reserva(4, carlos,   q102, "2025-04-10", "2025-04-14", 3, "concluida", "site_proprio", "Solicita berço para bebê.");
const r5 = reserva(5, mariana,  q301, "2025-04-18", "2025-04-21", 2, "concluida", "telefone");
const r6 = reserva(6, joao,     q401, "2025-04-25", "2025-04-28", 2, "concluida", "agencia");
const r7 = reserva(7, fernanda, q301, "2025-05-02", "2025-05-05", 2, "concluida", "site_proprio");
const r8 = reserva(8, lucas,    q101, "2025-06-20", "2025-06-23", 1, "cancelada", "booking", "Cancelado pelo hóspede, sem multa.");
const r9 = reserva(9, lucas,    q201, "2025-07-04", "2025-07-06", 2, "confirmada", "site_proprio");
db.reservas.insertMany(R);

// ---------- Hospedagens (serviços consumidos embutidos) ----------
const HP = [];
function hospedagem(res, fIn, fOut, itens, obs) {
  const servicos = itens.map(([s, qtd, dia]) => ({
    servico_id:s._id, nome:s.nome, quantidade:qtd, preco_unitario:s.preco, total:qtd * s.preco,
    data:new Date(res.data_checkin.getTime() + dia * DIA + 9 * HORA)
  }));
  const totalServ = soma(servicos, s => s.total);
  const doc = {
    _id:new ObjectId(), reserva_id:res._id, hospede_id:res.hospede_id, quarto_id:res.quarto_id,
    checkin_real:new Date(res.data_checkin.getTime() + 14 * HORA + 35 * 60000),
    checkout_real:new Date(res.data_checkout.getTime() + 11 * HORA + 10 * 60000),
    status:"encerrada", funcionario_checkin_id:fIn._id, funcionario_checkout_id:fOut._id,
    servicos_consumidos:servicos, total_servicos:totalServ, total_diarias:res.valor_total,
    total_geral:res.valor_total + totalServ
  };
  if (obs) doc.observacoes = obs;
  HP.push(doc); return doc;
}
const [fJu, fRa, fPa] = F;
const hp1 = hospedagem(r1, fJu, fJu, [[cafe, 4, 1], [minibar, 2, 2]]);
const hp2 = hospedagem(r2, fRa, fJu, [[cafe, 4, 1], [spa, 2, 2]]);
const hp3 = hospedagem(r3, fJu, fRa, [[cafe, 4, 1], [lavanderia, 1, 1]]);
const hp4 = hospedagem(r4, fJu, fRa, [[cafe, 2, 1], [lavanderia, 1, 2], [minibar, 3, 3]], "Hóspede solicitou late checkout, atendido.");
const hp5 = hospedagem(r5, fRa, fRa, [[cafe, 6, 1], [spa, 2, 1], [minibar, 4, 2]]);
const hp6 = hospedagem(r6, fJu, fPa, [[cafe, 4, 1], [transfer, 1, 3], [spa, 2, 2]]);
const hp7 = hospedagem(r7, fRa, fJu, [[cafe, 4, 1]]);
db.hospedagens.insertMany(HP);

// ---------- Pagamentos (parcelas em array, com métodos diferentes) ----------
const PG = [];
function pagamento(hp, parcelas) {
  PG.push({
    _id:new ObjectId(), hospedagem_id:hp._id, reserva_id:hp.reserva_id, hospede_id:hp.hospede_id,
    valor_total:hp.total_geral, status:"pago", data_pagamento:new Date(hp.checkout_real.getTime() - 5 * 60000),
    parcelas, nota_fiscal:`NF-e ${String(PG.length + 421).padStart(6,"0")}`,
    data_criacao:new Date(hp.checkout_real.getTime() - 5 * 60000)
  });
}
const cartao = (v, n, b) => ({metodo:"cartao_credito", bandeira:b, valor:v, num_parcelas:n, status:"aprovado", transacao_id:`TXN-${b.toUpperCase()}-${Math.floor(Math.random()*90000+10000)}`});
const pix = v => ({metodo:"pix", valor:v, status:"aprovado", transacao_id:`TXN-PIX-${Math.floor(Math.random()*90000+10000)}`});
pagamento(hp1, [pix(hp1.total_geral)]);
pagamento(hp2, [cartao(hp2.total_geral, 3, "Mastercard")]);
pagamento(hp3, [cartao(hp3.total_geral, 1, "Visa")]);
pagamento(hp4, [cartao(hp4.total_diarias, 1, "Visa"), pix(hp4.total_servicos)]);
pagamento(hp5, [cartao(hp5.total_geral, 6, "Mastercard")]);
pagamento(hp6, [cartao(hp6.total_geral, 2, "Amex")]);
pagamento(hp7, [pix(hp7.total_geral)]);
db.pagamentos.insertMany(PG);

// ---------- Feedbacks (coleção própria; resposta do hotel é opcional) ----------
db.feedbacks.insertMany([
  { hospede_id:carlos._id, hospedagem_id:hp4._id, quarto_id:q102._id, data_avaliacao:d("2025-04-15"), nota_geral:4.5,
    notas_detalhadas:{limpeza:5, atendimento:5, conforto:4, custo_beneficio:4, localizacao:5},
    comentario:"Ótima estadia! A equipe foi muito atenciosa e o quarto estava impecável. O café da manhã é excelente.",
    resposta_hotel:{texto:"Obrigado pelo feedback, Carlos! Esperamos recebê-lo novamente.", data:d("2025-04-16"), funcionario_id:fPa._id}, visivel:true },
  { hospede_id:mariana._id, hospedagem_id:hp2._id, quarto_id:q201._id, data_avaliacao:d("2025-02-18"), nota_geral:4.0,
    notas_detalhadas:{limpeza:5, atendimento:4, conforto:4, custo_beneficio:3, localizacao:5},
    comentario:"Vista linda do mar, mas o frigobar estava com poucos itens.", visivel:true },
  { hospede_id:fernanda._id, hospedagem_id:hp3._id, quarto_id:q301._id, data_avaliacao:d("2025-03-11"), nota_geral:5.0,
    notas_detalhadas:{limpeza:5, atendimento:5, conforto:5, custo_beneficio:5, localizacao:5},
    comentario:"Suíte perfeita, banheira maravilhosa e hotel pet friendly.", tags:["pet_friendly"], visivel:true },
  { hospede_id:mariana._id, hospedagem_id:hp5._id, quarto_id:q301._id, data_avaliacao:d("2025-04-22"), nota_geral:4.8,
    notas_detalhadas:{limpeza:5, atendimento:5, conforto:5, custo_beneficio:4, localizacao:5},
    comentario:"Voltei e foi ainda melhor. O spa merece destaque.",
    resposta_hotel:{texto:"Que bom ter você de volta, Mariana!", data:d("2025-04-23"), funcionario_id:fPa._id}, visivel:true },
  { hospede_id:joao._id, hospedagem_id:hp6._id, quarto_id:q401._id, data_avaliacao:d("2025-04-29"), nota_geral:3.5,
    notas_detalhadas:{limpeza:4, atendimento:3, conforto:5, custo_beneficio:2, localizacao:4},
    comentario:"Cobertura incrível, porém o preço é alto e o transfer atrasou.", visivel:true }
]);

// ---------- Índices de apoio às consultas ----------
db.quartos.createIndex({ "caracteristicas.vista": 1, categoria: 1 });
db.quartos.createIndex({ comodidades: 1 });
db.reservas.createIndex({ hospede_id: 1, data_checkin: -1 });
db.reservas.createIndex({ data_checkin: 1, status: 1 });
db.hospedagens.createIndex({ reserva_id: 1 }, { unique: true });
db.pagamentos.createIndex({ data_pagamento: 1, status: 1 });
db.feedbacks.createIndex({ quarto_id: 1, data_avaliacao: -1 });
db.hospedes.createIndex({ cpf: 1 }, { unique: true });

print("Inserção concluída:");
["hospedes","quartos","reservas","hospedagens","pagamentos","funcionarios","servicos","feedbacks"]
  .forEach(c => print(`  ${c}: ${db.getCollection(c).countDocuments()}`));
