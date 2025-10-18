
Principais funcionalidades do sistema:

Administração (Painel):

Criar, editar e excluir presentes disponíveis para compra.

Gerenciar imagens associadas aos presentes e lembranças.

Visualizar e confirmar convidados que comparecerão.

Ver quem comprou qual presente e gerenciar o status dos pagamentos.

Convidados:

Cada convidado possui nome, telefone (usado como agrupamento familiar) e classificação etária (adulto ou criança).

O telefone identifica uma família, ou seja, vários convidados podem ter o mesmo número.

No frontend, o usuário insere o número de telefone e o sistema lista todos os convidados com esse número, permitindo marcar quem irá comparecer.

Pagamentos:

Integração com gateway (ex: Stripe, Mercado Pago ou Yapay) para compras de presentes via cartão de crédito.

O administrador cria os produtos (presentes) que serão disponibilizados para compra.

Cada compra gera um registro associado ao convidado e ao presente.

Modelagem do banco de dados (simplificada):

guests — id, name, phone, age_category

gifts — id, name, description, price, image_id

images — id, url, gift_id

purchases — id, guest_id, gift_id, status, payment_id

admins — id, name, email, password_hash

Regra especial:

Na confirmação de presença, apenas convidados que aparecem na lista (baseados no telefone informado) podem ser confirmados.

Não é possível confirmar convidados que não estão cadastrados no sistema.