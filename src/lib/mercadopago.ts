import { MercadoPagoConfig, Preference } from 'mercadopago';
import { env } from '../config/env';

interface CreatePaymentParams {
  giftId: number;
  giftName: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  buyerTaxId: string;
  guestId?: number;
  binaryMode?: boolean;
  address?: {
    street?: string;
    number?: string;
    zipCode?: string;
    city?: string;
    state?: string;
  };
}

interface PaymentResponse {
  preferenceId: string;
  checkoutUrl: string;
}

class MercadoPagoClient {
  private client: MercadoPagoConfig;
  private preference: Preference;

  constructor() {
    const accessToken = env.MERCADOPAGO_ACCESS_TOKEN;

    this.client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 5000,
        idempotencyKey: 'wedding-api',
      },
    });

    this.preference = new Preference(this.client);
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const nameParts = fullName
      .trim()
      .split(' ')
      .filter((part) => part.length > 0);
    if (nameParts.length === 0) {
      return { firstName: 'Cliente', lastName: 'Convidado' };
    }
    if (nameParts.length === 1) {
      return { firstName: nameParts[0] as string, lastName: nameParts[0] as string };
    }
    const firstName = nameParts[0] as string;
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      const baseUrl = env.MERCADOPAGO_URL_WEBHOOK;
      const purchaseId = `${params.giftId}-${Date.now()}`;

      const successUrl =
        env.MERCADOPAGO_SUCCESS_URL?.trim() || `http://localhost:8080/payment/success`;
      const failureUrl =
        env.MERCADOPAGO_FAILURE_URL?.trim() || `http://localhost:8080//payment/failure`;
      const pendingUrl =
        env.MERCADOPAGO_PENDING_URL?.trim() || `$http://localhost:8080//payment/pending`;

      if (!successUrl || !failureUrl || !pendingUrl) {
        throw new Error('URLs de retorno não configuradas');
      }

      const cleanedTaxId = params.buyerTaxId.replace(/\D/g, '');
      const { firstName, lastName } = this.splitName(params.buyerName);

      const preferenceData: any = {
        items: [
          {
            id: `gift-${params.giftId}`,
            title: `Presente de casamento: ${params.giftName}`,
            description: `Pagamento do presente: ${params.giftName}`,
            quantity: 1,
            unit_price: params.amount,
            currency_id: 'BRL' as const,
            category_id: 'others',
          },
        ],
        payer: {
          name: params.buyerName,
          first_name: firstName,
          last_name: lastName,
          email: params.buyerEmail,
          phone: params.buyerPhone
            ? {
                number: params.buyerPhone,
              }
            : undefined,
          identification: {
            type: 'CPF',
            number: cleanedTaxId,
          },
          address: params.address
            ? {
                street_name: params.address.street,
                street_number: params.address.number,
                zip_code: params.address.zipCode,
              }
            : undefined,
        },
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' },
            { id: 'atm' },
            { id: 'digital_currency' },
            { id: 'prepaid_card' },
          ],
          excluded_payment_methods: [],
          installments: 6,
        },
        binary_mode: params.binaryMode || false,
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        notification_url: `${baseUrl}/api/payments/webhook/mercadopago`,
        metadata: {
          giftId: String(params.giftId),
          giftName: params.giftName,
          guestId: params.guestId ? String(params.guestId) : null,
          purchaseId,
        },
        external_reference: `gift-${params.giftId}-${purchaseId}`,
        statement_descriptor: 'CASAMENTO',
      };

      const response = await this.preference.create({ body: preferenceData });

      const checkoutUrl = response.init_point || response.sandbox_init_point || '';

      return {
        preferenceId: response.id || '',
        checkoutUrl,
      };
    } catch (error) {
      console.error('Erro ao criar pagamento no Mercado Pago:', error);
      if (error instanceof Error) {
        throw new Error(`Mercado Pago API Error: ${error.message}`);
      }
      throw error;
    }
  }

  async getPreference(preferenceId: string) {
    try {
      const response = await this.preference.get({ preferenceId });
      return response;
    } catch (error) {
      console.error('Erro ao buscar preferência do Mercado Pago:', error);
      throw error;
    }
  }

  async getPayment(paymentId: string) {
    try {
      const { Payment } = await import('mercadopago');
      const payment = new Payment(this.client);

      const response = await payment.get({ id: paymentId });
      return response;
    } catch (error) {
      console.error('Erro ao buscar pagamento do Mercado Pago:', error);
      throw error;
    }
  }
}

export const mercadoPagoClient = new MercadoPagoClient();
