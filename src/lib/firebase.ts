// Firebase AI Logic: one app, two models over the same triage contract.
// - triageModel: hybrid, prefer on-device (Gemini Nano in Chrome), cloud fallback.
// - investigateModel: cloud only, used when the owner asks for a deep look.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  Schema,
  type GenerativeModel,
} from "firebase/ai";
import { SYSTEM_PROMPT, VERDICT_SCHEMA } from "@/lib/triage";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const CLOUD_MODEL = "gemini-3.6-flash";

// The cloud side uses Firebase's own Schema builder; the on-device side takes the
// plain JSON schema through responseConstraint. Both describe the same verdict.
const cloudVerdictSchema = Schema.object({
  properties: {
    verdict: Schema.enumString({ enum: ["noise", "check", "danger"] }),
    reason: Schema.string(),
    next_step: Schema.string(),
  },
});

let app: FirebaseApp | null = null;
let triage: GenerativeModel | null = null;
let investigate: GenerativeModel | null = null;

const firebaseApp = () => {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (typeof window !== "undefined" && siteKey) {
    // App Check is required by Firebase AI Logic. Fraud Defense (reCAPTCHA
    // Enterprise) key, allowed on localhost and the two Firebase Hosting domains.
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  }
  return app;
};

export const triageModel = () => {
  if (triage) return triage;
  const ai = getAI(firebaseApp(), { backend: new GoogleAIBackend() });
  triage = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    onDeviceParams: {
      createOptions: { initialPrompts: [{ role: "system", content: [{ type: "text", value: SYSTEM_PROMPT }] }] },
      promptOptions: { responseConstraint: VERDICT_SCHEMA },
    },
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json", responseSchema: cloudVerdictSchema },
    },
  });
  return triage;
};

export const investigateModel = () => {
  if (investigate) return investigate;
  const ai = getAI(firebaseApp(), { backend: new GoogleAIBackend() });
  investigate = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction:
        "You are a senior incident responder. You get a scrubbed bundle of related server alerts. " +
        "Say in plain words whether they form one story (an attack, or routine admin work), " +
        "the order of events, and the 3 most useful next checks. Be concrete and short.",
    },
  });
  return investigate;
};
