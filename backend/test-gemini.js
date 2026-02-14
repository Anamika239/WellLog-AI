const { GoogleGenerativeAI } = require('@google/generative-ai');

// Your valid API key
const API_KEY = 'AIzaSyDfaK5SvRSYNInD1URB8kK4I0gXrzX2E3g';
const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
  try {
    console.log('🔍 Testing Gemini API...');
    
    // Use the correct model name format
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
    
    const result = await model.generateContent('Say "Hello" in one word');
    const response = await result.response;
    console.log('✅ SUCCESS! Response:', response.text());
    
  } catch (error) {
    console.error('❌ Error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack
    });
  }
}

test();