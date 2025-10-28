import { env } from '../config/env';

interface PixQrCodeCreateParams {
  amount: number;
  expiresIn?: number;
  description?: string;
  customer?: {
    name: string;
    cellphone: string;
    email: string;
    taxId: string;
  };
  metadata?: Record<string, unknown>;
}

interface PixQrCodeResponse {
  data: {
    id: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'EXPIRED';
    devMode: boolean;
    brCode: string;
    brCodeBase64: string;
    platformFee: number;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    metadata?: Record<string, unknown>;
  };
  error: string | null;
}

interface PixQrCodeCheckResponse {
  data: {
    status: 'PENDING' | 'PAID' | 'EXPIRED';
    expiresAt: string;
  };
  error: string | null;
}

class AbacatePayClient {
  private baseUrl: string;
  private apiKey: string;
  private devMode: boolean;

  constructor() {
    this.baseUrl = env.ABACATEPAY_BASE_URL;
    this.apiKey = env.ABACATEPAY_API_KEY;
    this.devMode = env.ABACATEPAY_DEV_MODE;

    if (!this.apiKey) {
      console.warn('⚠️  ABACATEPAY_API_KEY não configurada. Configure no arquivo .env');
    }
  }

  private getHeaders() {
    return {
      accept: 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
    };
  }

  async createPixQrCode(params: PixQrCodeCreateParams): Promise<PixQrCodeResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/pixQrCode/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          amount: params.amount,
          expiresIn: params.expiresIn || 3600,
          description: params.description || 'Pagamento de presente',
          customer: params.customer,
          metadata: params.metadata || {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AbacatePay API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as PixQrCodeResponse;
      return data;
    } catch (error) {
      console.error('Erro ao criar QR Code PIX:', error);
      throw error;
    }
  }

  async checkPixQrCode(pixChargeId: string): Promise<PixQrCodeCheckResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/pixQrCode/check?id=${pixChargeId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AbacatePay API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as PixQrCodeCheckResponse;
      return data;
    } catch (error) {
      console.error('Erro ao verificar status do PIX:', error);
      throw error;
    }
  }

  async simulatePixPayment(
    pixChargeId: string
  ): Promise<{ data: { status: string }; error: string | null }> {
    if (!this.devMode) {
      throw new Error('Simulação de pagamento só é permitida em Dev Mode');
    }

    try {
      const response = await fetch(`${this.baseUrl}/pixQrCode/simulate-payment?id=${pixChargeId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ metadata: {} }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AbacatePay API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as { data: { status: string }; error: string | null };
      return data;
    } catch (error) {
      console.error('Erro ao simular pagamento PIX:', error);
      throw error;
    }
  }

  isDevMode(): boolean {
    return this.devMode;
  }
}

export const abacatePayClient = new AbacatePayClient();
