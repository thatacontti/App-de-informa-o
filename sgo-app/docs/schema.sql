-- ============================================================
-- Sistema de Gestão Orçamentária e Controle de Prestação de Serviços
-- Modelo de banco de dados PostgreSQL (v1)
-- Convenções: snake_case, chaves UUID, soft delete via status,
-- rastreabilidade completa em log_alteracoes.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ORGANIZAÇÃO E ACESSO
-- ============================================================

CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj VARCHAR(18) UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE departamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidade_id UUID REFERENCES unidades(id),
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE perfis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,          -- administrador, financeiro, gestor_area,
                                        -- operacional, diretoria, auditoria
    descricao TEXT
);

CREATE TABLE permissoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT NOT NULL UNIQUE,        -- ex.: lancamento.criar, importacao.estornar
    descricao TEXT
);

CREATE TABLE perfil_permissoes (
    perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    permissao_id UUID NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
    PRIMARY KEY (perfil_id, permissao_id)
);

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil_id UUID NOT NULL REFERENCES perfis(id),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Centros de custo autorizados por usuário (gestor de área / operacional)
CREATE TABLE usuario_centros_custo (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    centro_custo_id UUID NOT NULL,      -- FK adicionada após criação da tabela
    PRIMARY KEY (usuario_id, centro_custo_id)
);

-- ============================================================
-- 2. CADASTROS MESTRES
-- ============================================================

CREATE TABLE centros_custo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id),
    departamento_id UUID REFERENCES departamentos(id),
    codigo VARCHAR(20) NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    area_responsavel TEXT,
    gestor_responsavel TEXT,
    email_responsavel TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, codigo)
);

ALTER TABLE usuario_centros_custo
    ADD CONSTRAINT fk_ucc_cc FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id) ON DELETE CASCADE;

CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE subcategorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (categoria_id, nome)
);

CREATE TABLE contas_contabeis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(30) NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    categoria_id UUID REFERENCES categorias(id),
    natureza VARCHAR(20),               -- despesa, investimento
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cpf_cnpj VARCHAR(18),
    contato TEXT,
    email TEXT,
    telefone VARCHAR(20),
    tipo_servico TEXT,
    condicao_pagamento TEXT,
    dados_bancarios JSONB,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fornecedores_cpf_cnpj ON fornecedores (cpf_cnpj);

CREATE TABLE projetos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    centro_custo_id UUID REFERENCES centros_custo(id),
    gestor_responsavel TEXT,
    data_inicio DATE,
    data_fim DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'planejamento',
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE acoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID REFERENCES projetos(id),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    objetivo TEXT,
    centro_custo_id UUID NOT NULL REFERENCES centros_custo(id),
    categoria_id UUID REFERENCES categorias(id),
    gestor_responsavel TEXT,
    fornecedor_principal_id UUID REFERENCES fornecedores(id),
    data_inicio DATE,
    data_fim DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'planejamento',
        -- planejamento, em_andamento, concluida, atrasada, cancelada
    prioridade VARCHAR(10) DEFAULT 'media',
    recorrencia VARCHAR(20),
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE acao_fases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    acao_id UUID NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,                 -- ex.: planejamento, criação, produção
    mes SMALLINT CHECK (mes BETWEEN 1 AND 12),
    exercicio SMALLINT NOT NULL,
    entregas_previstas TEXT,
    entregas_concluidas TEXT,
    status VARCHAR(30) DEFAULT 'prevista',
    ordem SMALLINT
);

-- ============================================================
-- 3. ORÇAMENTO (COM VERSIONAMENTO)
-- ============================================================

CREATE TABLE orcamento_versoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercicio SMALLINT NOT NULL,
    nome TEXT NOT NULL,                 -- inicial, revisao_1, forecast, aprovado, final
    descricao TEXT,
    situacao VARCHAR(20) NOT NULL DEFAULT 'rascunho',  -- rascunho, vigente, encerrada
    criado_por UUID REFERENCES usuarios(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (exercicio, nome)
);

