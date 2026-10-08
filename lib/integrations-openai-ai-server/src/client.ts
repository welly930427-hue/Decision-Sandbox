import OpenAI from "openai";

const directApiKey = process.env.OPENAI_API_KEY;
const integrationApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

if (!directApiKey && (!integrationApiKey || !integrationBaseUrl)) {
  throw new Error(
    "Configure OPENAI_API_KEY or provision the OpenAI AI integration before starting the API server.",
  );
}

export const openai = new OpenAI(
  directApiKey
    ? { apiKey: directApiKey }
    : { apiKey: integrationApiKey!, baseURL: integrationBaseUrl! },
);
