import { model } from "@/config/constants";

/**
 * AI Gateway 工具函数
 */

export interface ModelMapping {
  [key: string]: {
    provider: 'replicate' | 'gemini';
    model: string;
    credits: number;
    description: string;
  };
}

export const modelMappings: ModelMapping = {
  [model.backgroundRemoval]: {
    provider: 'replicate',
    model: 'men1scus/birefnet',
    credits: 2,
    description: 'Background Removal - 智能去背景，保留主体'
  },
};

export function getModelInfo(modelName: string) {
  return modelMappings[modelName];
}

export function isModelSupported(modelName: string): boolean {
  return modelName in modelMappings;
}

export function formatErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
  return '未知错误';
} 