CREATE TABLE orcamento_linhas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    versao_id UUID NOT NULL REFERENCES orcamento_versoes(id),
    exercicio SMALLINT NOT NULL,
    centro_custo_id UUID NOT NULL REFERENCES centros_custo(id),
    projeto_id UUID REFERENCES projetos(id),
    acao_id UUID REFERENCES acoes(id),
    categoria_id UUID NOT NULL REFERENCES categorias(id),
    subcategoria_id UUID REFERENCES subcategorias(id),
    conta_contabil_id UUID REFERENCES contas_contabeis(id),
    fornecedor_previsto_id UUID REFERENCES fornecedores(id),
    descricao TEXT NOT NULL,
    quantidade NUMERIC(12,2),
    valor_unitario NUMERIC(14,2),
    responsavel TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',       -- ativo, cancelado, substituido
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orc_linhas_versao ON orcamento_linhas (versao_id);
CREATE INDEX idx_orc_linhas_cc ON orcamento_linhas (centro_custo_id, exercicio);

-- Distribuição mensal: uma linha por mês evita colunas jan..dez fixas
CREATE TABLE orcamento_mensal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    linha_id UUID NOT NULL REFERENCES orcamento_linhas(id) ON DELETE CASCADE,
    mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor NUMERIC(14,2) NOT NULL DEFAULT 0,
    UNIQUE (linha_id, mes)
);

-- ============================================================
-- 4. LANÇAMENTOS E MOVIMENTO
-- ============================================================

CREATE TYPE tipo_valor AS ENUM ('orcado','revisado','aprovado','solicitado','comprometido','realizado');
CREATE TYPE status_lancamento AS ENUM ('ativo','cancelado','estornado','substituido');
CREATE TYPE origem_lancamento AS ENUM ('manual','importacao','integracao');

CREATE TABLE lotes_importacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome_arquivo TEXT NOT NULL,
    hash_arquivo VARCHAR(64),           -- SHA-256: impede reimportação silenciosa
    usuario_id UUID REFERENCES usuarios(id),
    total_linhas INT NOT NULL,
    total_validas INT NOT NULL,
    valor_total NUMERIC(14,2) NOT NULL,
    mapeamento JSONB,                   -- de/para das colunas
    estornado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lancamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercicio SMALLINT NOT NULL,
    mes_competencia SMALLINT NOT NULL CHECK (mes_competencia BETWEEN 1 AND 12),
    data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
    centro_custo_id UUID NOT NULL REFERENCES centros_custo(id),
    categoria_id UUID NOT NULL REFERENCES categorias(id),
    subcategoria_id UUID REFERENCES subcategorias(id),
    conta_contabil_id UUID REFERENCES contas_contabeis(id),
    projeto_id UUID REFERENCES projetos(id),
    acao_id UUID REFERENCES acoes(id),
    fornecedor_id UUID REFERENCES fornecedores(id),
    descricao TEXT NOT NULL,
    tipo tipo_valor NOT NULL,           -- um registro por tipo de valor
    valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
    numero_nota_fiscal VARCHAR(60),
    numero_contrato VARCHAR(60),
    numero_pedido VARCHAR(60),
    forma_pagamento VARCHAR(30),
    parcelas SMALLINT DEFAULT 1,
    vencimento DATE,
    data_pagamento DATE,
    responsavel TEXT,
    status status_lancamento NOT NULL DEFAULT 'ativo',
    origem origem_lancamento NOT NULL DEFAULT 'manual',
    lote_id UUID REFERENCES lotes_importacao(id),
    lancamento_origem_id UUID REFERENCES lancamentos(id),  -- ex.: realizado gerado de um comprometido
    observacoes TEXT,
    criado_por UUID REFERENCES usuarios(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lanc_cc_periodo ON lancamentos (centro_custo_id, exercicio, mes_competencia);
CREATE INDEX idx_lanc_acao ON lancamentos (acao_id);
CREATE INDEX idx_lanc_fornecedor ON lancamentos (fornecedor_id);
CREATE INDEX idx_lanc_nf ON lancamentos (numero_nota_fiscal) WHERE numero_nota_fiscal IS NOT NULL;

CREATE TABLE contratos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES fornecedores(id),
    numero VARCHAR(60) NOT NULL,
    objeto TEXT,
    valor_total NUMERIC(14,2),
    data_inicio DATE,
    data_fim DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'vigente',
    UNIQUE (fornecedor_id, numero)
);

