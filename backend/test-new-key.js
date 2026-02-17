const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyBdlXYDKZishbUatkDD_vEHRbSpTVP5uTc';
const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
  try {
    console.log('🔍 Testing new Gemini API key...');
    
    // Test different model names
    const models = [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro'
    ];
    
    for (const modelName of models) {
      try {
        console.log(`\n📡 Testing ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "Hello" in one word');
        const response = await result.response;
        console.log(`✅ SUCCESS with ${modelName}:`, response.text());
        return; // Stop after first success
      } catch (e) {
        console.log(`❌ ${modelName} failed:`, e.message);
      }
    }
    
    console.log('\n❌ No models worked with this API key');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
