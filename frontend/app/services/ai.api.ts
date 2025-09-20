// Services IA pour le frontend Remix

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface SmartCategorization {
  category: string;
  subcategory: string;
  confidence: number;
  suggestedAgent?: string;
  themes?: string[];
  issues?: string[];
}

export interface SmartResponse {
  response: string;
  confidence: number;
  tone: 'formal' | 'friendly' | 'apologetic' | 'professional';
  requiresHuman: boolean;
  suggestedActions?: string[];
  estimatedResolutionTime?: number;
}

export interface EscalationPrediction {
  riskLevel: number;
  escalationProbability: number;
  suggestedActions: string[];
  timeToEscalation?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
}

export interface CompleteAIAnalysis {
  ticketId: string;
  analysis: {
    sentiment: SentimentAnalysis;
    categorization: SmartCategorization;
    smartResponse: SmartResponse;
    escalationPrediction: EscalationPrediction;
    workflowOptimization: any;
  };
  recommendations: {
    priority: string;
    assignTo?: string;
    estimatedTime: number;
    requiresHuman: boolean;
    nextActions: string[];
  };
  aiConfidence: {
    sentiment: number;
    categorization: number;
    response: number;
    escalation: number;
  };
}

const BASE_URL = '/api/support/ai';

// ==================== API CALLS ====================

export async function analyzeSentiment(
  type: 'ticket' | 'review',
  id: string,
  request?: Request
): Promise<SentimentAnalysis> {
  const response = await fetch(`${BASE_URL}/sentiment/${type}/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur analyse sentiment: ${response.statusText}`);
  }

  return response.json();
}

export async function categorizeContent(
  type: 'ticket' | 'review',
  id: string,
  request?: Request
): Promise<SmartCategorization> {
  const response = await fetch(`${BASE_URL}/categorization/${type}/${id}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur catégorisation: ${response.statusText}`);
  }

  return response.json();
}

export async function generateSmartResponse(
  type: 'ticket' | 'review',
  id: string,
  includeAnalysis: boolean = true,
  request?: Request
): Promise<SmartResponse> {
  const url = `${BASE_URL}/response/${type}/${id}${includeAnalysis ? '?includeAnalysis=true' : ''}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur génération réponse: ${response.statusText}`);
  }

  return response.json();
}

export async function predictEscalation(
  ticketId: string,
  request?: Request
): Promise<EscalationPrediction> {
  const response = await fetch(`${BASE_URL}/escalation/ticket/${ticketId}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur prédiction escalation: ${response.statusText}`);
  }

  return response.json();
}

export async function getCompleteAIAnalysis(
  ticketId: string,
  request?: Request
): Promise<CompleteAIAnalysis> {
  const response = await fetch(`${BASE_URL}/analyze/complete/${ticketId}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur analyse complète: ${response.statusText}`);
  }

  return response.json();
}

export async function getAIStats(request?: Request) {
  const response = await fetch(`${BASE_URL}/stats`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur stats IA: ${response.statusText}`);
  }

  return response.json();
}

export async function getAIHealth(request?: Request) {
  const response = await fetch(`${BASE_URL}/health`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request ? { 'Cookie': request.headers.get('Cookie') || '' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur santé IA: ${response.statusText}`);
  }

  return response.json();
}

// ==================== UTILITÉ FRONTEND ====================

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'text-green-600';
    case 'negative': return 'text-red-600';
    case 'neutral': return 'text-yellow-600';
    default: return 'text-gray-600';
  }
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'text-red-800 bg-red-100';
    case 'high': return 'text-orange-800 bg-orange-100';
    case 'medium': return 'text-yellow-800 bg-yellow-100';
    case 'low': return 'text-green-800 bg-green-100';
    default: return 'text-gray-800 bg-gray-100';
  }
}

export function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'critical': return '🚨';
    case 'high': return '⚡';
    case 'medium': return '⚠️';
    case 'low': return '📝';
    default: return '📄';
  }
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  } else if (minutes < 1440) {
    return `${Math.round(minutes / 60)}h`;
  } else {
    return `${Math.round(minutes / 1440)} jour(s)`;
  }
}

export function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return '😊';
    case 'negative': return '😞';
    case 'neutral': return '😐';
    default: return '🤔';
  }
}
