import { BaseWBClient } from './base-client';
import { FBSSupply, FBSLabel, WBAPIResponse } from './types';

export class WBMarketplaceClient extends BaseWBClient {
  constructor(token: string) {
    super(token, 'https://marketplace-api.wildberries.ru');
  }

  /**
   * Create FBS supply
   * @param name Supply name
   * @param warehouseId Warehouse ID
   */
  async createFBSSupply(name: string, warehouseId: number): Promise<FBSSupply> {
    const data = {
      name,
      warehouseId,
    };

    const response = await this.post<FBSSupply>('/api/v3/supplies', data);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to create FBS supply');
    }

    return response.data;
  }

  /**
   * Get FBS supplies list
   * @param limit Maximum number of supplies to return
   * @param offset Offset for pagination
   */
  async getFBSSupplies(limit: number = 1000, offset: number = 0): Promise<FBSSupply[]> {
    const params = {
      limit,
      offset,
    };

    const response = await this.get<FBSSupply[]>('/api/v3/supplies', params);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get FBS supplies');
    }

    return response.data || [];
  }

  /**
   * Get FBS supply details by ID
   * @param supplyId Supply ID
   */
  async getFBSSupplyDetails(supplyId: string): Promise<FBSSupply> {
    const response = await this.get<FBSSupply>(`/api/v3/supplies/${supplyId}`);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get FBS supply details');
    }

    return response.data;
  }

  /**
   * Generate labels for FBS supply
   * @param supplyId Supply ID
   */
  async generateFBSLabels(supplyId: string): Promise<FBSLabel[]> {
    const response = await this.post<FBSLabel[]>(`/api/v3/supplies/${supplyId}/labels`);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to generate FBS labels');
    }

    return response.data || [];
  }

  /**
   * Get FBS supply labels
   * @param supplyId Supply ID
   */
  async getFBSLabels(supplyId: string): Promise<FBSLabel[]> {
    const response = await this.get<FBSLabel[]>(`/api/v3/supplies/${supplyId}/labels`);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to get FBS labels');
    }

    return response.data || [];
  }

  /**
   * Update FBS supply status
   * @param supplyId Supply ID
   * @param status New status
   */
  async updateFBSSupplyStatus(supplyId: string, status: string): Promise<FBSSupply> {
    const data = {
      status,
    };

    const response = await this.put<FBSSupply>(`/api/v3/supplies/${supplyId}`, data);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to update FBS supply status');
    }

    return response.data;
  }

  /**
   * Delete FBS supply
   * @param supplyId Supply ID
   */
  async deleteFBSSupply(supplyId: string): Promise<boolean> {
    const response = await this.delete(`/api/v3/supplies/${supplyId}`);
    
    if (response.error) {
      throw new Error(response.errorText || 'Failed to delete FBS supply');
    }

    return true;
  }
}
