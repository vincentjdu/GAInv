
import { GoogleGenAI, Type, GenerateContentParameters } from "@google/genai";
import { InvestigationStep, Priority } from "../types.ts";

/**
 * Récupère la clé API de manière sécurisée sans faire planter l'application
 * si l'objet process est manquant (cas fréquent sur GitHub Pages).
 */
const getApiKey = (): string => {
  try {
    return (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  } catch (e) {
    return "";
  }
};

const getAI = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
};

const anonymize = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\b(M\.|Mme|Mlle|Monsieur|Madame)\s+[A-Z][a-zà-ÿ]+\b/g, "$1 [NOM]")
    .replace(/\b[A-Z]{2,}\b/g, "[NOM_OU_SIGLE]");
};

const STEP_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Titre court de l'acte d'enquête" },
      description: { type: Type.STRING, description: "Description détaillée de la procédure à suivre" },
      legalBasis: { type: Type.STRING, description: "Article de loi ou code de procédure pénale pertinent" },
      priority: { type: Type.STRING, description: "Priorité: URGENT, HAUTE, ou NORMALE" },
    },
    required: ["title", "description", "legalBasis", "priority"],
  }
};

const SYSTEM_PROMPT = `Vous êtes un Officier de Police Judiciaire (OPJ) senior de la Gendarmerie Nationale française. 
RÈGLES DE CONFIDENTIALITÉ :
1. Toute donnée nominative doit être remplacée par [INDIVIDU] ou [LIEU].
2. Vos réponses doivent être strictement professionnelles et conformes au Code de Procédure Pénale.
3. Ne mentionnez jamais d'informations confidentielles réelles.`;

async function generateWithRetry(params: GenerateContentParameters, retries = 3, delay = 1000): Promise<any> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent(params);
    return response;
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateWithRetry(params, retries - 1, delay * 2);
    }
    throw error;
  }
}

const MODEL_NAME = 'gemini-3-flash-preview';

export const generateInvestigationPlan = async (infraction: string, modusOperandi: string): Promise<InvestigationStep[]> => {
  const response = await generateWithRetry({
    model: MODEL_NAME,
    contents: `Générez une trame d'enquête structurée pour l'infraction suivante : "${anonymize(infraction)}". 
    Mode opératoire constaté : "${anonymize(modusOperandi)}".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: STEP_SCHEMA,
      systemInstruction: SYSTEM_PROMPT
    }
  });

  const rawSteps = JSON.parse(response.text || "[]");
  return rawSteps.map((s: any, index: number) => ({
    ...s,
    id: `step-${Date.now()}-${index}`,
    completed: false,
    priority: s.priority as Priority
  }));
};

export const suggestNextSteps = async (
  infraction: string, 
  completedSteps: InvestigationStep[]
): Promise<InvestigationStep[]> => {
  const resultsSummary = completedSteps
    .filter(s => s.completed)
    .map(s => `Acte: ${s.title}. Résultat: ${anonymize(s.result || "")}`)
    .join("\n");

  const response = await generateWithRetry({
    model: MODEL_NAME,
    contents: `Infraction en cours : "${anonymize(infraction)}". 
    Actes déjà réalisés et résultats :\n${resultsSummary}\n
    Sur la base de ces éléments, proposez les prochaines étapes logiques de l'enquête.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: STEP_SCHEMA,
      systemInstruction: SYSTEM_PROMPT
    }
  });

  const rawSteps = JSON.parse(response.text || "[]");
  return rawSteps.map((s: any, index: number) => ({
    ...s,
    id: `step-next-${Date.now()}-${index}`,
    completed: false,
    priority: s.priority as Priority
  }));
};

export const generateDocumentDraft = async (
  step: InvestigationStep, 
  infraction: string, 
  modusOperandi: string
): Promise<string> => {
  const statusContext = step.completed 
    ? `L'acte a été réalisé. Résultats constatés : ${anonymize(step.result || "")}`
    : `Préparez une trame de PV avant réalisation.`;

  const response = await generateWithRetry({
    model: MODEL_NAME,
    contents: `Rédigez un brouillon de procès-verbal de gendarmerie pour l'acte suivant : "${step.title}".
    Nature de l'affaire : ${anonymize(infraction)}.
    Cadre juridique : ${step.legalBasis}. 
    Contexte : ${statusContext}.`,
    config: {
      systemInstruction: SYSTEM_PROMPT + "\nStyle : Administratif Gendarmerie (ex: 'L'an deux mille...', 'Agissant en vertu des articles...')."
    }
  });

  return response.text || "Erreur lors de la génération du document.";
};
