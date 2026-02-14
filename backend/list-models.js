const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyBHVCdXToUxm0NbkNT1Y1ecT4iGJLOcZ6E';
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    // Try to list available models (this might not work directly)
    console.log('Trying different model names...');
    
    const models = [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro',
      'gemini-pro-vision'
    ];
    
    for (const modelName of models) {
      try {
        console.log(`Testing ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say hello');
        const response = await result.response;
        console.log(`✅ ${modelName} works! Response:`, response.text());
        break;
      } catch (e) {
        console.log(`❌ ${modelName} failed:`, e.message);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
