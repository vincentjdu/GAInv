
export enum Priority {
  URGENT = 'URGENT',
  HAUTE = 'HAUTE',
  NORMALE = 'NORMALE'
}

export enum CaseCategory {
  BIENS = 'Atteinte aux biens',
  PERSONNES = 'Atteinte aux personnes',
  STUPEFIANTS = 'Stupéfiants',
  CYBER = 'Cybercriminalité',
  ROUTIER = 'Sécurité Routière',
  AUTRE = 'Autre'
}

export interface InvestigationStep {
  id: string;
  title: string;
  description: string;
  legalBasis: string;
  priority: Priority;
  completed: boolean;
  result?: string;
}

export interface CaseData {
  id: string;
  infraction: string;
  category: CaseCategory;
  modusOperandi: string;
  steps: InvestigationStep[];
  currentStatus: 'draft' | 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
}