CREATE TABLE anexos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidade VARCHAR(30) NOT NULL,      -- lancamento, fornecedor, acao, contrato
    entidade_id UUID NOT NULL,
    nome_arquivo TEXT NOT NULL,
    caminho TEXT NOT NULL,              -- storage externo (S3 ou equivalente)
    tamanho_bytes BIGINT,
    enviado_por UUID REFERENCES usuarios(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anexos_entidade ON anexos (entidade, entidade_id);

-- ============================================================
-- 5. FLUXO DE APROVAÇÃO
-- ============================================================

CREATE TABLE alcadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valor_de NUMERIC(14,2) NOT NULL,
    valor_ate NUMERIC(14,2),
    etapas JSONB NOT NULL               -- ex.: ["gestor"], ["gestor","financeiro","diretoria"]
);

CREATE TABLE aprovacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lancamento_id UUID NOT NULL REFERENCES lancamentos(id),
    etapa VARCHAR(30) NOT NULL,         -- gestor, financeiro, diretoria
    ordem SMALLINT NOT NULL,
    situacao VARCHAR(20) NOT NULL DEFAULT 'pendente',  -- pendente, aprovado, rejeitado
    aprovador_id UUID REFERENCES usuarios(id),
    parecer TEXT,
    motivo_rejeicao TEXT,
    decidido_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aprov_pendentes ON aprovacoes (situacao) WHERE situacao = 'pendente';

-- ============================================================
-- 6. ALERTAS, NOTIFICAÇÕES E RASTREABILIDADE
-- ============================================================

CREATE TABLE regras_alerta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL UNIQUE, -- ex.: consumo_atencao, consumo_risco, nf_duplicada
    descricao TEXT,
    parametros JSONB,                   -- ex.: {"percentual": 80}
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(50) NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comentarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidade VARCHAR(30) NOT NULL,
    entidade_id UUID NOT NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    texto TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE log_alteracoes (
    id BIGSERIAL PRIMARY KEY,
    entidade VARCHAR(30) NOT NULL,
    entidade_id UUID NOT NULL,
    usuario_id UUID REFERENCES usuarios(id),
    acao VARCHAR(20) NOT NULL,          -- criacao, edicao, cancelamento, estorno
    campo TEXT,
    valor_anterior TEXT,
    valor_novo TEXT,
    motivo TEXT,
    origem VARCHAR(30),
    endereco_ip INET,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_entidade ON log_alteracoes (entidade, entidade_id);

-- ============================================================
-- 7. VISÃO CONSOLIDADA (BASE DOS DASHBOARDS)
-- ============================================================

CREATE OR REPLACE VIEW vw_consolidado_mensal AS
SELECT
    cc.id AS centro_custo_id,
    cc.nome AS centro_custo,
    x.exercicio,
    x.mes,
    SUM(x.orcado) AS orcado,
    SUM(x.comprometido) AS comprometido,
    SUM(x.realizado) AS realizado,
    SUM(x.orcado) - SUM(x.comprometido) - SUM(x.realizado) AS saldo,
    CASE WHEN SUM(x.orcado) > 0
         THEN ROUND((SUM(x.comprometido) + SUM(x.realizado)) / SUM(x.orcado) * 100, 1)
         ELSE NULL END AS percentual_consumo
FROM (
    SELECT ol.centro_custo_id, ol.exercicio, om.mes,
           om.valor AS orcado, 0::numeric AS comprometido, 0::numeric AS realizado
    FROM orcamento_linhas ol
    JOIN orcamento_mensal om ON om.linha_id = ol.id
    JOIN orcamento_versoes ov ON ov.id = ol.versao_id AND ov.situacao = 'vigente'
    WHERE ol.status = 'ativo'
    UNION ALL
    SELECT l.centro_custo_id, l.exercicio, l.mes_competencia,
           0,
           CASE WHEN l.tipo = 'comprometido' THEN l.valor ELSE 0 END,
           CASE WHEN l.tipo = 'realizado' THEN l.valor ELSE 0 END
    FROM lancamentos l
    WHERE l.status = 'ativo'
) x
JOIN centros_custo cc ON cc.id = x.centro_custo_id
GROUP BY cc.id, cc.nome, x.exercicio, x.mes;
